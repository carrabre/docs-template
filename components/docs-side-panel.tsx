"use client";

import {
  createContext,
  type CSSProperties,
  type PointerEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type SidePanelItem = {
  content: ReactNode;
  id: string;
  kind: string;
  title: string;
};

type SidePanelContextValue = {
  items: SidePanelItem[];
  register: (item: SidePanelItem) => () => void;
};

type RightRailContextValue = {
  setWidth: (width: number) => void;
  width: number;
};

const defaultRailWidth = 230;
const minRailWidth = 230;
const maxRailWidth = 520;
const SidePanelContext = createContext<SidePanelContextValue | null>(null);
const RightRailContext = createContext<RightRailContextValue | null>(null);

export function DocsSidePanelProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SidePanelItem[]>([]);

  const register = useCallback((item: SidePanelItem) => {
    setItems((current) => {
      const existing = current.findIndex((entry) => entry.id === item.id);

      if (existing === -1) {
        return [...current, item];
      }

      return current.map((entry, index) => (index === existing ? item : entry));
    });

    return () => {
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    };
  }, []);

  const value = useMemo(
    () => ({
      items,
      register,
    }),
    [items, register],
  );

  return (
    <SidePanelContext.Provider value={value}>
      {children}
    </SidePanelContext.Provider>
  );
}

export function DocsLayout({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(defaultRailWidth);
  const value = useMemo(
    () => ({
      setWidth: (nextWidth: number) => setWidth(clampRailWidth(nextWidth)),
      width,
    }),
    [width],
  );

  return (
    <RightRailContext.Provider value={value}>
      <div
        className="docs-layout"
        style={{ "--right-rail-width": `${width}px` } as CSSProperties}
      >
        {children}
      </div>
    </RightRailContext.Provider>
  );
}

export function DocsSidePanelAside({ fallback }: { fallback: ReactNode }) {
  const context = useContext(SidePanelContext);

  if (!context || context.items.length === 0) {
    return (
      <DocsRightRail ariaLabel="Table of contents">
        {fallback}
      </DocsRightRail>
    );
  }

  return (
    <DocsRightRail ariaLabel="Related examples" className="docs-side-panel">
      <p>Panel</p>
      <div className="docs-side-panel-stack">
        {context.items.map((item) => (
          <section
            key={item.id}
            className="docs-side-panel-card"
            data-kind={item.kind}
          >
            <strong>{item.title}</strong>
            <div>{item.content}</div>
          </section>
        ))}
      </div>
    </DocsRightRail>
  );
}

export function DocsSidePanelBlock({
  children,
  className = "docs-panel",
  kind = "panel",
  title = "Panel",
}: {
  children: ReactNode;
  className?: string;
  kind?: string;
  title?: string;
}) {
  const context = useContext(SidePanelContext);
  const register = context?.register;
  const generatedId = useId();
  const id = generatedId.replace(/:/g, "");
  const item = useMemo(
    () => ({
      content: children,
      id,
      kind,
      title,
    }),
    [children, id, kind, title],
  );

  useEffect(() => {
    if (!register) {
      return;
    }

    return register(item);
  }, [item, register]);

  return (
    <section
      className={`${className} docs-side-panel-inline`}
      data-side-panel-registered={register ? "true" : "false"}
    >
      {children}
    </section>
  );
}

function DocsRightRail({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const context = useContext(RightRailContext);
  const drag = useRef<{
    pointerId: number;
    startWidth: number;
    startX: number;
  } | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!context) {
      return;
    }

    drag.current = {
      pointerId: event.pointerId,
      startWidth: context.width,
      startX: event.clientX,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.dataset.resizingRightRail = "true";
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!context || !drag.current) {
      return;
    }

    context.setWidth(
      drag.current.startWidth + drag.current.startX - event.clientX,
    );
  }

  function stopDrag(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
      delete document.body.dataset.resizingRightRail;
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!context) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      context.setWidth(context.width + 20);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      context.setWidth(context.width - 20);
    }

    if (event.key === "Home") {
      event.preventDefault();
      context.setWidth(minRailWidth);
    }

    if (event.key === "End") {
      event.preventDefault();
      context.setWidth(maxRailWidth);
    }
  }

  return (
    <aside
      className={["toc", "docs-right-rail", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="docs-right-rail-resizer"
        aria-label="Resize right sidebar"
        aria-valuemax={maxRailWidth}
        aria-valuemin={minRailWidth}
        aria-valuenow={context?.width ?? defaultRailWidth}
        onKeyDown={handleKeyDown}
        onPointerCancel={stopDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
      />
      {children}
    </aside>
  );
}

function clampRailWidth(width: number) {
  return Math.min(Math.max(width, minRailWidth), maxRailWidth);
}
