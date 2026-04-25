"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Code2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type MermaidDiagramProps = {
  code: string;
  title?: string;
};

type DragState = {
  active: boolean;
  left: number;
  top: number;
  x: number;
  y: number;
};

export function MermaidDiagram({ code, title }: MermaidDiagramProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    left: 0,
    top: 0,
    x: 0,
    y: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [svg, setSvg] = useState("");
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        const theme =
          document.documentElement.dataset.theme === "dark" ? "dark" : "default";

        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          theme,
        });

        const result = await mermaid.render(`docs-mermaid-${id}`, code);

        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Unable to render Mermaid diagram.",
          );
          setSvg("");
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, id]);

  function resetView() {
    setZoom(1);
    if (scrollerRef.current) {
      scrollerRef.current.scrollLeft = 0;
      scrollerRef.current.scrollTop = 0;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    dragRef.current = {
      active: true,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
    scroller.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;
    const drag = dragRef.current;

    if (!scroller || !drag.active) {
      return;
    }

    scroller.scrollLeft = drag.left - (event.clientX - drag.x);
    scroller.scrollTop = drag.top - (event.clientY - drag.y);
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <figure className="docs-mermaid">
      <figcaption className="docs-mermaid-header">
        <span>{title || "Mermaid diagram"}</span>
        <span className="docs-mermaid-actions">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
          >
            <ZoomOut size={15} />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(2.4, value + 0.15))}
          >
            <ZoomIn size={15} />
          </button>
          <button type="button" aria-label="Reset diagram" onClick={resetView}>
            <RotateCcw size={15} />
          </button>
          <button
            type="button"
            aria-label="Toggle Mermaid source"
            aria-pressed={showSource}
            onClick={() => setShowSource((value) => !value)}
          >
            <Code2 size={15} />
          </button>
        </span>
      </figcaption>
      <div
        ref={scrollerRef}
        className="docs-mermaid-scroller"
        onPointerCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
      >
        {svg ? (
          <div
            className="docs-mermaid-canvas"
            style={{ transform: `scale(${zoom})` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <p>{error || "Rendering diagram..."}</p>
        )}
      </div>
      {error || showSource ? (
        <pre className="docs-mermaid-source">
          <code>{code}</code>
        </pre>
      ) : null}
    </figure>
  );
}
