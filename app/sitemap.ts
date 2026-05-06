import type { MetadataRoute } from "next";

import { getAllPageMeta } from "@/lib/docs";
import { siteConfig } from "@/site.config";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.url.replace(/\/+$/, "");

  return getAllPageMeta()
    .filter((page) => !page.external)
    .map((page) => ({
      url: `${baseUrl}${page.route}`,
      lastModified: page.lastUpdated ? new Date(page.lastUpdated) : undefined,
      changeFrequency: "weekly",
      priority: page.slug === "index" ? 1 : 0.7,
    }));
}
