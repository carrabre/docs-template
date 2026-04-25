import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { siteConfig } from "@/site.config";
import "./globals.css";

const themeScript = `
(function() {
  var storageKey = ${JSON.stringify(siteConfig.theme.storageKey)};
  var cookieName = ${JSON.stringify(siteConfig.theme.cookieName)};
  var systemQuery = "(prefers-color-scheme: dark)";
  var themeColors = ${JSON.stringify(siteConfig.theme.colors)};

  function isThemePreference(value) {
    return value === "system" || value === "light" || value === "dark";
  }

  function getCookiePreference() {
    var match = document.cookie.match(new RegExp("(?:^|; )" + cookieName + "=([^;]*)"));
    var value = match ? decodeURIComponent(match[1]) : null;
    return isThemePreference(value) ? value : null;
  }

  function getPreference() {
    try {
      var stored = window.localStorage.getItem(storageKey);
      if (isThemePreference(stored)) return stored;
    } catch (error) {}
    return getCookiePreference() || ${JSON.stringify(siteConfig.theme.default)};
  }

  function getEffectiveTheme(preference) {
    if (preference === "light" || preference === "dark") return preference;
    return window.matchMedia(systemQuery).matches ? "dark" : "light";
  }

  function setThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = themeColors[theme];
  }

  var preference = getPreference();
  var theme = getEffectiveTheme(preference);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = theme;
  setThemeColor(theme);
})();
`;

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.metadata.title.default,
    template: siteConfig.metadata.title.template,
  },
  description: siteConfig.metadata.description,
  icons: {
    icon: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.theme.colors.light,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script
          id="docs-starter-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
        {children}
      </body>
    </html>
  );
}
