"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

type SiteBannerProps = {
  content: string;
  dismissible?: boolean;
};

const storageKey = "docs_starter_site_banner_dismissed";

export function SiteBanner({ content, dismissible = false }: SiteBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissible) {
      setDismissed(window.localStorage.getItem(storageKey) === content);
    }
  }, [content, dismissible]);

  if (dismissed) {
    return null;
  }

  return (
    <aside className="site-banner">
      <p>{content}</p>
      {dismissible ? (
        <button
          type="button"
          aria-label="Dismiss banner"
          onClick={() => {
            window.localStorage.setItem(storageKey, content);
            setDismissed(true);
          }}
        >
          <X size={15} />
        </button>
      ) : null}
    </aside>
  );
}
