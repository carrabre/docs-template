"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type ViewItem = {
  id: string;
  title: string;
};

type ViewContextValue = {
  activeId: string | null;
  register: (view: ViewItem) => () => void;
  setActiveId: (id: string) => void;
  views: ViewItem[];
};

const ViewContext = createContext<ViewContextValue | null>(null);
const storageKey = "docs_starter_active_view";

export function DocsViewProvider({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<ViewItem[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);

  const register = useCallback((view: ViewItem) => {
    setViews((current) => {
      if (current.some((entry) => entry.id === view.id)) {
        return current;
      }

      return [...current, view];
    });

    return () => {
      setViews((current) => current.filter((entry) => entry.id !== view.id));
    };
  }, []);

  const setActiveId = useCallback(
    (id: string) => {
      setActiveIdState(id);
      const view = views.find((entry) => entry.id === id);

      if (view) {
        window.localStorage.setItem(storageKey, view.title);
      }
    },
    [views],
  );

  useEffect(() => {
    if (views.length === 0 || activeId) {
      return;
    }

    const saved = window.localStorage.getItem(storageKey);
    const savedView = saved
      ? views.find((entry) => entry.title === saved)
      : null;
    setActiveIdState((savedView ?? views[0]).id);
  }, [activeId, views]);

  const value = useMemo(
    () => ({
      activeId,
      register,
      setActiveId,
      views,
    }),
    [activeId, register, setActiveId, views],
  );

  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function View({
  children,
  title = "View",
}: {
  children: ReactNode;
  title?: string;
}) {
  const context = useContext(ViewContext);
  const register = context?.register;
  const generatedId = useId();
  const id = generatedId.replace(/:/g, "");

  useEffect(() => {
    if (!register) {
      return;
    }

    return register({ id, title });
  }, [id, register, title]);

  if (!context) {
    return (
      <section className="docs-view-panel">
        <strong>{title}</strong>
        <div>{children}</div>
      </section>
    );
  }

  const activeId = context.activeId ?? context.views[0]?.id ?? id;
  const isActive = activeId === id;
  const isController = (context.views[0]?.id ?? id) === id;

  return (
    <>
      {isController ? (
        <div className="docs-view-controls">
          <select
            aria-label="Select view"
            value={activeId}
            onChange={(event) => context.setActiveId(event.target.value)}
          >
            {context.views.map((view) => (
              <option key={view.id} value={view.id}>
                {view.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {isActive ? (
        <section className="docs-view-panel" data-view-title={title}>
          <strong>{title}</strong>
          <div>{children}</div>
        </section>
      ) : null}
    </>
  );
}
