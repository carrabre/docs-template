import fs from "node:fs";
import path from "node:path";

import YAML from "yaml";

import { slugify } from "@/lib/slug";

export type ApiSpecKind = "openapi" | "asyncapi";

export type ApiSource = {
  path: string;
  kind: ApiSpecKind;
};

export type ApiPageMeta = {
  kind: "api";
  slug: string;
  route: string;
  filePath: string;
  title: string;
  sidebarTitle: string;
  description: string;
  method?: string;
  endpoint?: string;
  sourcePath: string;
};

export type ApiPage = ApiPageMeta & {
  content: string;
};

type OpenApiOperation = {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Array<Record<string, unknown>>;
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
};

type GeneratedApiEntry = ApiPage & {
  reference: string;
};

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

let apiCache = new Map<string, GeneratedApiEntry[]>();

export function getApiPagesForSources(sources: ApiSource[]): ApiPage[] {
  return sources.flatMap((source) => getApiEntries(source)).map(toApiPage);
}

export function getApiPageBySlug(
  slug: string,
  sources: ApiSource[],
): ApiPage | null {
  for (const source of sources) {
    const match = getApiEntries(source).find((entry) => entry.slug === slug);

    if (match) {
      return toApiPage(match);
    }
  }

  return null;
}

export function getApiPageByReference(
  reference: string,
  sources: ApiSource[],
): ApiPage | null {
  const normalized = normalizeReference(reference);

  for (const source of sources) {
    const match = getApiEntries(source).find(
      (entry) => normalizeReference(entry.reference) === normalized,
    );

    if (match) {
      return toApiPage(match);
    }
  }

  return null;
}

export function isApiReference(value: string): boolean {
  return /^[A-Z]+\s+\S+/.test(value) || /^(publish|subscribe)\s+\S+/i.test(value);
}

function getApiEntries(source: ApiSource): GeneratedApiEntry[] {
  const cacheKey = `${source.kind}:${source.path}`;
  const cached = apiCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const document = readSpec(source.path);
  const entries =
    source.kind === "asyncapi"
      ? generateAsyncApiEntries(document, source.path)
      : generateOpenApiEntries(document, source.path);

  apiCache.set(cacheKey, entries);

  return entries;
}

function generateOpenApiEntries(
  document: Record<string, unknown>,
  sourcePath: string,
): GeneratedApiEntry[] {
  const paths = asRecord(document.paths);

  return Object.entries(paths).flatMap(([endpoint, pathItem]) => {
    const operations = asRecord(pathItem);

    return Object.entries(operations)
      .filter(([method]) => HTTP_METHODS.has(method.toLowerCase()))
      .map(([method, operation]) => {
        const normalizedMethod = method.toUpperCase();
        const op = asRecord(operation) as OpenApiOperation;
        const title = op.summary || `${normalizedMethod} ${endpoint}`;
        const description = op.description || "";
        const slug = apiSlug(normalizedMethod, endpoint);

        return {
          kind: "api" as const,
          slug,
          route: `/${slug}`,
          filePath: sourcePath,
          title,
          sidebarTitle: title,
          description,
          method: normalizedMethod,
          endpoint,
          sourcePath,
          reference: `${normalizedMethod} ${endpoint}`,
          content: renderOpenApiOperation({
            document,
            endpoint,
            method: normalizedMethod,
            operation: op,
            title,
            description,
            sourcePath,
          }),
        };
      });
  });
}

function generateAsyncApiEntries(
  document: Record<string, unknown>,
  sourcePath: string,
): GeneratedApiEntry[] {
  const channels = asRecord(document.channels);

  return Object.entries(channels).flatMap(([channel, channelItem]) => {
    const operations = asRecord(channelItem);

    return ["publish", "subscribe"].flatMap((action) => {
      const operation = asRecord(operations[action]);

      if (Object.keys(operation).length === 0) {
        return [];
      }

      const title =
        stringValue(operation.summary) ||
        `${titleCase(action)} ${channel}`;
      const description = stringValue(operation.description);
      const slug = apiSlug(action, channel);

      return [
        {
          kind: "api" as const,
          slug,
          route: `/${slug}`,
          filePath: sourcePath,
          title,
          sidebarTitle: title,
          description,
          method: action.toUpperCase(),
          endpoint: channel,
          sourcePath,
          reference: `${action} ${channel}`,
          content: renderAsyncApiOperation({
            action,
            channel,
            description,
            operation,
            sourcePath,
            title,
          }),
        },
      ];
    });
  });
}

function renderOpenApiOperation({
  description,
  document,
  endpoint,
  method,
  operation,
  sourcePath,
  title,
}: {
  description: string;
  document: Record<string, unknown>;
  endpoint: string;
  method: string;
  operation: OpenApiOperation;
  sourcePath: string;
  title: string;
}) {
  const parameters = (operation.parameters ?? [])
    .map((parameter) => renderParam(parameter))
    .join("\n\n");
  const requestBody = renderRequestBody(operation.requestBody);
  const responses = renderResponses(operation.responses);

  return [
    `<Badge>${method}</Badge>`,
    `# ${title}`,
    description,
    `\`${method} ${endpoint}\``,
    `> Generated from \`${sourcePath}\`. This is a schema reference stub. Live request execution is not enabled.`,
    parameters ? `## Parameters\n\n${parameters}` : "",
    requestBody ? `## Request body\n\n${requestBody}` : "",
    responses ? `## Responses\n\n${responses}` : "",
    renderSchemas(document),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderAsyncApiOperation({
  action,
  channel,
  description,
  operation,
  sourcePath,
  title,
}: {
  action: string;
  channel: string;
  description: string;
  operation: Record<string, unknown>;
  sourcePath: string;
  title: string;
}) {
  const message = asRecord(operation.message);

  return [
    `<Badge>${action.toUpperCase()}</Badge>`,
    `# ${title}`,
    description,
    `\`${action.toUpperCase()} ${channel}\``,
    `> Generated from \`${sourcePath}\`. This is a schema reference stub. Live message execution is not enabled.`,
    Object.keys(message).length > 0
      ? `## Message\n\n<ResponseExample>\n\n\`\`\`json Message schema\n${JSON.stringify(
          message,
          null,
          2,
        )}\n\`\`\`\n\n</ResponseExample>`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderParam(parameter: Record<string, unknown>) {
  const name = stringValue(parameter.name) || "parameter";
  const schema = asRecord(parameter.schema);
  const type = stringValue(schema.type) || "unknown";
  const required = parameter.required === true ? " required" : "";
  const location = stringValue(parameter.in);
  const description = stringValue(parameter.description);

  return `<ParamField name="${escapeAttribute(name)}" type="${escapeAttribute(
    location ? `${type} ${location}` : type,
  )}"${required}>${description}</ParamField>`;
}

function renderRequestBody(requestBody?: Record<string, unknown>) {
  if (!requestBody) {
    return "";
  }

  return `<RequestExample>

\`\`\`json Request body
${JSON.stringify(requestBody, null, 2)}
\`\`\`

</RequestExample>`;
}

function renderResponses(responses?: Record<string, unknown>) {
  if (!responses) {
    return "";
  }

  return Object.entries(responses)
    .map(([status, response]) => {
      const responseRecord = asRecord(response);
      const description = stringValue(responseRecord.description);

      return `<ResponseField name="${escapeAttribute(
        status,
      )}" type="HTTP response">${description}</ResponseField>`;
    })
    .join("\n\n");
}

function renderSchemas(document: Record<string, unknown>) {
  const schemas = asRecord(asRecord(document.components).schemas);

  if (Object.keys(schemas).length === 0) {
    return "";
  }

  return `## Schemas\n\n<ResponseExample>

\`\`\`json Component schemas
${JSON.stringify(schemas, null, 2)}
\`\`\`

</ResponseExample>`;
}

function readSpec(specPath: string): Record<string, unknown> {
  const root = /* turbopackIgnore: true */ process.cwd();
  const resolvedPath = path.resolve(root, specPath.replace(/^\/+/, ""));

  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    throw new Error("API specification paths must stay inside the project.");
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");

  if (specPath.endsWith(".json")) {
    return JSON.parse(raw) as Record<string, unknown>;
  }

  return YAML.parse(raw) as Record<string, unknown>;
}

function apiSlug(method: string, endpoint: string) {
  const value = `${method}-${endpoint}`
    .replace(/[{}]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");

  return `reference/${slugify(value)}`;
}

function normalizeReference(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function toApiPage(entry: GeneratedApiEntry): ApiPage {
  return { ...entry };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
