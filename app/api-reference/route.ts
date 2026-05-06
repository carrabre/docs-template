import fs from "node:fs";
import path from "node:path";

import { ApiReference } from "@scalar/nextjs-api-reference";

import { siteConfig, type ApiConfigValue } from "@/site.config";

export const runtime = "nodejs";

const sourcePath = firstApiSource(siteConfig.api?.openapi);
const handler =
  siteConfig.api?.playground?.enabled && sourcePath
    ? ApiReference({
        content: readApiSpec(sourcePath),
        pageTitle: `${siteConfig.api.playground.title} | ${siteConfig.name}`,
        showSidebar: true,
        theme: "default",
      })
    : null;

export function GET() {
  if (!handler) {
    return new Response("API playground is disabled or no OpenAPI file is configured.", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return handler();
}

function firstApiSource(value: ApiConfigValue | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const source = firstApiSource(item);

      if (source) {
        return source;
      }
    }

    return null;
  }

  return typeof value.source === "string" ? value.source : null;
}

function readApiSpec(source: string) {
  const root = /* turbopackIgnore: true */ process.cwd();
  const resolvedPath = path.resolve(
    /* turbopackIgnore: true */ root,
    source.replace(/^\/+/, ""),
  );

  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("API specification paths must stay inside the project.");
  }

  return fs.readFileSync(resolvedPath, "utf8");
}
