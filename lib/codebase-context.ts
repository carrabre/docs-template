import fs from "node:fs";
import path from "node:path";

const MAX_CODEBASE_CONTEXT_CHARS = 18000;
const MAX_FILE_CHARS = 2600;

const CODEBASE_CONTEXT_FILES = [
  "site.config.ts",
  "package.json",
  "README.md",
  "app/layout.tsx",
  "app/[[...slug]]/page.tsx",
  "app/api/assistant/route.ts",
  "app/mcp/route.ts",
  "components/docs-shell.tsx",
  "components/docs-tools.tsx",
  "components/code-copy-button.tsx",
  "components/docs-tabs.tsx",
  "components/page-context-menu.tsx",
  "components/mdx-components.tsx",
  "lib/api-specs.ts",
  "lib/docs.ts",
  "lib/markdown.ts",
  "lib/remark-code-blocks.ts",
  "lib/search.ts",
  "lib/search-types.ts",
];

let cachedCodebaseContext: string | null = null;

export function getCodebaseContext(): string {
  if (cachedCodebaseContext) {
    return cachedCodebaseContext;
  }

  const blocks: string[] = [];
  let usedChars = 0;

  for (const relativePath of CODEBASE_CONTEXT_FILES) {
    const filePath = path.join(
      /* turbopackIgnore: true */ process.cwd(),
      relativePath,
    );

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = truncate(fs.readFileSync(filePath, "utf8"), MAX_FILE_CHARS);
    const block = `File: ${relativePath}\n\`\`\`\n${content}\n\`\`\``;

    if (usedChars + block.length > MAX_CODEBASE_CONTEXT_CHARS) {
      break;
    }

    blocks.push(block);
    usedChars += block.length;
  }

  cachedCodebaseContext = blocks.join("\n\n");

  return cachedCodebaseContext;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}
