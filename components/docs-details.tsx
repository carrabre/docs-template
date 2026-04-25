"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

type DocsDetailsProps = {
  children: ReactNode;
  className: string;
  defaultOpen?: boolean;
  id?: string;
  summary: ReactNode;
};

export function DocsDetails({
  children,
  className,
  defaultOpen = false,
  id,
  summary,
}: DocsDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!id) {
      return;
    }

    function openFromHash() {
      if (window.location.hash.slice(1) === id) {
        setOpen(true);
        detailsRef.current?.scrollIntoView({ block: "start" });
      }
    }

    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    return () => window.removeEventListener("hashchange", openFromHash);
  }, [id]);

  return (
    <details
      ref={detailsRef}
      className={className}
      id={id}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{summary}</summary>
      <div>{children}</div>
    </details>
  );
}
