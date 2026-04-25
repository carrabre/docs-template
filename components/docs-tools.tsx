"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Bot,
  Command,
  Loader2,
  Search,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  SetStateAction,
} from "react";

import type { SearchEntry, SearchSource } from "@/lib/search-types";
import { siteConfig } from "@/site.config";

type DocsToolsProps = {
  currentSlug: string;
  currentTitle: string;
  searchIndex: SearchEntry[];
  variant?: "all" | "search" | "assistant";
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SearchSource[];
  error?: boolean;
};

type AssistantStatus = "unknown" | "configured" | "unconfigured";

const ASSISTANT_INTRO_PROMPT =
  "Give me a short, codebase-focused introduction to how you can help with this docs starter. Keep it relevant to the docs pages, allowlisted source files, search, the optional AI assistant, the MCP endpoint, and external AI context actions. Mention the specific files and tools I can ask about when I want to understand or customize the codebase.";

export function DocsTools({
  currentSlug,
  currentTitle,
  searchIndex,
  variant = "all",
}: DocsToolsProps) {
  const showSearch = variant === "all" || variant === "search";
  const showAssistant = variant === "all" || variant === "assistant";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [assistantStatus, setAssistantStatus] =
    useState<AssistantStatus>("unknown");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const assistantInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSentIntroPromptRef = useRef(false);
  const [hasMounted, setHasMounted] = useState(false);

  const results = useMemo(
    () => rankSearchResults(searchIndex, query, currentSlug).slice(0, 8),
    [currentSlug, query, searchIndex],
  );
  const visibleResults =
    query.trim().length > 0
      ? results
      : searchIndex.filter((entry) => entry.kind === "page").slice(0, 6);

  const sendAssistantPrompt = useCallback(
    async (value: string) => {
      if (assistantStatus === "unconfigured" || isAsking) {
        return;
      }

      const prompt = value.trim();

      if (!prompt) {
        return;
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: prompt.slice(0, 2000),
      };
      const assistantId = createId();
      const nextMessages = [...messages, userMessage];

      setMessages([
        ...nextMessages,
        {
          id: assistantId,
          role: "assistant",
          content: "",
        },
      ]);
      setDraft("");
      setIsAsking(true);

      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentSlug,
            messages: nextMessages
              .filter((message) => message.role === "user" || message.content)
              .slice(-8)
              .map((message) => ({
                role: message.role,
                content: message.content,
              })),
          }),
        });

        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error ||
              "The assistant could not answer right now. Try search instead.",
          );
        }

        await readAssistantStream(response, assistantId, setMessages);
      } catch (error) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content:
                    error instanceof Error
                      ? error.message
                      : "The assistant could not answer right now. Try search instead.",
                  error: true,
                }
              : message,
          ),
        );
      } finally {
        setIsAsking(false);
      }
    },
    [assistantStatus, currentSlug, isAsking, messages],
  );

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const opensSearch = (event.metaKey || event.ctrlKey) && event.key === "k";

      if (showSearch && opensSearch) {
        event.preventDefault();
        setIsSearchOpen(true);
      }

      if (event.key === "Escape") {
        setIsSearchOpen(false);
        setIsAssistantOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch || !isSearchOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isSearchOpen, showSearch]);

  useEffect(() => {
    if (!showAssistant || !isAssistantOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      assistantInputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isAssistantOpen, showAssistant]);

  useEffect(() => {
    if (!showAssistant || !isAssistantOpen || assistantStatus !== "unknown") {
      return;
    }

    let isMounted = true;

    fetch("/api/assistant", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { configured?: boolean }) => {
        if (!isMounted) {
          return;
        }

        setAssistantStatus(payload.configured ? "configured" : "unconfigured");
      })
      .catch(() => {
        if (isMounted) {
          setAssistantStatus("unconfigured");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [assistantStatus, isAssistantOpen, showAssistant]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isAssistantOpen]);

  useEffect(() => {
    if (
      !showAssistant ||
      !isAssistantOpen ||
      assistantStatus !== "configured" ||
      messages.length > 0 ||
      isAsking ||
      hasSentIntroPromptRef.current
    ) {
      return;
    }

    hasSentIntroPromptRef.current = true;
    void sendAssistantPrompt(ASSISTANT_INTRO_PROMPT);
  }, [
    assistantStatus,
    isAssistantOpen,
    isAsking,
    messages.length,
    sendAssistantPrompt,
    showAssistant,
  ]);

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (visibleResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, visibleResults.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    }

    if (event.key === "Enter" && visibleResults[selectedIndex]) {
      window.location.href = resultHref(visibleResults[selectedIndex]);
      setIsSearchOpen(false);
    }
  }

  async function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await sendAssistantPrompt(draft);
  }

  const searchDialog =
    isSearchOpen && hasMounted
      ? createPortal(
          <div className="search-dialog-backdrop" role="presentation">
            <div
              aria-modal="true"
              className="search-dialog"
              role="dialog"
              aria-label={`Search ${siteConfig.shortName}`}
            >
              <div className="search-dialog-field">
                <Search size={18} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={`Search ${siteConfig.shortName}`}
                />
                <button
                  type="button"
                  aria-label="Close search"
                  onClick={() => setIsSearchOpen(false)}
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>

              <div className="search-results" role="listbox">
                {visibleResults.length > 0 ? (
                  visibleResults.map((result, index) => (
                    <Link
                      key={result.id}
                      className="search-result"
                      data-selected={index === selectedIndex}
                      href={resultHref(result)}
                      onClick={() => setIsSearchOpen(false)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      role="option"
                      aria-selected={index === selectedIndex}
                    >
                      <span>
                        <strong>{result.title}</strong>
                        {result.section !== result.title ? (
                          <small>{result.section}</small>
                        ) : null}
                      </span>
                      <p>{result.snippet}</p>
                    </Link>
                  ))
                ) : (
                  <p className="search-empty">No matches found.</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {showSearch ? (
        <button
          type="button"
          className="docs-tool-button docs-search-button"
          onClick={() => setIsSearchOpen(true)}
        >
          <Search size={16} aria-hidden="true" />
          <span>Search</span>
          <kbd>
            <Command size={12} aria-hidden="true" />K
          </kbd>
        </button>
      ) : null}

      {showAssistant && !isAssistantOpen ? (
        <button
          type="button"
          className="assistant-fab"
          aria-expanded={isAssistantOpen}
          onClick={() => setIsAssistantOpen(true)}
        >
          <Bot size={18} aria-hidden="true" />
          <span>Ask AI</span>
        </button>
      ) : null}

      {searchDialog}

      {isAssistantOpen ? (
        <div className="assistant-shell" role="presentation">
          <button
            className="assistant-scrim"
            type="button"
            aria-label="Close assistant"
            onClick={() => setIsAssistantOpen(false)}
          />
          <aside
            aria-label={siteConfig.assistant.name}
            aria-modal="true"
            className="assistant-panel"
            role="dialog"
          >
            <header className="assistant-panel-header">
              <span className="assistant-panel-icon" aria-hidden="true">
                <Bot size={18} />
              </span>
              <div>
                <strong>Ask AI</strong>
                <span>{currentTitle}</span>
              </div>
              <button
                type="button"
                aria-label="Close assistant"
                onClick={() => setIsAssistantOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="assistant-messages">
              {assistantStatus === "unconfigured" ? (
                <div className="assistant-notice">
                  Add <code>OPENAI_API_KEY</code> to enable AI chat. Search is
                  still available.
                </div>
              ) : null}

              {messages.length === 0 && assistantStatus !== "unconfigured" ? (
                <div className="assistant-empty">
                  {siteConfig.assistant.emptyState}
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className="assistant-message"
                    data-role={message.role}
                    data-error={message.error || undefined}
                  >
                    <div className="assistant-message-bubble">
                      {renderAssistantText(
                        message.content || (isAsking ? "Thinking..." : ""),
                      )}
                    </div>
                    {message.sources && message.sources.length > 0 ? (
                      <div className="assistant-sources">
                        {message.sources.map((source) => (
                          <Link key={source.id} href={sourceHref(source)}>
                            <span>
                              {source.title}
                              {source.section !== source.title
                                ? ` / ${source.section}`
                                : ""}
                            </span>
                            <ArrowUpRight size={13} aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="assistant-form" onSubmit={handleAssistantSubmit}>
              <textarea
                ref={assistantInputRef}
                value={draft}
                disabled={assistantStatus === "unconfigured" || isAsking}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Ask a question"
                rows={3}
              />
              <button
                type="submit"
                aria-label="Send question"
                disabled={
                  assistantStatus === "unconfigured" ||
                  isAsking ||
                  draft.trim().length === 0
                }
              >
                {isAsking ? (
                  <Loader2
                    className="assistant-loader"
                    size={18}
                    aria-hidden="true"
                  />
                ) : (
                  <Send size={18} aria-hidden="true" />
                )}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function rankSearchResults(
  entries: SearchEntry[],
  query: string,
  currentSlug: string,
) {
  const normalizedQuery = normalizeText(query);
  const tokens = normalizedQuery
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1);

  if (!normalizedQuery || tokens.length === 0) {
    return [];
  }

  return entries
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, normalizedQuery, tokens, currentSlug),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

function scoreEntry(
  entry: SearchEntry,
  query: string,
  tokens: string[],
  currentSlug: string,
) {
  const title = normalizeText(entry.title);
  const section = normalizeText(entry.section);
  const description = normalizeText(entry.description);
  const body = normalizeText(entry.searchText);
  let score = 0;

  if (title.includes(query)) score += 120;
  if (section.includes(query)) score += 90;
  if (description.includes(query)) score += 60;
  if (body.includes(query)) score += 35;

  for (const token of tokens) {
    if (title.includes(token)) score += 28;
    if (section.includes(token)) score += 22;
    if (description.includes(token)) score += 12;
    if (body.includes(token)) score += 5;
  }

  if (entry.kind === "page") score += 4;
  if (entry.slug === currentSlug) score += 12;

  return score;
}

async function readAssistantStream(
  response: Response,
  assistantId: string,
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>,
) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("The assistant response was empty.");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      const event = parseServerSentEvent(eventText);

      if (!event) {
        continue;
      }

      if (event.event === "delta" && typeof event.data === "string") {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: `${message.content}${event.data}` }
              : message,
          ),
        );
      }

      if (event.event === "sources" && Array.isArray(event.data)) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, sources: event.data as SearchSource[] }
              : message,
          ),
        );
      }

      if (event.event === "error" && typeof event.data === "string") {
        throw new Error(event.data);
      }
    }
  }
}

function parseServerSentEvent(value: string):
  | {
      event: string;
      data: unknown;
    }
  | null {
  const eventLine = value
    .split("\n")
    .find((line) => line.startsWith("event: "));
  const dataLine = value.split("\n").find((line) => line.startsWith("data: "));

  if (!eventLine || !dataLine) {
    return null;
  }

  try {
    return {
      event: eventLine.slice("event: ".length),
      data: JSON.parse(dataLine.slice("data: ".length)),
    };
  } catch {
    return null;
  }
}

function resultHref(result: SearchEntry): string {
  return `${result.route}${result.anchor ? `#${result.anchor}` : ""}`;
}

function sourceHref(source: SearchSource): string {
  return `${source.route}${source.anchor ? `#${source.anchor}` : ""}`;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? String(Date.now());
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function renderAssistantText(value: string) {
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let listKind: "ol" | "ul" = "ul";

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    const text = paragraphLines.join(" ").trim();

    if (text) {
      blocks.push(
        <p key={`p-${blocks.length}`}>{renderInlineMarkdown(text)}</p>,
      );
    }

    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    const items = listItems.map((item, index) => (
      <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
    ));

    blocks.push(
      listKind === "ol" ? (
        <ol key={`ol-${blocks.length}`}>{items}</ol>
      ) : (
        <ul key={`ul-${blocks.length}`}>{items}</ul>
      ),
    );

    listItems = [];
  };

  for (const line of value.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);

    if (unordered || ordered) {
      flushParagraph();

      const nextListKind = ordered ? "ol" : "ul";

      if (listItems.length > 0 && listKind !== nextListKind) {
        flushList();
      }

      listKind = nextListKind;
      listItems.push((ordered || unordered)?.[1] ?? "");
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks.length > 0 ? blocks : null;
}

function renderInlineMarkdown(value: string) {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={`${part}-${index}`}>{part.slice(1, -1)}</code>;
    }

    return part;
  });
}
