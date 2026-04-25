import { getAllPages } from "@/lib/docs";
import { getPageMarkdown } from "@/lib/markdown";
import { slugify } from "@/lib/slug";
import type { SearchEntry, SearchSource } from "@/lib/search-types";

type RankedSearchEntry = SearchEntry & {
  score: number;
};

type SearchOptions = {
  currentSlug?: string;
  limit?: number;
};

let cachedSearchIndex: SearchEntry[] | null = null;

export function getSearchIndex(): SearchEntry[] {
  if (!cachedSearchIndex) {
    cachedSearchIndex = buildSearchIndex();
  }

  return cachedSearchIndex;
}

export function searchDocs(
  query: string,
  { currentSlug, limit = 8 }: SearchOptions = {},
): RankedSearchEntry[] {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(normalizedQuery);

  if (!normalizedQuery || tokens.length === 0) {
    return [];
  }

  return getSearchIndex()
    .map((entry) => ({
      ...entry,
      score: scoreEntry(entry, normalizedQuery, tokens, currentSlug),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function toSearchSource(entry: SearchEntry): SearchSource {
  return {
    id: entry.id,
    title: entry.title,
    section: entry.section,
    route: entry.route,
    anchor: entry.anchor,
    snippet: entry.snippet,
  };
}

function buildSearchIndex(): SearchEntry[] {
  return getAllPages().flatMap((page) => {
    const pageMarkdown = getPageMarkdown(page);
    const sections = splitIntoSections(page.content);
    const pageText = stripMdxToText(pageMarkdown);
    const entries: SearchEntry[] = [
      {
        id: `${page.slug}:page`,
        slug: page.slug,
        title: page.title,
        section: page.title,
        route: page.route,
        anchor: "",
        description: page.description,
        snippet: makeSnippet(page.description || pageText),
        searchText: joinSearchText(page.title, page.description, pageText),
        kind: "page",
      },
    ];

    for (const section of sections) {
      const text = stripMdxToText(section.content);

      if (!text) {
        continue;
      }

      entries.push({
        id: `${page.slug}:${section.anchor}`,
        slug: page.slug,
        title: page.title,
        section: section.title,
        route: page.route,
        anchor: section.anchor,
        description: page.description,
        snippet: makeSnippet(text),
        searchText: joinSearchText(
          page.title,
          section.title,
          page.description,
          text,
        ),
        kind: "section",
      });
    }

    return entries;
  });
}

function splitIntoSections(content: string): Array<{
  title: string;
  anchor: string;
  content: string;
}> {
  const sections: Array<{
    title: string;
    anchor: string;
    content: string[];
  }> = [];
  let current: (typeof sections)[number] | null = null;
  let inFence = false;

  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
    }

    const heading = !inFence ? /^(#{2,3})\s+(.+)$/.exec(line) : null;

    if (heading) {
      const title = heading[2].replace(/\s+#$/, "").trim();
      current = {
        title,
        anchor: slugify(title),
        content: [],
      };
      sections.push(current);
      continue;
    }

    current?.content.push(line);
  }

  return sections.map((section) => ({
    title: section.title,
    anchor: section.anchor,
    content: section.content.join("\n"),
  }));
}

function scoreEntry(
  entry: SearchEntry,
  normalizedQuery: string,
  tokens: string[],
  currentSlug?: string,
): number {
  const title = normalizeText(entry.title);
  const section = normalizeText(entry.section);
  const description = normalizeText(entry.description);
  const body = normalizeText(entry.searchText);
  let score = 0;

  if (title.includes(normalizedQuery)) score += 120;
  if (section.includes(normalizedQuery)) score += 90;
  if (description.includes(normalizedQuery)) score += 60;
  if (body.includes(normalizedQuery)) score += 35;

  for (const token of tokens) {
    if (title.includes(token)) score += 28;
    if (section.includes(token)) score += 22;
    if (description.includes(token)) score += 12;
    if (body.includes(token)) score += 5;
  }

  if (entry.kind === "page") {
    score += 4;
  }

  if (currentSlug && entry.slug === currentSlug) {
    score += 12;
  }

  return score;
}

function stripMdxToText(value: string): string {
  return decodeMdxStringExpressions(value)
    .replace(/```([\s\S]*?)```/g, (_, code: string) => ` ${code} `)
    .replace(
      /<(ParamField|ResponseField)\b([^>]*)>/g,
      (_, _component: string, attrs: string) => {
        const name = /name="([^"]+)"/.exec(attrs)?.[1] ?? "";
        const type = /type="([^"]+)"/.exec(attrs)?.[1] ?? "";
        return ` ${name} ${type} `;
      },
    )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[>*_`{}[\]#]/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function joinSearchText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function makeSnippet(value: string): string {
  const text = stripMdxToText(value).replace(/\s+/g, " ").trim();

  if (text.length <= 220) {
    return text;
  }

  return `${text.slice(0, 217).trim()}...`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenize(value: string): string[] {
  return value
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
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
