"use client";

export type TopbarPanel = "assistant" | "audio" | "navigation" | "search";

export const TOPBAR_PANEL_EVENT = "docs:topbar-panel-open";

export function announceTopbarPanel(panel: TopbarPanel) {
  window.dispatchEvent(
    new CustomEvent(TOPBAR_PANEL_EVENT, {
      detail: { panel },
    }),
  );
}

export function readTopbarPanel(event: Event): TopbarPanel | null {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  const panel = (event.detail as { panel?: unknown } | null)?.panel;

  return isTopbarPanel(panel) ? panel : null;
}

function isTopbarPanel(value: unknown): value is TopbarPanel {
  return (
    value === "assistant" ||
    value === "audio" ||
    value === "navigation" ||
    value === "search"
  );
}
