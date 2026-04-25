import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Menu } from "lucide-react";

import { DocsTools } from "@/components/docs-tools";
import {
  DocsLayout,
  DocsSidePanelAside,
  DocsSidePanelProvider,
} from "@/components/docs-side-panel";
import { DocsViewProvider } from "@/components/docs-view";
import { PageContextMenu } from "@/components/page-context-menu";
import { SiteBanner } from "@/components/site-banner";
import { ThemeSwitch } from "@/components/theme-switch";
import type { Heading, NavGroup, PageMeta } from "@/lib/docs";
import { markdownPathForSlug, sourceUrlForSlug } from "@/lib/markdown";
import type { SearchEntry } from "@/lib/search-types";
import { siteConfig } from "@/site.config";

type DocsShellProps = {
  children: ReactNode;
  currentPage: PageMeta;
  currentGroup: string | null;
  headings: Heading[];
  navGroups: NavGroup[];
  pageMarkdown: string;
  previousPage: PageMeta | null;
  nextPage: PageMeta | null;
  searchIndex: SearchEntry[];
};

export function DocsShell({
  children,
  currentPage,
  currentGroup,
  headings,
  navGroups,
  pageMarkdown,
  previousPage,
  nextPage,
  searchIndex,
}: DocsShellProps) {
  return (
    <div className="site-shell">
      <header className="topbar">
        <Link
          href="/"
          className="brand-link"
          aria-label={`${siteConfig.name} home`}
        >
          <span className="brand-logo-frame" aria-hidden="true">
            <img
              className="brand-logo"
              src={siteConfig.logo.mark}
              alt=""
            />
          </span>
          <span className="brand-label">{siteConfig.shortName}</span>
        </Link>

        <div className="topbar-actions">
          <nav className="topbar-nav" aria-label="Primary">
            {siteConfig.header.links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <DocsTools
            currentSlug={currentPage.slug}
            currentTitle={currentPage.title}
            searchIndex={searchIndex}
            variant="search"
          />
          <ThemeSwitch />
        </div>
      </header>

      <DocsTools
        currentSlug={currentPage.slug}
        currentTitle={currentPage.title}
        searchIndex={searchIndex}
        variant="assistant"
      />

      {siteConfig.banner ? (
        <SiteBanner
          content={siteConfig.banner.content}
          dismissible={siteConfig.banner.dismissible}
        />
      ) : null}

      <details className="mobile-nav">
        <summary>
          <Menu size={18} aria-hidden="true" />
          Browse pages
        </summary>
        <DocsNavigation
          currentSlug={currentPage.slug}
          navGroups={navGroups}
          compact
        />
      </details>

      <DocsSidePanelProvider>
        <DocsLayout>
          <aside className="sidebar">
            <DocsNavigation
              currentSlug={currentPage.slug}
              navGroups={navGroups}
            />
          </aside>

          <main className="main-content">
            <article className="doc-article">
              <div className="doc-header">
                <div className="doc-title-block">
                  <p className="doc-eyebrow">{currentGroup ?? "Guide"}</p>
                  <h1>{currentPage.title}</h1>
                </div>
                <PageContextMenu
                  markdown={pageMarkdown}
                  markdownUrl={markdownPathForSlug(currentPage.slug)}
                  pageTitle={currentPage.title}
                  pageUrl={sourceUrlForSlug(currentPage.slug)}
                />
              </div>
              {currentPage.description ? (
                <p className="doc-description">{currentPage.description}</p>
              ) : null}
              <DocsViewProvider>
                <div className="mdx-content">{children}</div>
              </DocsViewProvider>
            </article>

            <nav className="page-footer" aria-label="Page">
              {previousPage ? (
                <Link href={previousPage.route} className="pager pager-prev">
                  <ArrowLeft size={17} aria-hidden="true" />
                  <span>
                    <small>Previous</small>
                    {previousPage.sidebarTitle}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {nextPage ? (
                <Link href={nextPage.route} className="pager pager-next">
                  <span>
                    <small>Next</small>
                    {nextPage.sidebarTitle}
                  </span>
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : null}
            </nav>
          </main>

          <DocsSidePanelAside
            fallback={
              <>
              <p>On this page</p>
              {headings.length > 0 ? (
                <nav aria-label="Table of contents">
                  {headings.map((heading) => (
                    <a
                      key={`${heading.level}-${heading.id}`}
                      className={
                        heading.level === 3 ? "toc-depth-3" : undefined
                      }
                      href={`#${heading.id}`}
                    >
                      {heading.title}
                    </a>
                  ))}
                </nav>
              ) : (
                <span>No sections</span>
              )}
              </>
            }
          />
        </DocsLayout>
      </DocsSidePanelProvider>
    </div>
  );
}

function DocsNavigation({
  currentSlug,
  navGroups,
  compact = false,
}: {
  currentSlug: string;
  navGroups: NavGroup[];
  compact?: boolean;
}) {
  return (
    <nav className={compact ? "docs-nav docs-nav-compact" : "docs-nav"}>
      {navGroups.map((group) => (
        <section key={group.group}>
          <p>{group.group}</p>
          {group.pages.map((page) =>
            page.external ? (
              <a
                key={page.slug}
                href={page.route}
                target="_blank"
                rel="noreferrer"
              >
                {page.sidebarTitle}
              </a>
            ) : (
              <Link
                key={page.slug}
                href={page.route}
                aria-current={page.slug === currentSlug ? "page" : undefined}
              >
                {page.sidebarTitle}
              </Link>
            ),
          )}
        </section>
      ))}
    </nav>
  );
}
