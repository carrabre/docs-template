type Node = {
  type?: string;
  name?: string;
  attributes?: Array<Record<string, unknown>>;
  children?: Node[];
  lang?: string;
  meta?: string;
  value?: string;
};

const KNOWN_COMPONENTS = new Set([
  "Accordion",
  "AccordionGroup",
  "ApiBlock",
  "ApiEndpoint",
  "Banner",
  "Badge",
  "Callout",
  "Card",
  "Check",
  "CodeBlock",
  "CodeGroup",
  "Color",
  "Color.Item",
  "Color.Row",
  "Column",
  "Columns",
  "Danger",
  "Do",
  "Dont",
  "DoDont",
  "Expandable",
  "Frame",
  "Icon",
  "Info",
  "InlineTOC",
  "Mermaid",
  "Note",
  "Panel",
  "ParamField",
  "PropertyTable",
  "PropertyTable.Property",
  "Prompt",
  "RequestExample",
  "ResponseExample",
  "ResponseField",
  "Step",
  "Steps",
  "Tab",
  "Tabs",
  "Tile",
  "Tooltip",
  "Tree",
  "Tree.File",
  "Tree.Folder",
  "Tip",
  "TypeTable",
  "TypeTable.Property",
  "Update",
  "View",
  "Visibility",
  "Warning",
  "ZoomableMedia",
]);

export function remarkDocsCodeBlocks() {
  return (tree: Node) => {
    transform(tree);
  };
}

function transform(node: Node) {
  if (!node.children) {
    return;
  }

  node.children = node.children.map((child) => {
    if (child.type !== "code") {
      transform(child);
      return normalizeUnknownComponent(child);
    }

    const options = parseCodeMeta(child.lang ?? "", child.meta ?? "");

    if (options.language === "mermaid") {
      return {
        type: "mdxJsxFlowElement",
        name: "Mermaid",
        attributes: [
          attribute("code", child.value ?? ""),
          options.title ? attribute("title", options.title) : null,
        ].filter(Boolean),
        children: [],
      } as Node;
    }

    return {
      type: "mdxJsxFlowElement",
      name: "CodeBlock",
      attributes: [
        attribute("language", options.language),
        attribute("code", child.value ?? ""),
        options.title ? attribute("title", options.title) : null,
        options.icon ? attribute("icon", options.icon) : null,
        options.highlight ? attribute("highlight", options.highlight) : null,
        options.focus ? attribute("focus", options.focus) : null,
        booleanAttribute("lineNumbers", options.lineNumbers),
        booleanAttribute("wrap", options.wrap),
        booleanAttribute("expandable", options.expandable),
      ].filter(Boolean),
      children: [],
    } as Node;
  });
}

function normalizeUnknownComponent(node: Node) {
  if (
    !(
      node.type === "mdxJsxFlowElement" ||
      node.type === "mdxJsxTextElement"
    ) ||
    !node.name ||
    KNOWN_COMPONENTS.has(node.name) ||
    !/^[A-Z]/.test(node.name)
  ) {
    return node;
  }

  return {
    ...node,
    name: "UnsupportedComponent",
    attributes: [attribute("name", node.name), ...(node.attributes ?? [])],
  };
}

function parseCodeMeta(language: string, meta: string) {
  const tokens = meta.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  const options = {
    language: (language || "text").toLowerCase(),
    title: "",
    icon: "",
    highlight: "",
    focus: "",
    lineNumbers: false,
    wrap: false,
    expandable: false,
  };

  for (const token of tokens) {
    if (token === "lines" || token === "lineNumbers") {
      options.lineNumbers = true;
      continue;
    }

    if (token === "wrap") {
      options.wrap = true;
      continue;
    }

    if (token === "expandable") {
      options.expandable = true;
      continue;
    }

    if (token.startsWith("icon=")) {
      options.icon = unquote(token.slice("icon=".length));
      continue;
    }

    if (token.startsWith("title=")) {
      options.title = unquote(token.slice("title=".length));
      continue;
    }

    if (token.startsWith("focus=")) {
      options.focus = unquote(token.slice("focus=".length));
      continue;
    }

    if (/^\{.+\}$/.test(token)) {
      options.highlight = token.slice(1, -1);
      continue;
    }

    if (!options.title) {
      options.title = unquote(token);
    }
  }

  return options;
}

function attribute(name: string, value: string) {
  return {
    type: "mdxJsxAttribute",
    name,
    value,
  };
}

function booleanAttribute(name: string, value: boolean) {
  return value
    ? {
        type: "mdxJsxAttribute",
        name,
        value: null,
      }
    : null;
}

function unquote(value: string) {
  return value.replace(/^"|"$/g, "");
}
