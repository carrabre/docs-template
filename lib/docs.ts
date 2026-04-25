import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";

import {
  getApiPageByReference,
  getApiPageBySlug,
  getApiPagesForSources,
  isApiReference,
  type ApiPage,
  type ApiSource,
} from "@/lib/api-specs";
import { slugify } from "@/lib/slug";
import { siteConfig, type SiteConfig } from "@/site.config";

export type Heading = {
  id: string;
  title: string;
  level: 2 | 3;
};

export type PageKind = "mdx" | "api" | "external";

export type PageMeta = {
  slug: string;
  route: string;
  filePath: string;
  title: string;
  sidebarTitle: string;
  description: string;
  mode?: string;
  kind?: PageKind;
  icon?: string;
  tag?: string;
  external?: boolean;
};

export type Page = PageMeta & {
  content: string;
  headings: Heading[];
};

export type NavGroup = {
  group: string;
  pages: PageMeta[];
};

export type DocsConfig = Omit<SiteConfig, "navigation"> & {
  navigation: NavigationNode;
  api?: {
    openapi?: ApiConfigValue;
    asyncapi?: ApiConfigValue;
    [key: string]: unknown;
  };
};

type Frontmatter = {
  title?: string;
  sidebarTitle?: string;
  description?: string;
  mode?: string;
};

type ApiConfigValue =
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

type NavigationEntry = string | NavigationNode;

type NavigationNode = {
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

type WalkContext = {
  apiSources: ApiSource[];
  configSources: ApiSource[];
  groups: NavGroup[];
  label: string;
};

const NAV_CONTAINER_KEYS = [
  "groups",
  "tabs",
  "anchors",
  "dropdowns",
  "menus",
  "versions",
  "languages",
] as const;

export function routeForSlug(slug: string): string {
  return slug === "index" ? "/" : `/${slug}`;
}

export function slugFromSegments(segments?: string[]): string {
  return normalizeDocSlug(
    !segments || segments.length === 0 ? "index" : segments.join("/"),
  ) ?? "";
}

export function normalizeDocSlug(value: string): string | null {
  const slug = value.trim().replace(/^\/+|\/+$/g, "") || "index";

  if (
    slug.split("/").some((segment) => !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(segment))
  ) {
    return null;
  }

  return slug;
}

export function getDocsConfig(): DocsConfig {
  return siteConfig as DocsConfig;
}

export function getPageMeta(slug: string): PageMeta | null {
  const safeSlug = normalizeDocSlug(slug);

  if (!safeSlug) {
    return null;
  }

  const apiPage = getApiPageBySlug(safeSlug, getApiSources(getDocsConfig()));

  if (apiPage) {
    return toApiMeta(apiPage);
  }

  const filePath = resolveProjectFile(`${safeSlug}.mdx`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const { data } = matter(raw);
  const frontmatter = data as Frontmatter;
  const title = frontmatter.title ?? titleFromSlug(safeSlug);

  return {
    slug: safeSlug,
    route: routeForSlug(safeSlug),
    filePath,
    title,
    sidebarTitle: frontmatter.sidebarTitle ?? title,
    description: frontmatter.description ?? "",
    mode: frontmatter.mode,
    kind: "mdx",
  };
}

export function getPage(slug: string): Page | null {
  const apiPage = getApiPageBySlug(slug, getApiSources(getDocsConfig()));

  if (apiPage) {
    return {
      ...toApiMeta(apiPage),
      content: apiPage.content,
      headings: extractHeadings(apiPage.content),
    };
  }

  const meta = getPageMeta(slug);

  if (!meta || meta.external || meta.kind === "api") {
    return null;
  }

  const raw = fs.readFileSync(meta.filePath, "utf8");
  const { content } = matter(raw);

  return {
    ...meta,
    content,
    headings: extractHeadings(content),
  };
}

export function getNavGroups(): NavGroup[] {
  const config = getDocsConfig();
  const configSources = getApiSources(config);
  const groups: NavGroup[] = [];

  if (config.navigation) {
    walkNavigation({
      apiSources: [],
      configSources,
      groups,
      label: "Guide",
    }, config.navigation);
  }

  const sourceBackedSlugs = new Set(
    groups
      .flatMap((group) => group.pages)
      .filter((page) => !page.external)
      .map((page) => page.slug),
  );
  const missingApiPages = getApiPagesForSources(configSources)
    .map(toApiMeta)
    .filter((page) => !sourceBackedSlugs.has(page.slug));

  if (missingApiPages.length > 0) {
    groups.push({
      group: "API reference",
      pages: missingApiPages,
    });
  }

  if (groups.length === 0) {
    groups.push({
      group: "Guide",
      pages: getAllMdxPageMeta(),
    });
  }

  return groups
    .map((group) => ({
      ...group,
      pages: dedupePages(group.pages),
    }))
    .filter((group) => group.pages.length > 0);
}

export function getAllPageMeta(): PageMeta[] {
  const navigablePages = getNavGroups()
    .flatMap((group) => group.pages)
    .filter((page) => !page.external);

  return dedupePages(navigablePages);
}

export function getAllPages(): Page[] {
  return getAllPageMeta()
    .map((page) => getPage(page.slug))
    .filter((page): page is Page => page !== null);
}

export function getAdjacentPages(currentSlug: string): {
  previous: PageMeta | null;
  next: PageMeta | null;
} {
  const pages = getAllPageMeta();
  const currentIndex = pages.findIndex((page) => page.slug === currentSlug);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: pages[currentIndex - 1] ?? null,
    next: pages[currentIndex + 1] ?? null,
  };
}

export function getGroupForPage(slug: string): string | null {
  for (const group of getNavGroups()) {
    if (group.pages.some((page) => page.slug === slug)) {
      return group.group;
    }
  }

  return null;
}

function walkNavigation(context: WalkContext, node: NavigationNode) {
  const localSources = [
    ...context.apiSources,
    ...sourcesFromValue(node.openapi, "openapi"),
    ...sourcesFromValue(node.asyncapi, "asyncapi"),
  ];
  const currentContext = {
    ...context,
    apiSources: dedupeSources(localSources),
  };

  if (node.pages) {
    addGroup(
      context.groups,
      currentContext.label,
      pagesFromEntries(node.pages, currentContext),
    );
  }

  if ((node.openapi || node.asyncapi) && !node.pages) {
    const sources =
      currentContext.apiSources.length > 0
        ? currentContext.apiSources
        : currentContext.configSources;
    addGroup(
      context.groups,
      currentContext.label,
      getApiPagesForSources(sources).map(toApiMeta),
    );
  }

  for (const key of NAV_CONTAINER_KEYS) {
    for (const child of node[key] ?? []) {
      const childLabel = labelForNavigationNode(child) ?? currentContext.label;
      walkNavigation(
        {
          ...currentContext,
          label:
            key === "groups"
              ? childLabel
              : mergeLabels(currentContext.label, childLabel),
        },
        child,
      );
    }
  }
}

function pagesFromEntries(
  entries: NavigationEntry[],
  context: WalkContext,
): PageMeta[] {
  return entries.flatMap((entry) => pageMetaFromEntry(entry, context));
}

function pageMetaFromEntry(
  entry: NavigationEntry,
  context: WalkContext,
): PageMeta[] {
  if (typeof entry === "string") {
    return [pageMetaFromReference(entry, context)].filter(
      (page): page is PageMeta => page !== null,
    );
  }

  const entrySources = dedupeSources([
    ...context.apiSources,
    ...sourcesFromValue(entry.openapi, "openapi"),
    ...sourcesFromValue(entry.asyncapi, "asyncapi"),
  ]);
  const entryContext = { ...context, apiSources: entrySources };

  if (entry.openapi || entry.asyncapi) {
    return getApiPagesForSources(entrySources).map(toApiMeta);
  }

  if (entry.pages || hasNavigationChildren(entry)) {
    const nestedGroups: NavGroup[] = [];
    walkNavigation({ ...entryContext, groups: nestedGroups }, entry);
    return nestedGroups.flatMap((group) => group.pages);
  }

  if (entry.page) {
    const meta = pageMetaFromReference(entry.page, entryContext);
    return meta ? [applyEntryMetadata(meta, entry)] : [];
  }

  const href = stringValue(entry.href) || stringValue(entry.url) || stringValue(entry.link);

  if (href) {
    return [externalPageMeta(entry, href)];
  }

  return [];
}

function pageMetaFromReference(
  reference: string,
  context: WalkContext,
): PageMeta | null {
  const sources =
    context.apiSources.length > 0 ? context.apiSources : context.configSources;

  if (isApiReference(reference)) {
    const page = getApiPageByReference(reference, sources);
    return page ? toApiMeta(page) : null;
  }

  const meta = getPageMeta(reference);
  return meta ? meta : null;
}

function getApiSources(config: DocsConfig): ApiSource[] {
  const fromApiSettings = [
    ...sourcesFromValue(config.api?.openapi, "openapi"),
    ...sourcesFromValue(config.api?.asyncapi, "asyncapi"),
  ];
  const fromNavigation = config.navigation
    ? collectApiSourcesFromNavigation(config.navigation)
    : [];

  return dedupeSources([...fromApiSettings, ...fromNavigation]);
}

function collectApiSourcesFromNavigation(node: NavigationNode): ApiSource[] {
  const sources = [
    ...sourcesFromValue(node.openapi, "openapi"),
    ...sourcesFromValue(node.asyncapi, "asyncapi"),
  ];

  if (node.pages) {
    for (const entry of node.pages) {
      if (typeof entry !== "string") {
        sources.push(...collectApiSourcesFromNavigation(entry));
      }
    }
  }

  for (const key of NAV_CONTAINER_KEYS) {
    for (const child of node[key] ?? []) {
      sources.push(...collectApiSourcesFromNavigation(child));
    }
  }

  return dedupeSources(sources);
}

function sourcesFromValue(
  value: ApiConfigValue | undefined,
  kind: ApiSource["kind"],
): ApiSource[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return localSource(value, kind);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => sourcesFromValue(item, kind));
  }

  if (typeof value.source === "string") {
    return localSource(value.source, kind);
  }

  if (typeof value.directory === "string") {
    return localSourcesFromDirectory(value.directory, kind);
  }

  return [];
}

function localSource(sourcePath: string, kind: ApiSource["kind"]): ApiSource[] {
  if (/^https?:\/\//i.test(sourcePath)) {
    return [];
  }

  return [{ path: sourcePath, kind }];
}

function localSourcesFromDirectory(
  directory: string,
  kind: ApiSource["kind"],
): ApiSource[] {
  const resolvedDirectory = resolveProjectFile(directory.replace(/^\//, ""));

  if (!fs.existsSync(resolvedDirectory)) {
    return [];
  }

  return fs
    .readdirSync(resolvedDirectory)
    .filter((file) => /\.(json|ya?ml)$/i.test(file))
    .map((file) => ({
      kind,
      path: path.join(directory, file).replace(/\\/g, "/"),
    }));
}

function getAllMdxPageMeta(): PageMeta[] {
  return scanMdxFiles(resolveProjectFile())
    .map((filePath) => path.relative(resolveProjectFile(), filePath))
    .map((relativePath) => relativePath.replace(/\.mdx$/, ""))
    .filter((slug) => slug !== "AGENTS")
    .map((slug) => getPageMeta(slug))
    .filter((page): page is PageMeta => page !== null);
}

function scanMdxFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (
      entry.name.startsWith(".") ||
      ["node_modules", "fixtures", "public", "logo"].includes(entry.name)
    ) {
      return [];
    }

    if (entry.isDirectory()) {
      return scanMdxFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith(".mdx") ? [entryPath] : [];
  });
}

function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;

  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{2,3})\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const title = match[2].replace(/\s+#$/, "").trim();
    headings.push({
      id: slugify(title),
      title,
      level: match[1].length as 2 | 3,
    });
  }

  return headings;
}

function labelForNavigationNode(node: NavigationNode): string | null {
  return (
    stringValue(node.group) ||
    stringValue(node.tab) ||
    stringValue(node.anchor) ||
    stringValue(node.dropdown) ||
    stringValue(node.menu) ||
    stringValue(node.version) ||
    stringValue(node.language) ||
    stringValue(node.title) ||
    stringValue(node.label) ||
    null
  );
}

function applyEntryMetadata(meta: PageMeta, entry: NavigationNode): PageMeta {
  const title = stringValue(entry.title) || stringValue(entry.label);

  return {
    ...meta,
    icon: stringValue(entry.icon) || meta.icon,
    tag: stringValue(entry.tag) || meta.tag,
    sidebarTitle: title || meta.sidebarTitle,
  };
}

function externalPageMeta(entry: NavigationNode, href: string): PageMeta {
  const title =
    stringValue(entry.title) ||
    stringValue(entry.label) ||
    stringValue(entry.page) ||
    href;

  return {
    slug: `external-${slugify(title || href)}`,
    route: href,
    filePath: "",
    title,
    sidebarTitle: title,
    description: "",
    kind: "external",
    icon: stringValue(entry.icon),
    tag: stringValue(entry.tag),
    external: true,
  };
}

function toApiMeta(page: ApiPage): PageMeta {
  return {
    ...page,
    kind: "api",
  };
}

function addGroup(groups: NavGroup[], groupName: string, pages: PageMeta[]) {
  if (pages.length === 0) {
    return;
  }

  const existing = groups.find((group) => group.group === groupName);

  if (existing) {
    existing.pages.push(...pages);
    return;
  }

  groups.push({
    group: groupName,
    pages,
  });
}

function dedupePages(pages: PageMeta[]): PageMeta[] {
  const seen = new Set<string>();

  return pages.filter((page) => {
    const key = page.external ? page.route : page.slug;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeSources(sources: ApiSource[]): ApiSource[] {
  const seen = new Set<string>();

  return sources.filter((source) => {
    const key = `${source.kind}:${source.path}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function hasNavigationChildren(node: NavigationNode): boolean {
  return NAV_CONTAINER_KEYS.some((key) => (node[key] ?? []).length > 0);
}

function mergeLabels(parent: string, child: string): string {
  return parent === "Guide" ? child : `${parent} / ${child}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function titleFromSlug(slug: string): string {
  return slug
    .split("/")
    .pop()!
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function resolveProjectFile(...segments: string[]): string {
  const root = /* turbopackIgnore: true */ process.cwd();
  const resolvedPath = path.resolve(root, ...segments);

  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("Resolved documentation path must stay inside the project.");
  }

  return resolvedPath;
}
