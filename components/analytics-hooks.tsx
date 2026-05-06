import Script from "next/script";

import { siteConfig } from "@/site.config";

export function AnalyticsHooks() {
  if (!siteConfig.analytics.enabled) {
    return null;
  }

  const scriptUrl = siteConfig.analytics.scriptUrl;
  const websiteId = siteConfig.analytics.websiteId;

  return (
    <>
      {scriptUrl ? (
        <Script
          src={scriptUrl}
          strategy="afterInteractive"
          data-website-id={websiteId}
        />
      ) : null}
      <Script id="docs-starter-analytics-hooks" strategy="afterInteractive">
        {`
window.addEventListener("docs:feedback", function(event) {
  var detail = event.detail || {};
  if (window.dataLayer && Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: "docs_feedback", docsFeedback: detail });
  }
  if (typeof window.umami === "object" && typeof window.umami.track === "function") {
    window.umami.track("docs_feedback", detail);
  }
});
        `}
      </Script>
    </>
  );
}
