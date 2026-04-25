import { getDocsConfig, getNavGroups } from "@/lib/docs";
import { getLlmsTxt } from "@/lib/markdown";

export function GET() {
  return new Response(getLlmsTxt(getDocsConfig(), getNavGroups()), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
