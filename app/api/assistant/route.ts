import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  ResponseInputItem,
  Tool,
} from "openai/resources/responses/responses";

import { getCodebaseContext } from "@/lib/codebase-context";
import { DOCS_ORIGIN } from "@/lib/contextual";
import { getSearchIndex, searchDocs, toSearchSource } from "@/lib/search";
import type { SearchEntry, SearchSource } from "@/lib/search-types";
import { siteConfig } from "@/site.config";

export const runtime = "nodejs";

const DEFAULT_MODEL = siteConfig.assistant.defaultModel;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 2000;
const MAX_SOURCES = 6;
const MAX_SOURCE_CHARS = 12000;
const MAX_SOURCE_CHARS_PER_ENTRY = 2600;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

let openAIClient: OpenAI | null = null;

export function GET() {
  return NextResponse.json(
    { configured: Boolean(process.env.OPENAI_API_KEY) },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error:
          siteConfig.assistant.unavailableMessage,
      },
      { status: 503 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const messages = parseMessages(payload);
  const currentSlug = parseCurrentSlug(payload);
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return NextResponse.json(
      { error: "Send at least one user message." },
      { status: 400 },
    );
  }

  const sources = collectSources(lastUserMessage.content, currentSlug);
  const sourceContext = buildSourceContext(sources);
  const codebaseContext = getCodebaseContext();
  const input = buildResponseInput(messages);

  try {
    const stream = await getOpenAIClient().responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      input,
      instructions: buildInstructions(sourceContext, codebaseContext),
      include: ["web_search_call.action.sources"],
      max_output_tokens: 900,
      reasoning: { effort: "none" },
      store: false,
      stream: true,
      stream_options: {
        include_obfuscation: false,
      },
      text: {
        verbosity: "low",
      },
      tools: getAssistantTools(),
    });

    return createAssistantStream(stream, sources.map(toSearchSource));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The assistant could not answer right now.",
      },
      { status: 500 },
    );
  }
}

function getOpenAIClient(): OpenAI {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openAIClient;
}

function parseMessages(payload: unknown): ChatMessage[] {
  if (!isObject(payload) || !Array.isArray(payload.messages)) {
    return [];
  }

  return payload.messages
    .filter((message): message is ChatMessage => {
      return (
        isObject(message) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      );
    })
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: truncate(message.content.trim(), MAX_MESSAGE_CHARS),
    }));
}

function parseCurrentSlug(payload: unknown): string | undefined {
  if (!isObject(payload) || typeof payload.currentSlug !== "string") {
    return undefined;
  }

  const slug = payload.currentSlug.trim();
  const exists = getSearchIndex().some((entry) => entry.slug === slug);

  return exists ? slug : undefined;
}

function buildResponseInput(messages: ChatMessage[]): ResponseInputItem[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function collectSources(query: string, currentSlug?: string): SearchEntry[] {
  const ranked = searchDocs(query, {
    currentSlug,
    limit: MAX_SOURCES,
  });
  const entries = new Map<string, SearchEntry>();
  const addEntry = (entry: SearchEntry) => {
    if (entries.has(entry.id)) {
      return;
    }

    if (entries.size >= MAX_SOURCES) {
      const lastKey = [...entries.keys()].at(-1);

      if (lastKey) {
        entries.delete(lastKey);
      }
    }

    entries.set(entry.id, entry);
  };

  for (const entry of ranked) {
    addEntry(entry);
  }

  if (currentSlug) {
    const currentPageEntries = getSearchIndex()
      .filter((entry) => entry.slug === currentSlug)
      .slice(0, 2);

    for (const entry of currentPageEntries) {
      addEntry(entry);
    }
  }

  return [...entries.values()].slice(0, MAX_SOURCES);
}

function buildSourceContext(sources: SearchEntry[]): string {
  let usedChars = 0;
  const blocks: string[] = [];

  for (const [index, source] of sources.entries()) {
    const url = `${DOCS_ORIGIN}${source.route}${source.anchor ? `#${source.anchor}` : ""}`;
    const content = truncate(source.searchText, MAX_SOURCE_CHARS_PER_ENTRY);
    const block = [
      `[${index + 1}] ${source.title}${source.section !== source.title ? ` / ${source.section}` : ""}`,
      `URL: ${url}`,
      `Excerpt: ${content}`,
    ].join("\n");

    if (usedChars + block.length > MAX_SOURCE_CHARS) {
      break;
    }

    blocks.push(block);
    usedChars += block.length;
  }

  if (blocks.length === 0) {
    return siteConfig.assistant.noSourcesMessage;
  }

  return blocks.join("\n\n");
}

function getAssistantTools(): Tool[] {
  return [
    {
      type: "web_search",
      search_context_size: "low",
      user_location: {
        type: "approximate",
        country: "US",
        timezone: "America/Los_Angeles",
      },
    },
  ];
}

function buildInstructions(
  sourceContext: string,
  codebaseContext: string,
): string {
  return `You are the documentation assistant for ${siteConfig.name}.

You have three context sources:
1. Public documentation excerpts from this repo.
2. Allowlisted source files from this docs codebase.
3. Internet access through the web search tool.

For questions about this template, prefer the public documentation excerpts. Use web search for current or external information, but do not invent product-specific pricing, quotas, access rules, or workflows that are not in the docs.

Use the codebase context when the user asks how this docs site is built, how the assistant/search works, or where to change implementation. Do not claim access to files outside the allowlisted codebase context. Never request, reveal, or infer secrets from env files, AGENTS.md, private admin workflows, node_modules, package-lock files, or unlisted files.

Use concise, direct second-person language. When details depend on the user's own project, explain the placeholder clearly instead of assuming a specific company, product, pricing model, or hosting account.

If the docs and allowlisted codebase context do not contain enough information, say that the docs do not have enough information to answer and point the user to ${siteConfig.assistant.supportPath}.

Mention source page names, file paths, or web URLs when helpful. Keep the answer short.

Public docs excerpts:
${sourceContext}

Allowlisted docs codebase context:
${codebaseContext}`;
}

function createAssistantStream(
  openAIStream: AsyncIterable<unknown>,
  sources: SearchSource[],
) {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const event of openAIStream) {
            if (
              isObject(event) &&
              event.type === "response.output_text.delta" &&
              typeof event.delta === "string"
            ) {
              controller.enqueue(encodeEvent(encoder, "delta", event.delta));
            }
          }

          controller.enqueue(encodeEvent(encoder, "sources", sources));
          controller.enqueue(encodeEvent(encoder, "done", true));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encodeEvent(
              encoder,
              "error",
              error instanceof Error
                ? error.message
                : "The assistant stream stopped unexpectedly.",
            ),
          );
          controller.close();
        }
      },
    }),
    {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no",
      },
    },
  );
}

function encodeEvent(encoder: TextEncoder, event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
