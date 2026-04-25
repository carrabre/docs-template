import { getAllPages, getDocsConfig } from "@/lib/docs";
import { getLlmsFullTxt } from "@/lib/markdown";

export function GET() {
  return new Response(getLlmsFullTxt(getDocsConfig(), getAllPages()), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
