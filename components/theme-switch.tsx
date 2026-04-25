"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { siteConfig } from "@/site.config";

type ThemePreference = "system" | "light" | "dark";
type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = siteConfig.theme.storageKey;
const COOKIE_NAME = siteConfig.theme.cookieName;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SYSTEM_QUERY = "(prefers-color-scheme: dark)";
const THEME_COLORS: Record<EffectiveTheme, string> = {
  light: siteConfig.theme.colors.light,
  dark: siteConfig.theme.colors.dark,
};

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getCookiePreference(): ThemePreference | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`),
  );
  const value = match ? decodeURIComponent(match[1]) : null;

  return isThemePreference(value) ? value : null;
}

function getStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (isThemePreference(stored)) {
      return stored;
    }
  } catch {
    // Storage can fail in restricted browsing contexts. Fall back to cookies.
  }

  return getCookiePreference() ?? siteConfig.theme.default;
}

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia(SYSTEM_QUERY).matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): EffectiveTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function setThemeColor(theme: EffectiveTheme) {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }

  meta.content = THEME_COLORS[theme];
}

function applyTheme(preference: ThemePreference): EffectiveTheme {
  const theme = resolveTheme(preference);

  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = theme;
  setThemeColor(theme);

  return theme;
}

function persistTheme(preference: ThemePreference) {
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Cookie persistence below keeps the preference available.
  }

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    preference,
  )}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeSwitch() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [effectiveTheme, setEffectiveTheme] =
    useState<EffectiveTheme>("light");

  useEffect(() => {
    function syncTheme() {
      const nextPreference = getStoredPreference();
      setPreference(nextPreference);
      setEffectiveTheme(applyTheme(nextPreference));
    }

    syncTheme();
  }, []);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const media = window.matchMedia(SYSTEM_QUERY);

    function handleSystemChange() {
      setEffectiveTheme(applyTheme("system"));
    }

    media.addEventListener("change", handleSystemChange);

    return () => {
      media.removeEventListener("change", handleSystemChange);
    };
  }, [preference]);

  function selectTheme(nextPreference: ThemePreference) {
    persistTheme(nextPreference);
    setPreference(nextPreference);
    setEffectiveTheme(applyTheme(nextPreference));
  }

  const nextTheme: EffectiveTheme = effectiveTheme === "dark" ? "light" : "dark";
  const ActiveIcon = effectiveTheme === "dark" ? Moon : Sun;
  const label =
    preference === "system"
      ? `System ${effectiveTheme}`
      : effectiveTheme === "dark"
        ? "Dark"
        : "Light";

  return (
    <button
      type="button"
      className="theme-switch"
      data-theme-preference={preference}
      data-effective-theme={effectiveTheme}
      aria-label={`Switch to ${nextTheme} mode. Current mode is ${effectiveTheme}.`}
      onClick={() => selectTheme(nextTheme)}
    >
      <ActiveIcon size={15} aria-hidden="true" />
      <span className="theme-switch-label">{label}</span>
    </button>
  );
}
