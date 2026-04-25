"use client";

import {
  Bot,
  Check,
  Code,
  Copy,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  MessageCircle,
  MoreHorizontal,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  MCP_INSTALL_COMMAND,
  MCP_SERVER_NAME,
  MCP_SERVER_URL,
} from "@/lib/contextual";
import { siteConfig, type ContextualOption } from "@/site.config";

type PageContextMenuProps = {
  markdown: string;
  markdownUrl: string;
  pageTitle: string;
  pageUrl: string;
};

type Provider =
  | "assistant"
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "grok"
  | "aistudio"
  | "devin"
  | "windsurf";

const PROVIDERS: Array<{
  id: Provider;
  label: string;
  description: string;
  icon: LucideIcon;
  url: string | ((prompt: string) => string);
}> = [
  {
    id: "assistant",
    label: "Ask assistant",
    description: "Copy this page as context for an assistant.",
    icon: Bot,
    url: "",
  },
  {
    id: "chatgpt",
    label: "Open in ChatGPT",
    description: "Start a ChatGPT prompt with this page.",
    icon: MessageCircle,
    url: (prompt) => `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "claude",
    label: "Open in Claude",
    description: "Start a Claude prompt with this page.",
    icon: MessageCircle,
    url: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "perplexity",
    label: "Open in Perplexity",
    description: "Search with this page as context.",
    icon: Search,
    url: (prompt) =>
      `https://www.perplexity.ai/search/new?q=${encodeURIComponent(prompt)}`,
  },
  {
    id: "grok",
    label: "Open in Grok",
    description: "Copy context, then open Grok.",
    icon: MessageCircle,
    url: "https://grok.com/",
  },
  {
    id: "aistudio",
    label: "Open in Google AI Studio",
    description: "Copy context, then open AI Studio.",
    icon: Bot,
    url: "https://aistudio.google.com/app/prompts/new_chat",
  },
  {
    id: "devin",
    label: "Open in Devin",
    description: "Copy context, then open Devin.",
    icon: Terminal,
    url: "https://app.devin.ai/",
  },
  {
    id: "windsurf",
    label: "Open in Windsurf",
    description: "Copy context, then open Windsurf.",
    icon: Code,
    url: "https://windsurf.com/",
  },
];

export function PageContextMenu({
  markdown,
  markdownUrl,
  pageTitle,
  pageUrl,
}: PageContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!status) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatus("");
    }, 2400);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [status]);

  async function handleCopyPage() {
    setStatus(await copyToClipboard(markdown, "Copied page"));
  }

  async function handleCopyMcpUrl() {
    setStatus(await copyToClipboard(MCP_SERVER_URL, "Copied MCP URL"));
    setIsOpen(false);
  }

  async function handleCopyMcpCommand() {
    setStatus(
      await copyToClipboard(MCP_INSTALL_COMMAND, "Copied install command"),
    );
    setIsOpen(false);
  }

  async function handleProvider(provider: (typeof PROVIDERS)[number]) {
    const prompt = buildProviderPrompt(markdown, pageTitle, pageUrl);
    const url =
      typeof provider.url === "function" ? provider.url(prompt) : provider.url;

    setStatus(await copyToClipboard(markdown, "Copied page context"));
    setIsOpen(false);

    if (!url) {
      return;
    }

    openUrl(url);
  }

  function handleViewMarkdown() {
    setIsOpen(false);
    openUrl(markdownUrl);
  }

  function handleCursorInstall() {
    setIsOpen(false);
    window.location.href = getCursorInstallUrl();
  }

  function handleVsCodeInstall() {
    setIsOpen(false);
    window.location.href = getVsCodeInstallUrl();
  }

  async function handleDevinMcp() {
    const popup = window.open("", "_blank");

    setStatus(
      await copyToClipboard(MCP_SERVER_URL, "Copied MCP URL for Devin"),
    );
    setIsOpen(false);

    if (popup) {
      popup.opener = null;
      popup.location.href = "https://app.devin.ai/";
    }
  }

  return (
    <div className="page-context-actions" ref={menuRef}>
      {hasContextOption("copy") ? (
        <button
          type="button"
          className="page-action-button page-action-button-primary"
          onClick={handleCopyPage}
        >
          {status === "Copied page" ? (
            <Check size={16} aria-hidden="true" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
          <span>Copy page</span>
        </button>
      ) : null}

      <div className="page-context-menu">
        <button
          type="button"
          className="page-action-button page-action-icon-button"
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label="Open page actions"
          onClick={() => setIsOpen((current) => !current)}
        >
          <MoreHorizontal size={18} aria-hidden="true" />
        </button>

        {isOpen ? (
          <div id={menuId} className="page-context-popover" role="menu">
            {hasContextOption("view") ? (
              <ActionButton
                icon={FileText}
                label="View as Markdown"
                description="Open this page as Markdown."
                onClick={handleViewMarkdown}
              />
            ) : null}
            {PROVIDERS.filter((provider) =>
              hasContextOption(provider.id),
            ).map((provider) => (
              <ActionButton
                key={provider.id}
                icon={provider.icon}
                label={provider.label}
                description={provider.description}
                onClick={() => handleProvider(provider)}
              />
            ))}
            {hasAnyContextOption(["mcp", "add-mcp", "cursor", "vscode", "devin-mcp"]) ? (
              <div className="page-context-divider" />
            ) : null}
            {hasContextOption("mcp") ? (
              <ActionButton
                icon={LinkIcon}
                label="Copy MCP server URL"
                description={MCP_SERVER_URL}
                onClick={handleCopyMcpUrl}
              />
            ) : null}
            {hasContextOption("add-mcp") ? (
              <ActionButton
                icon={Terminal}
                label="Copy MCP install command"
                description={MCP_INSTALL_COMMAND}
                onClick={handleCopyMcpCommand}
              />
            ) : null}
            {hasContextOption("cursor") ? (
              <ActionButton
                icon={Code}
                label="Connect to Cursor"
                description={`Install the ${MCP_SERVER_NAME} MCP server in Cursor.`}
                onClick={handleCursorInstall}
              />
            ) : null}
            {hasContextOption("vscode") ? (
              <ActionButton
                icon={Code}
                label="Connect to VS Code"
                description={`Install the ${MCP_SERVER_NAME} MCP server in VS Code.`}
                onClick={handleVsCodeInstall}
              />
            ) : null}
            {hasContextOption("devin-mcp") ? (
              <ActionButton
                icon={ExternalLink}
                label="Connect to Devin"
                description="Copy the MCP URL, then open Devin."
                onClick={handleDevinMcp}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {status ? (
        <span className="page-context-status" role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}

function hasContextOption(option: ContextualOption) {
  return siteConfig.contextual.options.includes(option);
}

function hasAnyContextOption(options: ContextualOption[]) {
  return options.some(hasContextOption);
}

function ActionButton({
  description,
  icon: Icon,
  label,
  onClick,
}: {
  description: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="page-context-item"
      role="menuitem"
      onClick={onClick}
    >
      <span className="page-context-item-icon" aria-hidden="true">
        <Icon size={17} />
      </span>
      <span className="page-context-item-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
    </button>
  );
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopy(text);
    }

    return successMessage;
  } catch {
    try {
      fallbackCopy(text);
      return successMessage;
    } catch {
      return "Copy failed";
    }
  }
}

function fallbackCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function buildProviderPrompt(markdown: string, pageTitle: string, pageUrl: string) {
  const maxContextLength = 12000;
  const context =
    markdown.length > maxContextLength
      ? `${markdown.slice(
          0,
          maxContextLength,
        )}\n\n[Content truncated. Open ${pageUrl} for the full page.]`
      : markdown;

  return `Use this ${siteConfig.name} documentation page as context.\n\nPage: ${pageTitle}\nURL: ${pageUrl}\n\n${context}`;
}

function openUrl(url: string) {
  if (url.startsWith("http") || url.startsWith("/")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = url;
}

function getCursorInstallUrl(): string {
  const config = window.btoa(
    JSON.stringify({
      type: "http",
      url: MCP_SERVER_URL,
    }),
  );

  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(
    MCP_SERVER_NAME,
  )}&config=${encodeURIComponent(config)}`;
}

function getVsCodeInstallUrl(): string {
  const config = {
    name: MCP_SERVER_NAME,
    type: "http",
    url: MCP_SERVER_URL,
  };

  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}
