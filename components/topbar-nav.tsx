"use client";

import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { DocsIcon } from "@/components/docs-icon";
import {
  TOPBAR_PANEL_EVENT,
  announceTopbarPanel,
  readTopbarPanel,
} from "@/components/topbar-panel-events";
import type { HeaderLink } from "@/site.config";

type TopbarNavProps = {
  links: HeaderLink[];
};

export function TopbarNav({ links }: TopbarNavProps) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpenKey(null);
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        navRef.current &&
        event.target instanceof Node &&
        !navRef.current.contains(event.target)
      ) {
        setOpenKey(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenKey(null);
      }
    }

    function handleTopbarPanelOpen(event: Event) {
      const panel = readTopbarPanel(event);

      if (panel && panel !== "navigation") {
        setOpenKey(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(TOPBAR_PANEL_EVENT, handleTopbarPanelOpen);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(TOPBAR_PANEL_EVENT, handleTopbarPanelOpen);
    };
  }, []);

  return (
    <nav ref={navRef} className="topbar-nav" aria-label="Primary">
      {links.map((link, index) => {
        const key = `${link.label}-${link.href}-${index}`;

        return (
          <HeaderLink
            key={key}
            itemKey={key}
            link={link}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        );
      })}
    </nav>
  );
}

function HeaderLink({
  itemKey,
  link,
  openKey,
  setOpenKey,
}: {
  itemKey: string;
  link: HeaderLink;
  openKey: string | null;
  setOpenKey: Dispatch<SetStateAction<string | null>>;
}) {
  if (link.children && link.children.length > 0) {
    return (
      <details
        className="topbar-dropdown"
        open={openKey === itemKey}
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;

          if (isOpen) {
            announceTopbarPanel("navigation");
          }

          setOpenKey((current) =>
            isOpen ? itemKey : current === itemKey ? null : current,
          );
        }}
      >
        <summary>
          {link.icon ? <DocsIcon icon={link.icon} size={15} /> : null}
          {link.label}
        </summary>
        <div>
          <DocsHeaderAnchor link={link} onNavigate={() => setOpenKey(null)} />
          {link.children.map((child) => (
            <DocsHeaderAnchor
              key={`${child.label}-${child.href}`}
              link={child}
              onNavigate={() => setOpenKey(null)}
            />
          ))}
        </div>
      </details>
    );
  }

  return <DocsHeaderAnchor link={link} onNavigate={() => setOpenKey(null)} />;
}

function DocsHeaderAnchor({
  link,
  onNavigate,
}: {
  link: HeaderLink;
  onNavigate: () => void;
}) {
  const isExternal = link.external || /^https?:\/\//i.test(link.href);
  const body = (
    <>
      {link.icon ? <DocsIcon icon={link.icon} size={15} /> : null}
      {link.label}
      {isExternal ? <ExternalLink size={13} aria-hidden="true" /> : null}
    </>
  );

  if (isExternal) {
    return (
      <a href={link.href} target="_blank" rel="noreferrer" onClick={onNavigate}>
        {body}
      </a>
    );
  }

  return (
    <Link href={link.href} onClick={onNavigate}>
      {body}
    </Link>
  );
}
