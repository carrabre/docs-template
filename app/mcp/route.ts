import { NextResponse } from "next/server";

import {
  getAllPageMeta,
  getAllPages,
  getDocsConfig,
  getNavGroups,
  getPage,
  normalizeDocSlug,
} from "@/lib/docs";
import { getLlmsFullTxt, getLlmsTxt, getPageMarkdown } from "@/lib/markdown";
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
      tools: mcpTools().map((tool) => tool.name),
      resources: mcpResources().map((resource) => resource.uri),
      prompts: mcpPrompts().map((prompt) => prompt.name),
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
          resources: {},
          prompts: {},
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
        tools: mcpTools(),
      });
    case "tools/call":
      return handleToolCall(id, request.params);
    case "resources/list":
      return resultResponse(id, {
        resources: mcpResources(),
      });
    case "resources/read":
      return handleResourceRead(id, request.params);
    case "prompts/list":
      return resultResponse(id, {
        prompts: mcpPrompts(),
      });
    case "prompts/get":
      return handlePromptGet(id, request.params);
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

  if (toolCall.name === "list_pages") {
    const pages = getAllPageMeta().map((page) => ({
      title: page.title,
      slug: page.slug,
      route: page.route,
      description: page.description,
      kind: page.kind ?? "mdx",
    }));

    return toolResultResponse(id, JSON.stringify(pages, null, 2));
  }

  if (toolCall.name === "read_doc" || toolCall.name === "get_page_markdown") {
    const slug = normalizeSlug(stringParam(args.slug));

    if (!slug) {
      return errorResponse(id, -32602, `${toolCall.name} requires slug.`);
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

  if (toolCall.name === "list_api_endpoints") {
    const endpoints = getApiEndpointMeta().map((page) => ({
      title: page.title,
      slug: page.slug,
      route: page.route,
      method: page.method,
      endpoint: page.endpoint,
      sourcePath: "sourcePath" in page ? page.sourcePath : page.filePath,
    }));

    return toolResultResponse(id, JSON.stringify(endpoints, null, 2));
  }

  if (toolCall.name === "get_api_endpoint") {
    const slug = normalizeSlug(stringParam(args.slug));
    const method = stringParam(args.method).toUpperCase();
    const endpoint = stringParam(args.endpoint);
    const pageMeta = getApiEndpointMeta().find((page) => {
      if (slug && page.slug === slug) {
        return true;
      }

      return (
        method &&
        endpoint &&
        page.method === method &&
        page.endpoint === endpoint
      );
    });

    if (!pageMeta) {
      return errorResponse(
        id,
        -32602,
        "Unknown API endpoint. Pass slug, or method and endpoint.",
      );
    }

    const page = getPage(pageMeta.slug);

    if (!page) {
      return errorResponse(id, -32602, "API endpoint page could not be read.");
    }

    return toolResultResponse(id, getPageMarkdown(page));
  }

  return errorResponse(id, -32602, "Unknown tool name.");
}

function handleResourceRead(id: JsonRpcId, params: unknown) {
  const uri = isObject(params) ? stringParam(params.uri) : "";

  if (!uri) {
    return errorResponse(id, -32602, "resources/read requires uri.");
  }

  if (uri === "docs://llms.txt") {
    return resourceResultResponse(id, uri, getLlmsTxt(getDocsConfig(), getNavGroups()));
  }

  if (uri === "docs://llms-full.txt") {
    return resourceResultResponse(
      id,
      uri,
      getLlmsFullTxt(getDocsConfig(), getAllPages()),
    );
  }

  if (uri.startsWith("docs://page/")) {
    const slug = normalizeSlug(uri.replace(/^docs:\/\/page\//, ""));
    const page = slug ? getPage(slug) : null;

    if (page) {
      return resourceResultResponse(id, uri, getPageMarkdown(page));
    }
  }

  if (uri.startsWith("docs://api/")) {
    const slug = normalizeSlug(uri.replace(/^docs:\/\/api\//, ""));
    const page = slug ? getPage(slug) : null;

    if (page?.kind === "api") {
      return resourceResultResponse(id, uri, getPageMarkdown(page));
    }
  }

  return errorResponse(id, -32602, `Unknown resource: ${uri}`);
}

function handlePromptGet(id: JsonRpcId, params: unknown) {
  const name = isObject(params) ? stringParam(params.name) : "";
  const args = isObject(params) && isObject(params.arguments) ? params.arguments : {};

  if (name === "ask_docs") {
    const question = stringParam(args.question) || "What should I read first?";

    return promptResultResponse(id, `Use the docs MCP tools to answer: ${question}`);
  }

  if (name === "summarize_page") {
    const slug = normalizeSlug(stringParam(args.slug)) || "index";

    return promptResultResponse(
      id,
      `Read docs://page/${slug} and summarize the page in five concise bullets.`,
    );
  }

  if (name === "api_quickstart") {
    return promptResultResponse(
      id,
      "Use list_api_endpoints and get_api_endpoint to produce a beginner-friendly API quickstart.",
    );
  }

  return errorResponse(id, -32602, `Unknown prompt: ${name}`);
}

function mcpTools() {
  return [
    {
      name: "search_docs",
      description: "Search public documentation pages and sections.",
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
      inputSchema: pageSlugSchema(),
    },
    {
      name: "list_pages",
      description: "List all public documentation pages.",
      inputSchema: emptySchema(),
    },
    {
      name: "get_page_markdown",
      description: "Read a documentation page using the same Markdown export as .md routes.",
      inputSchema: pageSlugSchema(),
    },
    {
      name: "list_api_endpoints",
      description: "List generated OpenAPI and AsyncAPI endpoint pages.",
      inputSchema: emptySchema(),
    },
    {
      name: "get_api_endpoint",
      description: "Read a generated API endpoint page as Markdown.",
      inputSchema: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Generated API page slug.",
          },
          method: {
            type: "string",
            description: "HTTP method or AsyncAPI action.",
          },
          endpoint: {
            type: "string",
            description: "API path or AsyncAPI channel.",
          },
        },
      },
    },
  ];
}

function mcpResources() {
  return [
    {
      uri: "docs://llms.txt",
      name: "llms.txt",
      description: "Compact page index for AI tools.",
      mimeType: "text/markdown",
    },
    {
      uri: "docs://llms-full.txt",
      name: "llms-full.txt",
      description: "Full Markdown export for all listed docs pages.",
      mimeType: "text/markdown",
    },
    ...getAllPageMeta().map((page) => ({
      uri: `${page.kind === "api" ? "docs://api" : "docs://page"}/${page.slug}`,
      name: page.title,
      description: page.description,
      mimeType: "text/markdown",
    })),
  ];
}

function mcpPrompts() {
  return [
    {
      name: "ask_docs",
      description: "Ask a question grounded in this docs starter.",
      arguments: [
        {
          name: "question",
          description: "Question to answer with docs context.",
          required: true,
        },
      ],
    },
    {
      name: "summarize_page",
      description: "Summarize one docs page.",
      arguments: [
        {
          name: "slug",
          description: "Page slug to summarize.",
          required: true,
        },
      ],
    },
    {
      name: "api_quickstart",
      description: "Create a beginner-friendly quickstart from generated API pages.",
      arguments: [],
    },
  ];
}

function getApiEndpointMeta() {
  return getAllPageMeta().filter((page) => page.kind === "api");
}

function pageSlugSchema() {
  return {
    type: "object",
    properties: {
      slug: {
        type: "string",
        description: "Page slug, such as index, getting-started, or deploy-to-vercel.",
      },
    },
    required: ["slug"],
  };
}

function emptySchema() {
  return {
    type: "object",
    properties: {},
  };
}

function resultResponse(id: JsonRpcId, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function resourceResultResponse(id: JsonRpcId, uri: string, text: string) {
  return resultResponse(id, {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text,
      },
    ],
  });
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

function promptResultResponse(id: JsonRpcId, text: string) {
  return resultResponse(id, {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text,
        },
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
