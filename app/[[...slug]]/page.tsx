import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";

import { DocsShell } from "@/components/docs-shell";
import { mdxComponents } from "@/components/mdx-components";
import {
  getAdjacentPages,
  getAllPageMeta,
  getGroupForPage,
  getNavGroups,
  getPage,
  slugFromSegments,
} from "@/lib/docs";
import { getPageMarkdown } from "@/lib/markdown";
import { remarkDocsCodeBlocks } from "@/lib/remark-code-blocks";
import { getSearchIndex } from "@/lib/search";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export function generateStaticParams() {
  return getAllPageMeta().map((page) => ({
    slug: page.slug === "index" ? [] : page.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug: segments } = await params;
  const page = getPage(slugFromSegments(segments));

  if (!page) {
    return {
      title: "Page not found",
    };
  }

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: page.route,
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { slug: segments } = await params;
  const page = getPage(slugFromSegments(segments));

  if (!page) {
    notFound();
  }

  const { content } = await compileMDX({
    source: page.content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm, remarkDocsCodeBlocks],
      },
    },
  });
  const adjacentPages = getAdjacentPages(page.slug);

  return (
    <DocsShell
      currentGroup={getGroupForPage(page.slug)}
      currentPage={page}
      headings={page.headings}
      navGroups={getNavGroups()}
      nextPage={adjacentPages.next}
      pageMarkdown={getPageMarkdown(page)}
      previousPage={adjacentPages.previous}
      searchIndex={getSearchIndex()}
    >
      {content}
    </DocsShell>
  );
}
