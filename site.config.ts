export type ThemePreference = "system" | "light" | "dark";

export type ContextualOption =
  | "copy"
  | "view"
  | "assistant"
  | "chatgpt"
  | "claude"
  | "perplexity"
  | "grok"
  | "aistudio"
  | "devin"
  | "windsurf"
  | "mcp"
  | "add-mcp"
  | "cursor"
  | "vscode"
  | "devin-mcp";

export type SiteConfig = {
  name: string;
  shortName: string;
  description: string;
  url: string;
  metadata: {
    title: {
      default: string;
      template: string;
    };
    description: string;
  };
  theme: {
    default: ThemePreference;
    storageKey: string;
    cookieName: string;
    colors: {
      light: string;
      dark: string;
    };
  };
  logo: {
    mark: string;
  };
  navigation: {
    groups: Array<{
      group: string;
      pages: string[];
    }>;
  };
  api?: {
    openapi?: string | string[];
    asyncapi?: string | string[];
  };
  banner?: {
    content: string;
    dismissible?: boolean;
  };
  header: {
    links: Array<{
      label: string;
      href: string;
    }>;
  };
  contextual: {
    options: ContextualOption[];
    display: "header" | "page";
  };
  assistant: {
    name: string;
    emptyState: string;
    defaultModel: string;
    noSourcesMessage: string;
    unavailableMessage: string;
    supportPath: string;
  };
  mcp: {
    name: string;
    route: string;
  };
};

const configuredUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const siteConfig: SiteConfig = {
  name: "Next.js Docs Starter",
  shortName: "Docs Starter",
  description:
    "A reusable documentation starter built with Next.js and ready to deploy on Vercel.",
  url: normalizeUrl(configuredUrl),
  metadata: {
    title: {
      default: "Next.js Docs Starter",
      template: "%s | Next.js Docs Starter",
    },
    description:
      "Launch a free, customizable documentation site with Next.js and Vercel.",
  },
  theme: {
    default: "system",
    storageKey: "docs_starter_theme",
    cookieName: "docs_starter_theme",
    colors: {
      light: "#F5F5F5",
      dark: "#000000",
    },
  },
  logo: {
    mark: "/logo/docs-mark.svg",
  },
  navigation: {
    groups: [
      {
        group: "Start here",
        pages: ["index", "getting-started"],
      },
      {
        group: "Build your docs",
        pages: ["write-content", "customize-site", "search-ai-and-mcp"],
      },
      {
        group: "Demo data",
        pages: ["component-gallery", "reference-demo"],
      },
      {
        group: "Ship and maintain",
        pages: ["deploy-to-vercel", "troubleshooting", "contributing"],
      },
    ],
  },
  header: {
    links: [
      { label: "Start", href: "/getting-started" },
      { label: "Customize", href: "/customize-site" },
      { label: "Demo", href: "/component-gallery" },
      { label: "Deploy", href: "/deploy-to-vercel" },
    ],
  },
  api: {
    openapi: "examples/openapi.json",
    asyncapi: "examples/asyncapi.yaml",
  },
  contextual: {
    options: [
      "copy",
      "view",
      "assistant",
      "chatgpt",
      "claude",
      "perplexity",
      "grok",
      "aistudio",
      "devin",
      "windsurf",
      "mcp",
      "add-mcp",
      "cursor",
      "vscode",
      "devin-mcp",
    ],
    display: "header",
  },
  assistant: {
    name: "Docs assistant",
    emptyState:
      "Ask about these docs, this starter codebase, deployment, or current web context.",
    defaultModel: "gpt-5.4-mini",
    noSourcesMessage: "No relevant public documentation excerpts were found.",
    unavailableMessage:
      "The AI assistant is not configured yet. Add OPENAI_API_KEY to enable chat.",
    supportPath: "/troubleshooting",
  },
  mcp: {
    name: "Next.js Docs Starter",
    route: "/mcp",
  },
};

export function getSiteUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url);
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}
