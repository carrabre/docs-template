import { NextResponse } from "next/server";

import { getAllPageMeta, getPage, normalizeDocSlug } from "@/lib/docs";
import { getPageMarkdown } from "@/lib/markdown";
import { searchDocs } from "@/lib/search";
import { siteConfig } from "@/site.config";

export const runtime = "nodejs";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type ToolCallParams = {
  name?: unknown;
  arguments?: unknown;
};

export function GET() {
  return NextResponse.json(
    {
      name: siteConfig.mcp.name,
      description: `${siteConfig.name} MCP endpoint for searching and reading docs.`,
      transport: "http",
      tools: ["search_docs", "read_doc"],
    },
    {
      headers: {
        ...corsHeaders(),
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonRpcResponse(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Invalid JSON body." },
      },
      400,
    );
  }

  if (Array.isArray(payload)) {
    const responses = payload
      .map((item) => handleJsonRpcRequest(item))
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return jsonRpcResponse(responses);
  }

  const response = handleJsonRpcRequest(payload);

  if (!response) {
    return new Response(null, { status: 202 });
  }

  return jsonRpcResponse(response);
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function handleJsonRpcRequest(payload: unknown) {
  if (!isObject(payload)) {
    return errorResponse(null, -32600, "Invalid JSON-RPC request.");
  }

  const request = payload as JsonRpcRequest;
  const id = request.id ?? null;

  if (typeof request.method !== "string") {
    return errorResponse(id, -32600, "Missing JSON-RPC method.");
  }

  if (request.id === undefined && request.method.startsWith("notifications/")) {
    return null;
  }

  switch (request.method) {
    case "initialize":
      return resultResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: siteConfig.mcp.name,
          version: "0.1.0",
        },
      });
    case "ping":
      return resultResponse(id, {});
    case "tools/list":
      return resultResponse(id, {
        tools: [
          {
            name: "search_docs",
            description: "Search the public documentation pages.",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query.",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results to return.",
                  minimum: 1,
                  maximum: 10,
                },
              },
              required: ["query"],
            },
          },
          {
            name: "read_doc",
            description: "Read a documentation page as Markdown.",
            inputSchema: {
              type: "object",
              properties: {
                slug: {
                  type: "string",
                  description:
                    "Page slug, such as index, getting-started, or deploy-to-vercel.",
                },
              },
              required: ["slug"],
            },
          },
        ],
      });
    case "tools/call":
      return handleToolCall(id, request.params);
    default:
      return errorResponse(id, -32601, `Unsupported method: ${request.method}`);
  }
}

function handleToolCall(id: JsonRpcId, params: unknown) {
  if (!isObject(params)) {
    return errorResponse(id, -32602, "Tool call params must be an object.");
  }

  const toolCall = params as ToolCallParams;
  const args = isObject(toolCall.arguments) ? toolCall.arguments : {};

  if (toolCall.name === "search_docs") {
    const query = stringParam(args.query);

    if (!query) {
      return errorResponse(id, -32602, "search_docs requires query.");
    }

    const limit = numberParam(args.limit, 6, 1, 10);
    const results = searchDocs(query, { limit }).map((entry) => ({
      title: entry.title,
      section: entry.section,
      route: entry.route,
      anchor: entry.anchor,
      snippet: entry.snippet,
    }));

    return toolResultResponse(
      id,
      results.length > 0
        ? JSON.stringify(results, null, 2)
        : "No matching docs found.",
    );
  }

  if (toolCall.name === "read_doc") {
    const slug = normalizeSlug(stringParam(args.slug));

    if (!slug) {
      return errorResponse(id, -32602, "read_doc requires slug.");
    }

    const page = getPage(slug);

    if (!page) {
      const available = getAllPageMeta().map((item) => item.slug).join(", ");
      return errorResponse(
        id,
        -32602,
        `Unknown page slug. Available slugs: ${available}`,
      );
    }

    return toolResultResponse(id, getPageMarkdown(page));
  }

  return errorResponse(id, -32602, "Unknown tool name.");
}

function resultResponse(id: JsonRpcId, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function toolResultResponse(id: JsonRpcId, text: string) {
  return resultResponse(id, {
    content: [
      {
        type: "text",
        text,
      },
    ],
  });
}

function errorResponse(id: JsonRpcId, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function jsonRpcResponse(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      ...corsHeaders(),
      "Cache-Control": "no-store",
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Headers": "Content-Type, MCP-Protocol-Version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*",
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringParam(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberParam(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const number = typeof value === "number" ? value : fallback;

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(number), minimum), maximum);
}

function normalizeSlug(value: string) {
  const slug = value
    .replace(/^\/+/, "")
    .replace(/\.mdx?$/, "")
    .replace(/^api\/markdown\//, "")
    .replace(/^$/, "index");

  return normalizeDocSlug(slug) ?? "";
}
