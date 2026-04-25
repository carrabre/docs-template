"use client";

import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { DocsIcon } from "@/components/docs-icon";

type TabsProps = {
  children: ReactNode;
  borderBottom?: boolean;
  defaultTabIndex?: number | string;
  dropdown?: boolean;
  sync?: boolean;
};

type TabProps = {
  title: string;
  icon?: string;
  iconType?: string;
  id?: string;
  children: ReactNode;
};

type SwitchItem = {
  content: ReactNode;
  icon?: string;
  iconType?: string;
  id: string;
  title: string;
};

export function Tabs({
  borderBottom,
  children,
  defaultTabIndex = 0,
  dropdown,
  sync,
}: TabsProps) {
  const tabs = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement<TabProps>)
        .map((tab, index) => ({
          title: tab.props.title,
          icon: tab.props.icon,
          iconType: tab.props.iconType,
          id: tab.props.id ?? slugifyTitle(tab.props.title, index),
          content: tab.props.children,
        })),
    [children],
  );

  return (
    <SwitchGroup
      borderBottom={borderBottom}
      className="docs-tabs"
      defaultTabIndex={defaultTabIndex}
      dropdown={dropdown}
      items={tabs}
      sync={sync}
    />
  );
}

export function Tab({ children }: TabProps) {
  return <>{children}</>;
}

export function CodeGroup({
  children,
  defaultTabIndex = 0,
  dropdown,
  sync,
}: TabsProps) {
  const items = useMemo(() => getCodeGroupItems(children), [children]);

  if (items.length < 2) {
    return <div className="docs-code-group">{children}</div>;
  }

  return (
    <SwitchGroup
      className="docs-code-group docs-code-group-tabbed"
      defaultTabIndex={defaultTabIndex}
      dropdown={dropdown}
      items={items}
      sync={sync}
    />
  );
}

function SwitchGroup({
  borderBottom,
  className,
  defaultTabIndex,
  dropdown,
  items,
  sync,
}: {
  borderBottom?: boolean;
  className: string;
  defaultTabIndex: number | string;
  dropdown?: boolean;
  items: SwitchItem[];
  sync?: boolean;
}) {
  const syncKey = useMemo(() => getSyncKey(items), [items]);
  const [active, setActive] = useState(() =>
    clampIndex(toNumber(defaultTabIndex), items.length),
  );

  useEffect(() => {
    setActive((current) => clampIndex(current, items.length));
  }, [items.length]);

  useEffect(() => {
    if (!sync || !syncKey) {
      return;
    }

    const savedTitle = window.sessionStorage.getItem(syncKey);
    const savedIndex = items.findIndex((item) => item.title === savedTitle);

    if (savedIndex >= 0) {
      setActive(savedIndex);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== syncKey || !event.newValue) {
        return;
      }

      const nextIndex = items.findIndex((item) => item.title === event.newValue);

      if (nextIndex >= 0) {
        setActive(nextIndex);
      }
    }

    function handleSync(event: Event) {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail as { key?: string; title?: string };

      if (detail.key !== syncKey || !detail.title) {
        return;
      }

      const nextIndex = items.findIndex((item) => item.title === detail.title);

      if (nextIndex >= 0) {
        setActive(nextIndex);
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("docs-tabs-sync", handleSync);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("docs-tabs-sync", handleSync);
    };
  }, [items, sync, syncKey]);

  if (items.length === 0) {
    return null;
  }

  function selectTab(index: number) {
    setActive(index);

    if (sync && syncKey) {
      const title = items[index]?.title ?? "";

      window.sessionStorage.setItem(syncKey, title);
      window.dispatchEvent(
        new CustomEvent("docs-tabs-sync", {
          detail: {
            key: syncKey,
            title,
          },
        }),
      );
    }
  }

  const activeItem = items[active] ?? items[0];

  return (
    <div
      className={className}
      data-border-bottom={borderBottom ? "true" : undefined}
      data-dropdown={dropdown ? "true" : undefined}
    >
      {dropdown ? (
        <div className="docs-tabs-select">
          <select
            aria-label="Select tab"
            value={active}
            onChange={(event) => selectTab(Number(event.target.value))}
          >
            {items.map((item, index) => (
              <option key={item.id} value={index}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="docs-tabs-list" role="tablist">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              id={`${item.id}-tab`}
              role="tab"
              aria-controls={`${item.id}-panel`}
              aria-selected={active === index}
              onClick={() => selectTab(index)}
            >
              {item.icon ? (
                <DocsIcon
                  icon={item.icon}
                  iconType={item.iconType}
                  size={15}
                />
              ) : null}
              {item.title}
            </button>
          ))}
        </div>
      )}
      <div
        className="docs-tab-panel"
        id={`${activeItem.id}-panel`}
        role="tabpanel"
        aria-labelledby={`${activeItem.id}-tab`}
      >
        {activeItem.content}
      </div>
    </div>
  );
}

function getCodeGroupItems(children: ReactNode): SwitchItem[] {
  return Children.toArray(children)
    .filter(Boolean)
    .map((child, index) => {
      const element = isValidElement(child)
        ? (child as ReactElement<Record<string, unknown>>)
        : null;
      const title =
        getStringProp(element, "data-code-title") ??
        getStringProp(element, "title") ??
        `Example ${index + 1}`;

      return {
        content: child,
        id: slugifyTitle(title, index),
        title,
      };
    });
}

function getStringProp(
  element: ReactElement<Record<string, unknown>> | null,
  name: string,
) {
  const value = element?.props[name];
  return typeof value === "string" && value.trim() ? value : null;
}

function getSyncKey(items: SwitchItem[]) {
  if (items.length < 2) {
    return "";
  }

  return `docs-tabs:${items.map((item) => item.title).join("|").toLowerCase()}`;
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  if (!Number.isFinite(index)) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function slugifyTitle(title: string, index: number) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `tab-${slug || index + 1}-${index}`;
}
