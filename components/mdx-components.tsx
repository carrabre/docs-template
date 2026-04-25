import type {
  AnchorHTMLAttributes,
  CSSProperties,
  ImgHTMLAttributes,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from "react";
import { Children, cloneElement, isValidElement } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BadgeInfo,
  CheckCircle2,
  ChevronRight,
  Info as InfoIcon,
  Lightbulb,
} from "lucide-react";
import { codeToHtml } from "shiki";

import { CodeCopyButton } from "@/components/code-copy-button";
import { DocsDetails } from "@/components/docs-details";
import { DocsIcon } from "@/components/docs-icon";
import { DocsSidePanelBlock } from "@/components/docs-side-panel";
import { CodeGroup, Tab, Tabs } from "@/components/docs-tabs";
import { View } from "@/components/docs-view";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { slugify, textFromNode } from "@/lib/slug";

type Booleanish = boolean | "true" | "false";
type FieldLocation = "body" | "header" | "path" | "query";

type ColumnsProps = PropsWithChildren<{
  cols?: number | string;
  columns?: number | string;
}>;

type IconishProps = {
  icon?: string;
  iconType?: string;
  stroke?: number | string | boolean;
};

type CardProps = PropsWithChildren<
  IconishProps & {
    arrow?: Booleanish;
    className?: string;
    color?: string;
    cta?: string;
    horizontal?: Booleanish;
    href?: string;
    img?: string;
    tag?: string;
    title?: string;
  }
>;

type CalloutProps = PropsWithChildren<
  IconishProps & {
    color?: string;
    title?: string;
    type?: string;
    variant?: "note" | "info" | "tip" | "warning" | "check" | "danger";
  }
>;

type CodeBlockProps = {
  code?: string;
  expandable?: boolean;
  focus?: string;
  highlight?: string;
  icon?: string;
  language?: string;
  lineNumbers?: boolean;
  title?: string;
  wrap?: boolean;
};

type FieldProps = PropsWithChildren<{
  body?: boolean | string;
  default?: string | number | boolean;
  deprecated?: Booleanish;
  header?: boolean | string;
  name?: string;
  optional?: Booleanish;
  path?: boolean | string;
  placeholder?: string;
  post?: string;
  pre?: string;
  query?: boolean | string;
  required?: Booleanish;
  type?: string;
}>;

type BadgeProps = PropsWithChildren<
  IconishProps & {
    className?: string;
    color?: string;
    disabled?: Booleanish;
    shape?: string;
    size?: string;
    variant?: string;
  }
>;

type ColorItemProps = PropsWithChildren<{
  color?: string;
  name?: string;
  value?: string;
}>;

type ExampleProps = PropsWithChildren<{
  title?: string;
}>;

type UpdateProps = PropsWithChildren<{
  description?: string;
  id?: string;
  label?: string;
  rss?: boolean | string;
  tags?: string | string[];
}>;

const defaultCalloutIcons: Record<string, string> = {
  check: "check-circle-2",
  danger: "alert-triangle",
  info: "info",
  note: "info",
  tip: "lightbulb",
  warning: "alert-triangle",
};

export function Columns({ children, cols, columns = 2 }: ColumnsProps) {
  const count = toNumber(cols ?? columns, 2);

  return (
    <div
      className="docs-columns"
      style={{ "--docs-columns": count } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function Column({ children }: PropsWithChildren) {
  return <div className="docs-column">{children}</div>;
}

export function Card({
  arrow,
  children,
  className,
  color,
  cta,
  horizontal,
  href,
  icon = "info",
  iconType,
  img,
  stroke,
  tag,
  title,
}: CardProps) {
  const showArrow = href ? arrow !== false && arrow !== "false" : arrow === true;
  const body = (
    <>
      {img ? <img className="docs-card-image" src={img} alt="" /> : null}
      <span className="docs-card-icon" aria-hidden="true">
        <DocsIcon icon={icon} iconType={iconType} size={20} stroke={stroke} />
      </span>
      <span className="docs-card-copy">
        {title ? <strong>{title}</strong> : null}
        {tag ? <small>{tag}</small> : null}
        <span>{children}</span>
        {cta ? <em>{cta}</em> : null}
      </span>
      {showArrow ? (
        <ChevronRight className="docs-card-arrow" size={18} aria-hidden="true" />
      ) : null}
    </>
  );
  const props = {
    className: classNames("docs-card", className),
    "data-horizontal": isTruthy(horizontal) ? "true" : undefined,
    style: colorStyle(color, "card"),
  };

  if (!href) {
    return <div {...props}>{body}</div>;
  }

  return (
    <Link {...props} href={href}>
      {body}
    </Link>
  );
}

export async function CodeBlock({
  code = "",
  expandable,
  focus,
  highlight,
  icon,
  language = "text",
  lineNumbers,
  title,
  wrap,
}: CodeBlockProps) {
  const lang = language || "text";
  const highlighted = await highlightCode(code, lang);
  const html = decorateCodeLines(highlighted, code, { focus, highlight });
  const label = title || icon || lang;

  return (
    <figure
      className={[
        "docs-code-block",
        lineNumbers ? "docs-code-lines" : "",
        wrap ? "docs-code-wrap" : "",
        expandable ? "docs-code-expandable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-code-language={lang}
      data-code-title={label}
    >
      <figcaption className="docs-code-header">
        <span>
          {icon ? <span className="docs-code-icon">{icon}</span> : null}
          {label}
        </span>
        <CodeCopyButton code={code} />
      </figcaption>
      <div
        className="docs-code-scroller"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}

export function Steps({ children }: PropsWithChildren) {
  return <ol className="docs-steps">{children}</ol>;
}

export function Step({
  children,
  icon,
  iconType,
  id,
  title,
  titleSize,
}: PropsWithChildren<
  IconishProps & {
    id?: string;
    title?: string;
    titleSize?: "lg" | "md" | "sm" | string;
  }
>) {
  const resolvedId = id ?? (title ? slugify(title) : undefined);

  return (
    <li
      className="docs-step"
      data-has-icon={icon ? "true" : undefined}
      id={resolvedId}
    >
      {icon ? (
        <span className="docs-step-marker" aria-hidden="true">
          <DocsIcon icon={icon} iconType={iconType} size={16} />
        </span>
      ) : null}
      {title ? (
        <strong className="docs-step-title" data-size={titleSize}>
          {title}
        </strong>
      ) : null}
      <div>{children}</div>
    </li>
  );
}

export function AccordionGroup({ children }: PropsWithChildren) {
  return <div className="docs-accordion-group">{children}</div>;
}

export function Accordion({
  children,
  defaultOpen,
  description,
  icon,
  iconType,
  id,
  title = "Details",
}: PropsWithChildren<
  IconishProps & {
    defaultOpen?: Booleanish;
    description?: string;
    id?: string;
    title?: string;
  }
>) {
  const resolvedId = id ?? slugify(title);

  return (
    <DocsDetails
      className="docs-accordion"
      defaultOpen={isTruthy(defaultOpen)}
      id={resolvedId}
      summary={
        <span className="docs-accordion-summary">
          {icon ? <DocsIcon icon={icon} iconType={iconType} size={17} /> : null}
          <span>
            <strong>{title}</strong>
            {description ? <small>{description}</small> : null}
          </span>
        </span>
      }
    >
      {children}
    </DocsDetails>
  );
}

export function Expandable({
  children,
  defaultOpen,
  icon,
  iconType,
  id,
  title = "More information",
}: PropsWithChildren<
  IconishProps & {
    defaultOpen?: Booleanish;
    id?: string;
    title?: string;
  }
>) {
  const resolvedId = id ?? slugify(title);

  return (
    <DocsDetails
      className="docs-expandable"
      defaultOpen={isTruthy(defaultOpen)}
      id={resolvedId}
      summary={
        <span className="docs-accordion-summary">
          {icon ? <DocsIcon icon={icon} iconType={iconType} size={17} /> : null}
          <span>
            <strong>{title}</strong>
          </span>
        </span>
      }
    >
      {children}
    </DocsDetails>
  );
}

export function Panel({
  children,
  title,
}: PropsWithChildren<{ title?: string }>) {
  return (
    <DocsSidePanelBlock
      className="docs-panel"
      kind="panel"
      title={title ?? "Panel"}
    >
      {title ? <p className="docs-panel-label">{title}</p> : null}
      {children}
    </DocsSidePanelBlock>
  );
}

export function Frame({
  children,
  caption,
  hint,
}: PropsWithChildren<{
  caption?: ReactNode;
  hint?: ReactNode;
}>) {
  return (
    <figure className="docs-frame">
      {withFrameMediaDefaults(children)}
      {caption || hint ? (
        <figcaption>
          {caption ? <span>{caption}</span> : null}
          {hint ? <small>{hint}</small> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function Badge({
  children,
  className,
  color,
  disabled,
  icon,
  iconType,
  shape,
  size,
  stroke,
  variant,
}: BadgeProps) {
  return (
    <span
      className={classNames("docs-badge", className)}
      data-color={color}
      data-disabled={isTruthy(disabled) ? "true" : undefined}
      data-shape={shape}
      data-size={size}
      data-stroke={isTruthy(stroke) ? "true" : undefined}
      data-variant={variant}
      style={colorStyle(color, "badge")}
    >
      {icon ? (
        <DocsIcon icon={icon} iconType={iconType} size={13} stroke={stroke} />
      ) : null}
      {children}
    </span>
  );
}

export function Icon({
  color,
  icon,
  iconType,
  label,
  name,
  size = 18,
  stroke,
}: IconishProps & {
  color?: string;
  label?: string;
  name?: string;
  size?: number;
}) {
  const resolvedIcon = icon ?? name ?? "info";

  return (
    <span className="docs-icon" style={color ? { color } : undefined}>
      <DocsIcon
        icon={resolvedIcon}
        iconType={iconType}
        label={label}
        size={size}
        stroke={stroke}
      />
    </span>
  );
}

export function Update({
  children,
  description,
  id,
  label = "Update",
  rss,
  tags,
}: UpdateProps) {
  const resolvedId = id ?? slugify(label);
  const tagList = normalizeTags(tags);

  return (
    <aside className="docs-update" id={resolvedId} data-rss={rss ? "true" : undefined}>
      <div className="docs-update-header">
        <strong>{label}</strong>
        <a href={`#${resolvedId}`} aria-label={`Link to ${label}`}>
          #
        </a>
      </div>
      {description ? <p>{description}</p> : null}
      {tagList.length > 0 ? (
        <div className="docs-update-tags">
          {tagList.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      ) : null}
      <div>{children}</div>
    </aside>
  );
}

export function Banner({
  children,
  icon,
  iconType,
  title,
}: PropsWithChildren<IconishProps & { title?: string }>) {
  return (
    <aside className="docs-banner">
      {icon ? <DocsIcon icon={icon} iconType={iconType} size={18} /> : null}
      <div>
        {title ? <strong>{title}</strong> : null}
        {children}
      </div>
    </aside>
  );
}

export function ParamField(props: FieldProps) {
  return <ApiField {...props} kind="param" />;
}

export function ResponseField(props: FieldProps) {
  return <ApiField {...props} kind="response" />;
}

export function RequestExample({
  children,
  title = "Request example",
}: ExampleProps) {
  return (
    <DocsSidePanelBlock
      className="docs-example"
      kind="request-example"
      title={title}
    >
      <p>{title}</p>
      {children}
    </DocsSidePanelBlock>
  );
}

export function ResponseExample({
  children,
  title = "Response example",
}: ExampleProps) {
  return (
    <DocsSidePanelBlock
      className="docs-example"
      kind="response-example"
      title={title}
    >
      <p>{title}</p>
      {children}
    </DocsSidePanelBlock>
  );
}

export function Warning({ children }: PropsWithChildren) {
  return <Callout variant="warning">{children}</Callout>;
}

export function Note({ children }: PropsWithChildren) {
  return <Callout variant="note">{children}</Callout>;
}

export function Info({ children }: PropsWithChildren) {
  return <Callout variant="info">{children}</Callout>;
}

export function Tip({ children }: PropsWithChildren) {
  return <Callout variant="tip">{children}</Callout>;
}

export function Check({ children }: PropsWithChildren) {
  return <Callout variant="check">{children}</Callout>;
}

export function Danger({ children }: PropsWithChildren) {
  return <Callout variant="danger">{children}</Callout>;
}

export function Callout({
  children,
  color,
  icon,
  iconType,
  title,
  type,
  variant = "note",
}: CalloutProps) {
  const resolvedVariant = type ?? variant;
  const resolvedIcon = icon ?? defaultCalloutIcons[resolvedVariant] ?? "info";

  return (
    <aside
      className={`docs-callout docs-callout-${resolvedVariant}`}
      style={colorStyle(color, "callout")}
    >
      <DocsIcon icon={resolvedIcon} iconType={iconType} size={20} />
      <div>
        {title ? <strong className="docs-callout-title">{title}</strong> : null}
        {children}
      </div>
    </aside>
  );
}

export function Tile({
  children,
  cta,
  href,
  icon = "file-text",
  iconType,
  img,
  title,
}: PropsWithChildren<
  IconishProps & {
    cta?: string;
    href?: string;
    img?: string;
    title?: string;
  }
>) {
  const body = (
    <>
      {img ? <img src={img} alt="" /> : null}
      <span className="docs-tile-icon">
        <DocsIcon icon={icon} iconType={iconType} size={18} />
      </span>
      <span>
        {title ? <strong>{title}</strong> : null}
        {children ? <span>{children}</span> : null}
        {cta ? <em>{cta}</em> : null}
      </span>
    </>
  );

  if (href) {
    return (
      <Link className="docs-tile" href={href}>
        {body}
      </Link>
    );
  }

  return <div className="docs-tile">{body}</div>;
}

export function Tooltip({
  children,
  content,
  tip,
}: PropsWithChildren<{ content?: string; tip?: string }>) {
  const label = tip ?? content ?? "";

  return (
    <span className="docs-tooltip" tabIndex={0}>
      {children}
      {label ? <span role="tooltip">{label}</span> : null}
    </span>
  );
}

export function Prompt({
  children,
  cursor,
  description,
  title = "Prompt",
}: PropsWithChildren<{
  cursor?: Booleanish;
  description?: string;
  title?: string;
}>) {
  const promptText = textFromNode(children);
  const cursorHref = `cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(
    promptText,
  )}`;

  return (
    <section className="docs-prompt">
      <div className="docs-prompt-header">
        <strong>{title}</strong>
        <span>
          {isTruthy(cursor) ? <a href={cursorHref}>Cursor</a> : null}
          <CodeCopyButton code={promptText} />
        </span>
      </div>
      {description ? <p>{description}</p> : null}
      <div className="docs-prompt-body">{children}</div>
    </section>
  );
}

function ColorRoot({ children }: PropsWithChildren) {
  return <div className="docs-color">{children}</div>;
}

function ColorRow({ children }: PropsWithChildren) {
  return <div className="docs-color-row">{children}</div>;
}

function ColorItem({ children, color, name, value }: ColorItemProps) {
  const swatch = color ?? value ?? "#868686";

  return (
    <div
      className="docs-color-item"
      style={{ "--docs-color-swatch": swatch } as CSSProperties}
    >
      <span aria-hidden="true" />
      <strong>{name ?? swatch}</strong>
      {value ? <code>{value}</code> : null}
      {children ? <small>{children}</small> : null}
    </div>
  );
}

export const Color = Object.assign(ColorRoot, {
  Item: ColorItem,
  Row: ColorRow,
});

function TreeRoot({ children }: PropsWithChildren) {
  return <ul className="docs-tree">{children}</ul>;
}

function TreeFolder({
  children,
  defaultOpen = true,
  icon = "folder",
  iconType,
  name,
}: PropsWithChildren<
  IconishProps & {
    defaultOpen?: Booleanish;
    name: string;
  }
>) {
  return (
    <li className="docs-tree-folder">
      <details open={isTruthy(defaultOpen)}>
        <summary>
          <DocsIcon icon={icon} iconType={iconType} size={16} />
          <span>{name}</span>
        </summary>
        <ul>{children}</ul>
      </details>
    </li>
  );
}

function TreeFile({
  icon = "file",
  iconType,
  name,
}: IconishProps & {
  name: string;
}) {
  return (
    <li className="docs-tree-file">
      <DocsIcon icon={icon} iconType={iconType} size={16} />
      <span>{name}</span>
    </li>
  );
}

export const Tree = Object.assign(TreeRoot, {
  File: TreeFile,
  Folder: TreeFolder,
});

export function Mermaid({ code = "", title }: { code?: string; title?: string }) {
  return <MermaidDiagram code={code} title={title} />;
}

export function Visibility({
  children,
  for: audience,
}: PropsWithChildren<{ for?: "agents" | "humans" }>) {
  if (audience === "agents") {
    return null;
  }

  return <>{children}</>;
}

export function UnsupportedComponent({
  children,
  name = "Unsupported component",
}: PropsWithChildren<{ name?: string }>) {
  return (
    <aside className="docs-unsupported">
      <BadgeInfo size={18} aria-hidden="true" />
      <div>
        <strong>{name}</strong>
        <div>{children}</div>
      </div>
    </aside>
  );
}

function ApiField({
  children,
  default: defaultValue,
  deprecated,
  kind,
  optional,
  placeholder,
  post,
  pre,
  required,
  type,
  ...props
}: FieldProps & { kind: "param" | "response" }) {
  const alias = resolveFieldAlias(props);
  const name = props.name ?? alias.name ?? "field";
  const location = alias.location ?? resolveLocationFromType(type);
  const resolvedId = slugify(kind === "response" ? `response-${name}` : name);

  return (
    <div className="docs-api-field" id={resolvedId}>
      <div className="docs-api-field-header">
        <code>{name}</code>
        {type ? <span>{type}</span> : null}
        {location ? <span>{location}</span> : null}
        {pre ? <span>{pre}</span> : null}
        {post ? <span>{post}</span> : null}
        {defaultValue !== undefined ? <span>default: {String(defaultValue)}</span> : null}
        {placeholder ? <span>placeholder: {placeholder}</span> : null}
        {isTruthy(required) ? <strong>Required</strong> : null}
        {isTruthy(optional) ? <em>Optional</em> : null}
        {isTruthy(deprecated) ? <em>Deprecated</em> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

function DocsLink({
  href,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (!href) {
    return <a {...props}>{children}</a>;
  }

  if (href.startsWith("/")) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  );
}

function DocsImage({
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  return <img className="docs-media" alt={alt} {...props} />;
}

function H2({ children }: PropsWithChildren) {
  const id = slugify(textFromNode(children));

  return <h2 id={id}>{children}</h2>;
}

function H3({ children }: PropsWithChildren) {
  const id = slugify(textFromNode(children));

  return <h3 id={id}>{children}</h3>;
}

async function highlightCode(code: string, language: string) {
  try {
    return await codeToHtml(code, {
      lang: language,
      themes: {
        dark: "github-dark",
        light: "github-light",
      },
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}

function decorateCodeLines(
  html: string,
  code: string,
  options: {
    focus?: string;
    highlight?: string;
  },
) {
  const highlighted = parseLineList(options.highlight);
  const focused = parseLineList(options.focus);
  const hasFocus = focused.size > 0;
  const lines = code.split("\n");
  let index = 0;

  return html.replace(/<span class="line">/g, () => {
    index += 1;
    const sourceLine = lines[index - 1] ?? "";
    const classes = ["line"];

    if (highlighted.has(index)) {
      classes.push("highlighted");
    }

    if (hasFocus && !focused.has(index)) {
      classes.push("dimmed");
    }

    if (/^\s*\+/.test(sourceLine)) {
      classes.push("diff-add");
    }

    if (/^\s*-/.test(sourceLine)) {
      classes.push("diff-remove");
    }

    return `<span class="${classes.join(" ")}">`;
  });
}

function parseLineList(value?: string) {
  const lines = new Set<number>();

  for (const part of (value ?? "").split(",")) {
    const trimmed = part.trim();

    if (!trimmed) {
      continue;
    }

    const [start, end] = trimmed.split("-").map((item) => Number(item));

    if (!Number.isFinite(start)) {
      continue;
    }

    if (!Number.isFinite(end)) {
      lines.add(start);
      continue;
    }

    for (let line = start; line <= end; line += 1) {
      lines.add(line);
    }
  }

  return lines;
}

function withFrameMediaDefaults(children: ReactNode) {
  return Children.map(children, (child) => {
    if (!isValidElement<Record<string, unknown>>(child) || child.type !== "video") {
      return child;
    }

    const props = child.props;

    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      controls: props.controls ?? true,
      playsInline: props.playsInline ?? true,
      preload: props.preload ?? "metadata",
    });
  });
}

function resolveFieldAlias(props: Pick<FieldProps, FieldLocation | "name">) {
  for (const location of ["path", "query", "body", "header"] as const) {
    const value = props[location];

    if (typeof value === "string" && value.trim()) {
      return { location, name: value };
    }

    if (value === true) {
      return { location, name: props.name };
    }
  }

  return { location: null, name: null };
}

function resolveLocationFromType(type?: string): FieldLocation | null {
  const normalized = type?.toLowerCase() ?? "";

  for (const location of ["path", "query", "body", "header"] as const) {
    if (normalized.includes(location)) {
      return location;
    }
  }

  return null;
}

function normalizeTags(tags?: string | string[]) {
  if (Array.isArray(tags)) {
    return tags;
  }

  if (!tags) {
    return [];
  }

  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function colorStyle(color: string | undefined, prefix: string) {
  if (!color || !isCssColor(color)) {
    return undefined;
  }

  return {
    [`--${prefix}-accent`]: color,
  } as CSSProperties;
}

function isCssColor(value: string) {
  return /^(#|rgb|hsl|oklch|color-mix|var\()/i.test(value);
}

function isTruthy(value?: Booleanish | number | string) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toNumber(value: number | string | undefined, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const mdxComponents = {
  a: DocsLink,
  img: DocsImage,
  Accordion,
  AccordionGroup,
  Banner,
  Badge,
  Callout,
  Card,
  Check,
  CodeBlock,
  CodeGroup,
  Color,
  Column,
  Columns,
  Danger,
  Expandable,
  Frame,
  Icon,
  Info,
  Mermaid,
  Note,
  Panel,
  ParamField,
  Prompt,
  RequestExample,
  ResponseExample,
  ResponseField,
  Step,
  Steps,
  Tab,
  Tabs,
  Tile,
  Tooltip,
  Tree,
  Tip,
  Update,
  UnsupportedComponent,
  View,
  Visibility,
  Warning,
  h2: H2,
  h3: H3,
};
