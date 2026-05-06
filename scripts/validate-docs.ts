import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import YAML from "yaml";

import { getAllPageMeta, normalizeDocSlug } from "../lib/docs";
import { siteConfig, type ApiConfigValue, type NavigationEntry, type NavigationNode } from "../site.config";

type Issue = {
  file?: string;
  message: string;
};

const root = process.cwd();
const linksOnly = process.argv.includes("--links-only");
const issues: Issue[] = [];
const mdxFiles = scanFiles(root).filter((file) => file.endsWith(".mdx"));
const pageRoutes = new Set(
  getAllPageMeta()
    .filter((page) => !page.external)
    .map((page) => page.route),
);
const pageSlugs = new Set(
  getAllPageMeta()
    .filter((page) => !page.external)
    .map((page) => page.slug),
);
const specialRoutes = new Set([
  "/api-reference",
  "/llms.txt",
  "/llms-full.txt",
  "/mcp",
  "/robots.txt",
  "/sitemap.xml",
]);

for (const file of mdxFiles) {
  validateMdxFile(file);
}

if (!linksOnly) {
  validateNavigation(siteConfig.navigation);
  validateApiSources(siteConfig.api?.openapi, "openapi");
  validateApiSources(siteConfig.api?.asyncapi, "asyncapi");
}

if (issues.length > 0) {
  console.error(`Found ${issues.length} documentation issue${issues.length === 1 ? "" : "s"}:`);

  for (const issue of issues) {
    const prefix = issue.file ? `${path.relative(root, issue.file)}: ` : "";
    console.error(`- ${prefix}${issue.message}`);
  }

  process.exitCode = 1;
} else {
  console.log("Documentation validation passed.");
}

function validateMdxFile(file: string) {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = matter(raw);
  const relativePath = path.relative(root, file);
  const isTemplate = relativePath.startsWith(`templates${path.sep}`);
  const slug = relativePath.replace(/\.mdx$/, "").replace(/\\/g, "/");

  if (!linksOnly) {
    if (typeof parsed.data.title !== "string" || !parsed.data.title.trim()) {
      issues.push({ file, message: "Missing frontmatter title." });
    }

    if (
      typeof parsed.data.description !== "string" ||
      !parsed.data.description.trim()
    ) {
      issues.push({ file, message: "Missing frontmatter description." });
    }

    if (!isTemplate && slug !== "component-gallery" && !pageSlugs.has(slug)) {
      issues.push({
        file,
        message: `Page is not reachable from site.config.ts navigation: ${slug}.`,
      });
    }

    validateDuplicateHeadings(file, parsed.content);
  }

  validateLinks(file, parsed.content);
}

function validateDuplicateHeadings(file: string, content: string) {
  const seen = new Set<string>();
  let inFence = false;

  for (const line of content.split("\n")) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const match = /^(#{1,6})\s+(.+)$/.exec(line);

    if (!match) {
      continue;
    }

    const slug = slugify(match[2].replace(/\s+#$/, "").trim());

    if (seen.has(slug)) {
      issues.push({ file, message: `Duplicate heading anchor: #${slug}.` });
    }

    seen.add(slug);
  }
}

function validateLinks(file: string, content: string) {
  const links = [
    ...matchAll(content, /\[[^\]]+\]\(([^)]+)\)/g),
    ...matchAll(content, /\bhref="([^"]+)"/g),
  ];

  for (const href of links) {
    validateInternalHref(file, href.trim());
  }
}

function validateInternalHref(file: string, href: string) {
  if (
    !href ||
    href.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("{")
  ) {
    return;
  }

  if (!href.startsWith("/")) {
    issues.push({
      file,
      message: `Use root-relative internal links instead of ${href}.`,
    });
    return;
  }

  const [pathname] = href.split("#");
  const withoutTrailingSlash = pathname.replace(/\/+$/, "") || "/";

  if (specialRoutes.has(withoutTrailingSlash) || pageRoutes.has(withoutTrailingSlash)) {
    return;
  }

  if (withoutTrailingSlash.endsWith(".md")) {
    const slug = normalizeDocSlug(withoutTrailingSlash.replace(/^\/+/, "").replace(/\.md$/, ""));

    if (slug && pageSlugs.has(slug)) {
      return;
    }
  }

  const publicPath = path.join(root, "public", withoutTrailingSlash);

  if (fs.existsSync(publicPath)) {
    return;
  }

  issues.push({ file, message: `Broken internal link: ${href}.` });
}

function validateNavigation(node: NavigationNode) {
  for (const entry of node.pages ?? []) {
    validateNavigationEntry(entry);
  }

  for (const key of [
    "groups",
    "tabs",
    "anchors",
    "dropdowns",
    "menus",
    "versions",
    "languages",
  ] as const) {
    for (const child of node[key] ?? []) {
      validateNavigation(child);
    }
  }

  validateApiSources(node.openapi, "openapi");
  validateApiSources(node.asyncapi, "asyncapi");
}

function validateNavigationEntry(entry: NavigationEntry) {
  if (typeof entry === "string") {
    validatePageReference(entry);
    return;
  }

  if (entry.page) {
    validatePageReference(entry.page);
  }

  if (entry.href || entry.url || entry.link) {
    return;
  }

  validateNavigation(entry);
}

function validatePageReference(reference: string) {
  if (/^[A-Z]+\s+\S+/.test(reference) || /^(publish|subscribe)\s+\S+/i.test(reference)) {
    return;
  }

  const slug = normalizeDocSlug(reference);

  if (!slug || !pageSlugs.has(slug)) {
    issues.push({
      message: `Navigation references a missing page: ${reference}.`,
    });
  }
}

function validateApiSources(value: ApiConfigValue | undefined, kind: string) {
  for (const source of apiSourcePaths(value)) {
    if (/^https?:\/\//i.test(source)) {
      continue;
    }

    const resolvedPath = path.resolve(root, source.replace(/^\/+/, ""));

    if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
      issues.push({ message: `${kind} spec path leaves the project: ${source}.` });
      continue;
    }

    if (!fs.existsSync(resolvedPath)) {
      issues.push({ message: `${kind} spec path does not exist: ${source}.` });
      continue;
    }

    try {
      const raw = fs.readFileSync(resolvedPath, "utf8");
      source.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
    } catch (error) {
      issues.push({
        message: `${kind} spec could not be parsed: ${source} (${error instanceof Error ? error.message : "unknown error"}).`,
      });
    }
  }
}

function apiSourcePaths(value: ApiConfigValue | undefined): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(apiSourcePaths);
  }

  if (typeof value.source === "string") {
    return [value.source];
  }

  if (typeof value.directory === "string") {
    const directory = path.resolve(root, value.directory.replace(/^\/+/, ""));

    if (!fs.existsSync(directory)) {
      return [value.directory];
    }

    return fs
      .readdirSync(directory)
      .filter((file) => /\.(json|ya?ml)$/i.test(file))
      .map((file) => path.join(value.directory as string, file));
  }

  return [];
}

function scanFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (
      entry.name.startsWith(".") ||
      ["node_modules", ".next", "public"].includes(entry.name)
    ) {
      return [];
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return scanFiles(entryPath);
    }

    return entry.isFile() ? [entryPath] : [];
  });
}

function matchAll(value: string, pattern: RegExp): string[] {
  return [...value.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
