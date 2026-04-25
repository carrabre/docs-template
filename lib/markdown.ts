import type { DocsConfig, NavGroup, Page } from "@/lib/docs";
import { normalizeDocSlug, routeForSlug } from "@/lib/docs";
import { DOCS_ORIGIN } from "@/lib/contextual";

export function sourceUrlForSlug(slug: string): string {
  return `${DOCS_ORIGIN}${routeForSlug(slug)}`;
}

export function markdownPathForSlug(slug: string): string {
  return slug === "index"
    ? "/api/markdown/index.md"
    : `/api/markdown/${slug}.md`;
}

export function markdownUrlForSlug(slug: string): string {
  return `${DOCS_ORIGIN}${markdownPathForSlug(slug)}`;
}

export function slugFromMarkdownSegments(segments: string[]): string {
  const markdownSegments =
    segments.at(-1) === "md" ? segments.slice(0, -1) : segments;
  const rawPath = markdownSegments.join("/");
  const withoutExtension = rawPath.endsWith(".md")
    ? rawPath.slice(0, -".md".length)
    : rawPath;

  return normalizeDocSlug(withoutExtension || "index") ?? "";
}

export function getPageMarkdown(page: Page): string {
  const body = normalizePageContent(page.content);
  const header = [
    `# ${page.title}`,
    page.description ? `> ${page.description}` : "",
    `Source: ${sourceUrlForSlug(page.slug)}`,
  ].filter(Boolean);

  return `${[...header, body].join("\n\n").trim()}\n`;
}

export function getLlmsTxt(config: DocsConfig, navGroups: NavGroup[]): string {
  const lines = [`# ${config.name}`];

  if (config.description) {
    lines.push("", `> ${config.description}`);
  }

  for (const group of navGroups) {
    lines.push("", `## ${group.group}`, "");

    for (const page of group.pages) {
      const description = summarizeDescription(page.description);
      const suffix = description ? `: ${description}` : "";
      lines.push(
        `- [${page.title}](${markdownUrlForSlug(page.slug)})${suffix}`,
      );
    }
  }

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function getLlmsFullTxt(config: DocsConfig, pages: Page[]): string {
  const intro = [`# ${config.name}`];

  if (config.description) {
    intro.push("", `> ${config.description}`);
  }

  return `${[intro.join("\n"), ...pages.map(getPageMarkdown)]
    .join("\n\n---\n\n")
    .trim()}\n`;
}

function normalizePageContent(content: string): string {
  return content
    .split(/(```[\s\S]*?```)/g)
    .map((part) => (part.startsWith("```") ? part : normalizeMdxPart(part)))
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeMdxPart(content: string): string {
  let next = decodeMdxStringExpressions(content);
  const inlineCode: string[] = [];

  next = next.replace(/`([^`\n]+)`/g, (_, code: string) => {
    const index = inlineCode.push(code) - 1;
    return `@@DOCS_INLINE_CODE_${index}@@`;
  });

  next = next.replace(
    /<Visibility\b([^>]*)>\s*([\s\S]*?)\s*<\/Visibility>/g,
    (_, attrs: string, body: string) => {
      const audience = getAttribute(attrs, "for");

      if (audience === "agents") {
        return `${normalizePageContent(body)}\n`;
      }

      if (audience === "humans") {
        return "";
      }

      return `${normalizePageContent(body)}\n`;
    },
  );

  next = next.replace(
    /<Tabs\b[^>]*>\s*([\s\S]*?)\s*<\/Tabs>/g,
    (_, body: string) => normalizeTabs(body),
  );

  next = next.replace(
    /<CodeGroup\b[^>]*>\s*([\s\S]*?)\s*<\/CodeGroup>/g,
    (_, body: string) => `${normalizePageContent(body)}\n`,
  );

  next = next.replace(
    /<Card\b([\s\S]*?)>\s*([\s\S]*?)\s*<\/Card>/g,
    (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "Related page";
      const href = getAttribute(attrs, "href");
      const bodyText = cleanInlineText(body);
      const label = href
        ? `[${title}](${absoluteDocsUrl(href)})`
        : `**${title}**`;

      return `- ${label}${bodyText ? `: ${bodyText}` : ""}\n`;
    },
  );

  next = next.replace(
    /<Tile\b([\s\S]*?)>\s*([\s\S]*?)\s*<\/Tile>/g,
    (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "Related page";
      const href = getAttribute(attrs, "href");
      const bodyText = cleanInlineText(body);
      const label = href
        ? `[${title}](${absoluteDocsUrl(href)})`
        : `**${title}**`;

      return `- ${label}${bodyText ? `: ${bodyText}` : ""}\n`;
    },
  );

  next = next.replace(
    /<Prompt\b([^>]*)>\s*([\s\S]*?)\s*<\/Prompt>/g,
    (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "Prompt";
      const description = getAttribute(attrs, "description");
      const content = normalizePageContent(body);

      return `\n### ${title}\n\n${description ? `${description}\n\n` : ""}${content}\n`;
    },
  );

  next = next.replace(
    /<View\b([^>]*)>\s*([\s\S]*?)\s*<\/View>/g,
    (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "View";
      return `\n### ${title}\n\n${normalizePageContent(body)}\n`;
    },
  );

  next = next.replace(
    /<Color\b[^>]*>\s*([\s\S]*?)\s*<\/Color>/g,
    (_, body: string) => normalizeColor(body),
  );

  next = next.replace(
    /<Tree\b[^>]*>\s*([\s\S]*?)\s*<\/Tree>/g,
    (_, body: string) => normalizeTree(body),
  );

  next = next
    .replace(/<\/?(Columns|Column|CardGroup)\b[^>]*>/g, "")
    .replace(/<\/?Panel\b[^>]*>/g, "")
    .replace(/<\/?Frame\b[^>]*>/g, "");

  next = next.replace(
    /<(Warning|Note|Info|Tip|Check|Danger|Banner|Update|Callout)\b([^>]*)>\s*([\s\S]*?)\s*<\/\1>/g,
    (_, variant: string, attrs: string, body: string) => {
      const label =
        getAttribute(attrs, "label") ??
        getAttribute(attrs, "title") ??
        (variant === "Callout" ? getAttribute(attrs, "type") ?? "Callout" : variant);
      const description = getAttribute(attrs, "description");
      const text = [description, cleanInlineText(body)].filter(Boolean).join(" ");

      return `> **${label}:** ${text}\n`;
    },
  );

  next = next.replace(
    /<(Accordion|Expandable)\b([^>]*)>\s*([\s\S]*?)\s*<\/\1>/g,
    (_, _component: string, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "Details";
      return `\n### ${title}\n\n${normalizePageContent(body)}\n`;
    },
  );

  next = next.replace(/<\/?AccordionGroup\b[^>]*>/g, "");

  next = next.replace(
    /<Steps\b[^>]*>\s*([\s\S]*?)\s*<\/Steps>/g,
    (_, body: string) => normalizeSteps(body),
  );

  next = next.replace(
    /<(ParamField|ResponseField)\b([^>]*)>\s*([\s\S]*?)\s*<\/\1>/g,
    (_, _component: string, attrs: string, body: string) => {
      const name =
        getAttribute(attrs, "name") ??
        getAttribute(attrs, "path") ??
        getAttribute(attrs, "query") ??
        getAttribute(attrs, "body") ??
        getAttribute(attrs, "header") ??
        "field";
      const type = getAttribute(attrs, "type");
      const required = /\srequired(?:\s|>|$)/.test(attrs) ? ", required" : "";
      const deprecated = /\sdeprecated(?:\s|>|$)/.test(attrs)
        ? ", deprecated"
        : "";
      const defaultValue = getAttribute(attrs, "default");
      const placeholder = getAttribute(attrs, "placeholder");
      const metadata = [
        type,
        required.replace(/^, /, ""),
        deprecated.replace(/^, /, ""),
        defaultValue ? `default: ${defaultValue}` : "",
        placeholder ? `placeholder: ${placeholder}` : "",
      ].filter(Boolean);
      const typeLabel = metadata.length > 0 ? ` (${metadata.join(", ")})` : "";

      return `- \`${name}\`${typeLabel}: ${cleanInlineText(body)}\n`;
    },
  );

  next = next.replace(
    /<(RequestExample|ResponseExample)\b[^>]*>\s*([\s\S]*?)\s*<\/\1>/g,
    (_, component: string, body: string) => {
      const label =
        component === "RequestExample" ? "Request example" : "Response example";
      return `\n### ${label}\n\n${normalizePageContent(body)}\n`;
    },
  );

  next = next.replace(
    /<Badge\b[^>]*>\s*([\s\S]*?)\s*<\/Badge>/g,
    (_, body: string) => `**${cleanInlineText(body)}**`,
  );

  next = next.replace(
    /<Tooltip\b([^>]*)>\s*([\s\S]*?)\s*<\/Tooltip>/g,
    (_, attrs: string, body: string) => {
      const tip = getAttribute(attrs, "tip") ?? getAttribute(attrs, "content");
      const text = cleanInlineText(body);
      return tip ? `${text} (${tip})` : text;
    },
  );

  next = next.replace(
    /<Icon\b([^>]*)\/>/g,
    (_, attrs: string) => {
      const icon = getAttribute(attrs, "icon") ?? getAttribute(attrs, "name");
      return icon ? `\`${icon}\`` : "";
    },
  );

  next = next.replace(
    /<Mermaid\b([^>]*)\/>/g,
    (_, attrs: string) => {
      const code = getAttribute(attrs, "code") ?? "";
      return code ? `\n\`\`\`mermaid\n${code}\n\`\`\`\n` : "";
    },
  );

  next = next.replace(
    /<a\b[^>]*href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>/g,
    (_, href: string, body: string) => {
      return `[${cleanInlineText(body)}](${absoluteDocsUrl(href)})`;
    },
  );

  next = next.replace(
    /<p\b[^>]*>\s*([\s\S]*?)\s*<\/p>/g,
    (_, body: string) => `${cleanInlineText(body)}\n\n`,
  );

  next = next
    .replace(/<\/?div\b[^>]*>/g, "")
    .replace(/<\/?span\b[^>]*>/g, "")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\]\((\/[^)]+)\)/g, (_, href: string) => {
      return `](${absoluteDocsUrl(href)})`;
    });

  return restoreInlineCode(decodeHtmlEntities(next), inlineCode);
}

function normalizeTabs(value: string): string {
  return value.replace(
    /<Tab\b([^>]*)>\s*([\s\S]*?)\s*<\/Tab>/g,
    (_, attrs: string, body: string) => {
      const title = getAttribute(attrs, "title") ?? "Tab";
      return `\n### ${title}\n\n${normalizePageContent(body)}\n`;
    },
  );
}

function normalizeSteps(value: string): string {
  let index = 0;

  return value.replace(
    /<Step\b([^>]*)>\s*([\s\S]*?)\s*<\/Step>/g,
    (_, attrs: string, body: string) => {
      index += 1;
      const title = getAttribute(attrs, "title");
      const text = cleanInlineText(body);
      return `${index}. ${title ? `${title}: ` : ""}${text}\n`;
    },
  );
}

function normalizeColor(value: string): string {
  return value
    .replace(/<\/?Color.Row\b[^>]*>/g, "")
    .replace(
      /<Color.Item\b([^>]*)>\s*([\s\S]*?)\s*<\/Color.Item>/g,
      (_, attrs: string, body: string) => {
        const name = getAttribute(attrs, "name") ?? "Color";
        const color = getAttribute(attrs, "value") ?? getAttribute(attrs, "color");
        const description = cleanInlineText(body);
        return `- ${name}${color ? `: \`${color}\`` : ""}${description ? ` - ${description}` : ""}\n`;
      },
    );
}

function normalizeTree(value: string): string {
  return value
    .replace(/<Tree.Folder\b([^>]*)>/g, (_, attrs: string) => {
      const name = getAttribute(attrs, "name") ?? "folder";
      return `- ${name}/\n`;
    })
    .replace(/<\/Tree.Folder>/g, "")
    .replace(/<Tree.File\b([^>]*)\/>/g, (_, attrs: string) => {
      const name = getAttribute(attrs, "name") ?? "file";
      return `- ${name}\n`;
    });
}

function cleanInlineText(value: string): string {
  return decodeHtmlEntities(
    decodeMdxStringExpressions(value)
      .replace(/<\/?[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function getAttribute(attrs: string, name: string): string | null {
  const match = new RegExp(`${name}="([^"]+)"`).exec(attrs);
  return match?.[1] ?? null;
}

function absoluteDocsUrl(value: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value;
  }

  if (value.startsWith("#")) {
    return `${DOCS_ORIGIN}${value}`;
  }

  return `${DOCS_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

function decodeMdxStringExpressions(value: string): string {
  return value.replace(/\{"((?:[^"\\]|\\.)*)"\}/g, (_, encoded: string) => {
    try {
      return JSON.parse(`"${encoded}"`) as string;
    } catch {
      return encoded;
    }
  });
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function restoreInlineCode(value: string, inlineCode: string[]): string {
  return value.replace(
    /@@DOCS_INLINE_CODE_(\d+)@@/g,
    (match: string, index: string) => {
      const code = inlineCode[Number(index)];
      return code === undefined ? match : `\`${code}\``;
    },
  );
}

function summarizeDescription(description: string): string {
  return description.replace(/\s+/g, " ").trim().slice(0, 300);
}
