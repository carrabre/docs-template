"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Maximize2, X } from "lucide-react";

type ZoomableMediaProps = {
  alt?: string;
  caption?: ReactNode;
  children?: ReactNode;
  src?: string;
};

export function ZoomableMedia({
  alt = "",
  caption,
  children,
  src,
}: ZoomableMediaProps) {
  const [isOpen, setIsOpen] = useState(false);
  const body = src ? <img src={src} alt={alt} /> : children;

  return (
    <figure className="docs-zoomable">
      <button
        type="button"
        className="docs-zoomable-trigger"
        onClick={() => setIsOpen(true)}
      >
        {body}
        <span>
          <Maximize2 size={15} aria-hidden="true" />
          Zoom
        </span>
      </button>
      {caption ? <figcaption>{caption}</figcaption> : null}
      {isOpen ? (
        <div
          className="docs-zoomable-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={alt || "Zoomed media"}
        >
          <button
            type="button"
            aria-label="Close zoomed media"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} aria-hidden="true" />
          </button>
          <div>{body}</div>
        </div>
      ) : null}
    </figure>
  );
}
