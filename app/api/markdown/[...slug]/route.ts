import { getPage } from "@/lib/docs";
import { getPageMarkdown, slugFromMarkdownSegments } from "@/lib/markdown";

type MarkdownRouteContext = {
  params: Promise<{
    slug: string[];
  }>;
};

export async function GET(request: Request, context: MarkdownRouteContext) {
  const { slug: segments } = await context.params;
  const pathname = new URL(request.url).pathname;
  const markdownPath = decodeURIComponent(pathname).replace(
    /^\/api\/markdown\//,
    "",
  );
  const page = getPage(
    slugFromMarkdownSegments(markdownPath ? markdownPath.split("/") : segments),
  );

  if (!page) {
    return new Response("Not found\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(getPageMarkdown(page), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
