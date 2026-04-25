import Link from "next/link";

import { DocsShell } from "@/components/docs-shell";
import { DOCS_ORIGIN } from "@/lib/contextual";
import { getNavGroups } from "@/lib/docs";
import { getSearchIndex } from "@/lib/search";
import { siteConfig } from "@/site.config";

const notFoundPage = {
  slug: "404",
  route: "/404",
  filePath: "",
  title: "Page not found",
  sidebarTitle: "Page not found",
  description: "The page you are looking for does not exist in these docs.",
};

export default function NotFound() {
  return (
    <DocsShell
      currentGroup={siteConfig.shortName}
      currentPage={notFoundPage}
      headings={[]}
      navGroups={getNavGroups()}
      nextPage={null}
      pageMarkdown={`# ${notFoundPage.title}\n\n> ${notFoundPage.description}\n\nSource: ${DOCS_ORIGIN}/404\n\nCheck the navigation or return to the docs overview.\n`}
      previousPage={null}
      searchIndex={getSearchIndex()}
    >
      <p>
        Check the navigation or return to the <Link href="/">docs overview</Link>.
      </p>
    </DocsShell>
  );
}
