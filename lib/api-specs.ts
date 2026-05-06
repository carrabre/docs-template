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
  security?: Array<Record<string, unknown>>;
  tags?: string[];
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
            pathItem: operations,
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
  pathItem,
  sourcePath,
  title,
}: {
  description: string;
  document: Record<string, unknown>;
  endpoint: string;
  method: string;
  operation: OpenApiOperation;
  pathItem: Record<string, unknown>;
  sourcePath: string;
  title: string;
}) {
  const baseUrl = getOpenApiBaseUrl(document);
  const security = renderSecurity(document, operation);
  const parameters = [
    ...asArray(pathItem.parameters),
    ...asArray(operation.parameters),
  ]
    .map((parameter) => renderParam(asRecord(parameter), document))
    .join("\n\n");
  const requestBody = renderRequestBody(operation.requestBody, document);
  const responses = renderResponses(operation.responses, document);
  const samples = renderCodeSamples({
    baseUrl,
    document,
    endpoint,
    method,
    operation,
    pathItem,
  });
  const playground = "/api-reference";

  return [
    `# ${title}`,
    description,
    `<ApiEndpoint method="${escapeAttribute(method)}" endpoint="${escapeAttribute(
      endpoint,
    )}" baseUrl="${escapeAttribute(baseUrl)}" auth="${escapeAttribute(
      security || "None",
    )}" title="${escapeAttribute(title)}" playground="${playground}" />`,
    `> Generated from \`${sourcePath}\`. Use the playground for interactive exploration when your API allows safe requests.`,
    security ? `## Authentication\n\n${security}` : "",
    parameters ? `## Parameters\n\n${parameters}` : "",
    requestBody ? `## Request body\n\n${requestBody}` : "",
    responses ? `## Responses\n\n${responses}` : "",
    samples ? `## Code samples\n\n${samples}` : "",
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
  const message = resolveReference(asRecord(operation.message), {
    document: {},
  });
  const payload = asRecord(message.payload);
  const schemaTable = renderSchemaTable(payload, "Message payload", {});
  const example = schemaExample(payload, {});

  return [
    `# ${title}`,
    description,
    `<ApiEndpoint method="${escapeAttribute(
      action.toUpperCase(),
    )}" endpoint="${escapeAttribute(channel)}" title="${escapeAttribute(title)}" />`,
    `> Generated from \`${sourcePath}\`. Live message execution is not enabled in this starter.`,
    Object.keys(message).length > 0
      ? [
          "## Message",
          stringValue(message.summary),
          schemaTable,
          `<ResponseExample title="Message example">\n\n\`\`\`json Message payload\n${JSON.stringify(
            example,
            null,
            2,
          )}\n\`\`\`\n\n</ResponseExample>`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function renderParam(
  parameter: Record<string, unknown>,
  document: Record<string, unknown>,
) {
  const resolved = resolveReference(parameter, { document });
  const name = stringValue(parameter.name) || "parameter";
  const schema = resolveReference(asRecord(resolved.schema), { document });
  const type = schemaLabel(schema, document);
  const required = resolved.required === true ? " required" : "";
  const location = stringValue(resolved.in);
  const description = stringValue(resolved.description);

  return `<ParamField name="${escapeAttribute(name)}" type="${escapeAttribute(
    location ? `${type} ${location}` : type,
  )}"${required}>${description}</ParamField>`;
}

function renderRequestBody(
  requestBody: Record<string, unknown> | undefined,
  document: Record<string, unknown>,
) {
  if (!requestBody) {
    return "";
  }

  const resolved = resolveReference(requestBody, { document });
  const content = asRecord(resolved.content);

  if (Object.keys(content).length === 0) {
    return "";
  }

  return Object.entries(content)
    .map(([mediaType, media]) => {
      const mediaRecord = asRecord(media);
      const schema = resolveReference(asRecord(mediaRecord.schema), { document });
      const example = pickExample(mediaRecord, schema, document);
      const schemaTable = renderSchemaTable(schema, `${mediaType} body`, document);

      return [
        resolved.required === true ? "<Badge>Required</Badge>" : "",
        schemaTable,
        `<RequestExample title="${escapeAttribute(mediaType)} request">

\`\`\`json Request body
${JSON.stringify(example, null, 2)}
\`\`\`

</RequestExample>`,
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}

function renderResponses(
  responses: Record<string, unknown> | undefined,
  document: Record<string, unknown>,
) {
  if (!responses) {
    return "";
  }

  return Object.entries(responses)
    .map(([status, response]) => {
      const responseRecord = resolveReference(asRecord(response), { document });
      const description = stringValue(responseRecord.description);
      const content = asRecord(responseRecord.content);
      const examples = Object.entries(content)
        .map(([mediaType, media]) => {
          const mediaRecord = asRecord(media);
          const schema = resolveReference(asRecord(mediaRecord.schema), {
            document,
          });
          const example = pickExample(mediaRecord, schema, document);

          return `<ResponseExample title="${escapeAttribute(
            `${status} ${mediaType}`,
          )}">

\`\`\`json Response body
${JSON.stringify(example, null, 2)}
\`\`\`

</ResponseExample>`;
        })
        .join("\n\n");

      return [
        `<ResponseField name="${escapeAttribute(
        status,
      )}" type="HTTP response">${description}</ResponseField>`,
        examples,
      ]
        .filter(Boolean)
        .join("\n\n");
    })
    .join("\n\n");
}

function renderSchemas(document: Record<string, unknown>) {
  const schemas = asRecord(asRecord(document.components).schemas);

  if (Object.keys(schemas).length === 0) {
    return "";
  }

  const tables = Object.entries(schemas)
    .map(([name, schema]) =>
      renderSchemaTable(asRecord(schema), name, document),
    )
    .filter(Boolean)
    .join("\n\n");

  return tables ? `## Schemas\n\n${tables}` : "";
}

function renderSchemaTable(
  schema: Record<string, unknown>,
  title: string,
  document: Record<string, unknown>,
) {
  const resolved = resolveReference(schema, { document });
  const properties = asRecord(resolved.properties);
  const required = new Set(asArray(resolved.required).filter(isString));

  if (Object.keys(properties).length === 0) {
    return `<ResponseExample title="${escapeAttribute(title)} schema">

\`\`\`json Schema
${JSON.stringify(resolved, null, 2)}
\`\`\`

</ResponseExample>`;
  }

  const rows = Object.entries(properties)
    .map(([name, value]) => {
      const property = resolveReference(asRecord(value), { document });
      const description = stringValue(property.description);
      const isRequired = required.has(name);

      return `<TypeTable.Property name="${escapeAttribute(
        name,
      )}" type="${escapeAttribute(schemaLabel(property, document))}"${
        isRequired ? " required" : " optional"
      }>${description}</TypeTable.Property>`;
    })
    .join("\n");

  return `<TypeTable title="${escapeAttribute(title)}">\n${rows}\n</TypeTable>`;
}

function renderSecurity(
  document: Record<string, unknown>,
  operation: OpenApiOperation,
) {
  const security = operation.security ?? asArray(document.security);
  const schemes = asRecord(asRecord(document.components).securitySchemes);

  if (security.length === 0) {
    return "";
  }

  return security
    .flatMap((requirement) => Object.keys(asRecord(requirement)))
    .map((name) => {
      const scheme = asRecord(schemes[name]);
      const type = stringValue(scheme.type);
      const schemeName = stringValue(scheme.scheme);
      const bearerFormat = stringValue(scheme.bearerFormat);
      const header = stringValue(scheme.name);
      const location = stringValue(scheme.in);

      if (type === "http" && schemeName) {
        return `${name}: ${schemeName}${bearerFormat ? ` (${bearerFormat})` : ""}`;
      }

      if (type === "apiKey") {
        return `${name}: API key in ${location || "header"}${header ? ` named ${header}` : ""}`;
      }

      return name;
    })
    .join(", ");
}

function renderCodeSamples({
  baseUrl,
  document,
  endpoint,
  method,
  operation,
  pathItem,
}: {
  baseUrl: string;
  document: Record<string, unknown>;
  endpoint: string;
  method: string;
  operation: OpenApiOperation;
  pathItem: Record<string, unknown>;
}) {
  const parameters = [
    ...asArray(pathItem.parameters),
    ...asArray(operation.parameters),
  ].map((parameter) => resolveReference(asRecord(parameter), { document }));
  const pathParams = parameters.filter(
    (parameter) => stringValue(parameter.in) === "path",
  );
  const queryParams = parameters.filter(
    (parameter) => stringValue(parameter.in) === "query",
  );
  const samplePath = pathParams.reduce((current, parameter) => {
    const name = stringValue(parameter.name);
    return current.replace(`{${name}}`, sampleValue(parameter, document));
  }, endpoint);
  const search = new URLSearchParams();

  for (const parameter of queryParams) {
    search.set(stringValue(parameter.name), sampleValue(parameter, document));
  }

  const url = `${baseUrl.replace(/\/+$/, "")}${samplePath}${
    search.size > 0 ? `?${search.toString()}` : ""
  }`;
  const body = sampleRequestBody(operation, document);
  const upperMethod = method.toUpperCase();
  const curl = [
    `curl -X ${upperMethod} "${url}"`,
    `  -H "Authorization: Bearer $API_TOKEN"`,
    body ? `  -H "Content-Type: application/json"` : "",
    body ? `  -d '${JSON.stringify(body)}'` : "",
  ]
    .filter(Boolean)
    .join(" \\\n");
  const js = [
    `const response = await fetch("${url}", {`,
    `  method: "${upperMethod}",`,
    `  headers: {`,
    `    Authorization: \`Bearer \${process.env.API_TOKEN}\`,`,
    body ? `    "Content-Type": "application/json",` : "",
    `  },`,
    body ? `  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}),` : "",
    `});`,
    ``,
    `const data = await response.json();`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  const python = [
    `import os`,
    `import requests`,
    ``,
    `response = requests.request(`,
    `    "${upperMethod}",`,
    `    "${url}",`,
    `    headers={"Authorization": f"Bearer {os.environ['API_TOKEN']}"},`,
    body ? `    json=${JSON.stringify(body, null, 4).replace(/\n/g, "\n    ")},` : "",
    `)`,
    `print(response.json())`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `<CodeGroup sync dropdown>
\`\`\`bash title="cURL"
${curl}
\`\`\`

\`\`\`ts title="JavaScript"
${js}
\`\`\`

\`\`\`python title="Python"
${python}
\`\`\`
</CodeGroup>`;
}

function getOpenApiBaseUrl(document: Record<string, unknown>) {
  const server = asRecord(asArray(document.servers)[0]);
  return stringValue(server.url) || "https://api.example.com";
}

function sampleRequestBody(
  operation: OpenApiOperation,
  document: Record<string, unknown>,
) {
  const requestBody = resolveReference(asRecord(operation.requestBody), {
    document,
  });
  const media = asRecord(asRecord(requestBody.content)["application/json"]);
  const schema = resolveReference(asRecord(media.schema), { document });

  return Object.keys(media).length > 0
    ? pickExample(media, schema, document)
    : null;
}

function pickExample(
  media: Record<string, unknown>,
  schema: Record<string, unknown>,
  document: Record<string, unknown>,
): unknown {
  if (media.example !== undefined) {
    return media.example;
  }

  const examples = asRecord(media.examples);
  const firstExample = asRecord(Object.values(examples)[0]);

  if (firstExample.value !== undefined) {
    return firstExample.value;
  }

  return schemaExample(schema, document);
}

function schemaExample(
  schema: Record<string, unknown>,
  document: Record<string, unknown>,
): unknown {
  const resolved = resolveReference(schema, { document });

  if (resolved.example !== undefined) {
    return resolved.example;
  }

  if (Array.isArray(resolved.enum) && resolved.enum.length > 0) {
    return resolved.enum[0];
  }

  if (stringValue(resolved.type) === "array") {
    return [schemaExample(asRecord(resolved.items), document)];
  }

  if (
    stringValue(resolved.type) === "object" ||
    Object.keys(asRecord(resolved.properties)).length > 0
  ) {
    return Object.fromEntries(
      Object.entries(asRecord(resolved.properties)).map(([name, value]) => [
        name,
        schemaExample(asRecord(value), document),
      ]),
    );
  }

  switch (stringValue(resolved.type)) {
    case "integer":
    case "number":
      return 1;
    case "boolean":
      return true;
    case "string":
      return stringValue(resolved.format) === "date-time"
        ? "2026-05-06T00:00:00.000Z"
        : "string";
    default:
      return {};
  }
}

function sampleValue(
  parameter: Record<string, unknown>,
  document: Record<string, unknown>,
) {
  const schema = resolveReference(asRecord(parameter.schema), { document });
  const example = schemaExample(schema, document);

  return typeof example === "string" ? example : String(example);
}

function schemaLabel(
  schema: Record<string, unknown>,
  document: Record<string, unknown>,
): string {
  const resolved = resolveReference(schema, { document });
  const type = stringValue(resolved.type);
  const format = stringValue(resolved.format);

  if (type === "array") {
    return `${schemaLabel(asRecord(resolved.items), document)}[]`;
  }

  if (Array.isArray(resolved.enum)) {
    return resolved.enum.map(String).join(" | ");
  }

  return [type || "object", format].filter(Boolean).join(":");
}

function resolveReference(
  value: Record<string, unknown>,
  { document }: { document: Record<string, unknown> },
): Record<string, unknown> {
  const ref = stringValue(value.$ref);

  if (!ref.startsWith("#/")) {
    return value;
  }

  return ref
    .slice(2)
    .split("/")
    .reduce((current: unknown, segment) => {
      const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
      return asRecord(current)[key];
    }, document) as Record<string, unknown>;
}

function readSpec(specPath: string): Record<string, unknown> {
  const root = /* turbopackIgnore: true */ process.cwd();
  const resolvedPath = path.resolve(
    /* turbopackIgnore: true */ root,
    specPath.replace(/^\/+/, ""),
  );

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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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
