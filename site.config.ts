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

export type ApiConfigValue =
  | string
  | string[]
  | {
      source?: string;
      directory?: string;
      [key: string]: unknown;
    }
  | Array<{
      source?: string;
      directory?: string;
      [key: string]: unknown;
    }>;

export type NavigationEntry = string | NavigationNode;

export type NavigationNode = {
  page?: string;
  href?: string;
  url?: string;
  link?: string;
  label?: string;
  title?: string;
  group?: string;
  tab?: string;
  anchor?: string;
  dropdown?: string;
  menu?: string;
  version?: string;
  language?: string;
  icon?: string;
  tag?: string;
  expanded?: boolean;
  external?: boolean;
  pages?: NavigationEntry[];
  groups?: NavigationNode[];
  tabs?: NavigationNode[];
  anchors?: NavigationNode[];
  dropdowns?: NavigationNode[];
  menus?: NavigationNode[];
  versions?: NavigationNode[];
  languages?: NavigationNode[];
  openapi?: ApiConfigValue;
  asyncapi?: ApiConfigValue;
  [key: string]: unknown;
};

export type HeaderLink = {
  label: string;
  href: string;
  external?: boolean;
  icon?: string;
  children?: HeaderLink[];
};

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
  navigation: NavigationNode;
  api?: {
    openapi?: ApiConfigValue;
    asyncapi?: ApiConfigValue;
    playground?: {
      enabled: boolean;
      route: string;
      title: string;
    };
  };
  banner?: {
    content: string;
    dismissible?: boolean;
  };
  header: {
    links: HeaderLink[];
  };
  repository?: {
    editUrl?: string;
  };
  feedback: {
    enabled: boolean;
    endpoint?: string;
  };
  analytics: {
    enabled: boolean;
    scriptUrl?: string;
    websiteId?: string;
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
  voiceAssistant: {
    enabled: boolean;
    provider: "openai-realtime";
    label: string;
    sessionEndpoint: string;
    defaultModel: string;
    voices: {
      female: string;
      male: string;
    };
    unavailableMessage: string;
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
        icon: "rocket",
        pages: [
          { page: "index", icon: "home" },
          { page: "getting-started", icon: "terminal", tag: "Start" },
        ],
      },
      {
        group: "Build your docs",
        icon: "file-text",
        pages: [
          { page: "write-content", icon: "pencil" },
          { page: "customize-site", icon: "settings-2" },
          {
            group: "AI-native",
            icon: "sparkles",
            pages: [
              { page: "search-ai-and-mcp", icon: "bot" },
              { page: "ai-resources", icon: "brain-circuit", tag: "AI" },
            ],
          },
        ],
      },
      {
        group: "Reference",
        icon: "braces",
        pages: [
          { page: "component-gallery", icon: "blocks" },
          { page: "reference-demo", icon: "book-open" },
        ],
      },
      {
        group: "Ship and maintain",
        icon: "ship",
        pages: [
          { page: "deploy-to-vercel", icon: "cloud" },
          { page: "quality-checklist", icon: "list-checks", tag: "Ops" },
          { page: "troubleshooting", icon: "circle-help" },
          { page: "contributing", icon: "git-pull-request" },
          {
            label: "Next.js docs",
            href: "https://nextjs.org/docs",
            icon: "external-link",
            tag: "External",
          },
        ],
      },
      {
        group: "API reference",
        icon: "route",
        openapi: "examples/openapi.json",
        asyncapi: "examples/asyncapi.yaml",
      },
    ],
  },
  header: {
    links: [
      {
        label: "Guides",
        href: "/getting-started",
        children: [
          { label: "Write content", href: "/write-content" },
          { label: "Customize", href: "/customize-site" },
        ],
      },
      {
        label: "Reference",
        href: "/reference-demo",
        children: [
          { label: "Components", href: "/component-gallery" },
          { label: "API playground", href: "/api-reference" },
        ],
      },
      {
        label: "AI",
        href: "/search-ai-and-mcp",
        children: [
          { label: "AI resources", href: "/ai-resources" },
          { label: "MCP endpoint", href: "/mcp" },
        ],
      },
      { label: "Deploy", href: "/deploy-to-vercel", icon: "cloud" },
    ],
  },
  api: {
    openapi: "examples/openapi.json",
    asyncapi: "examples/asyncapi.yaml",
    playground: {
      enabled: true,
      route: "/api-reference",
      title: "API playground",
    },
  },
  repository: {
    editUrl: process.env.NEXT_PUBLIC_DOCS_EDIT_URL,
  },
  feedback: {
    enabled: true,
    endpoint: process.env.NEXT_PUBLIC_DOCS_FEEDBACK_ENDPOINT,
  },
  analytics: {
    enabled: process.env.NEXT_PUBLIC_DOCS_ANALYTICS === "true",
    scriptUrl: process.env.NEXT_PUBLIC_DOCS_ANALYTICS_SCRIPT_URL,
    websiteId: process.env.NEXT_PUBLIC_DOCS_ANALYTICS_WEBSITE_ID,
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
  voiceAssistant: {
    enabled: process.env.NEXT_PUBLIC_DOCS_VOICE_ASSISTANT === "true",
    provider: "openai-realtime",
    label: "Talk to docs",
    sessionEndpoint: "/api/voice/session",
    defaultModel: process.env.NEXT_PUBLIC_OPENAI_REALTIME_MODEL || "gpt-realtime",
    voices: {
      female: process.env.NEXT_PUBLIC_OPENAI_REALTIME_VOICE_FEMALE || "marin",
      male: process.env.NEXT_PUBLIC_OPENAI_REALTIME_VOICE_MALE || "cedar",
    },
    unavailableMessage:
      "Voice chat is disabled. Set NEXT_PUBLIC_DOCS_VOICE_ASSISTANT=true and add OPENAI_API_KEY to enable it.",
  },
};

export function getSiteUrl() {
  return normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url);
}

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "");
}
