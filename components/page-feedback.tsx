"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";

import { siteConfig } from "@/site.config";

type FeedbackValue = "helpful" | "not-helpful";

type PageFeedbackProps = {
  slug: string;
  title: string;
};

export function PageFeedback({ slug, title }: PageFeedbackProps) {
  const [value, setValue] = useState<FeedbackValue | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const storageKey = `${siteConfig.theme.storageKey}:feedback:${slug}`;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);

      if (stored === "helpful" || stored === "not-helpful") {
        setValue(stored);
        setSubmitted(true);
      }
    } catch {}
  }, [storageKey]);

  if (!siteConfig.feedback.enabled) {
    return null;
  }

  async function submitFeedback(nextValue: FeedbackValue) {
    const payload = {
      kind: "page",
      slug,
      title,
      value: nextValue,
      url: window.location.href,
    };

    setValue(nextValue);
    setSubmitted(true);

    try {
      window.localStorage.setItem(storageKey, nextValue);
    } catch {}

    window.dispatchEvent(
      new CustomEvent("docs:feedback", {
        detail: payload,
      }),
    );

    if (!siteConfig.feedback.endpoint) {
      return;
    }

    await fetch(siteConfig.feedback.endpoint, {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "POST",
    }).catch(() => {});
  }

  return (
    <section className="page-feedback" aria-label="Page feedback">
      <div>
        <strong>Was this page helpful?</strong>
        {submitted ? (
          <span>
            <Check size={14} aria-hidden="true" />
            Feedback saved
          </span>
        ) : null}
      </div>
      <span>
        <button
          type="button"
          aria-pressed={value === "helpful"}
          onClick={() => void submitFeedback("helpful")}
        >
          <ThumbsUp size={16} aria-hidden="true" />
          Yes
        </button>
        <button
          type="button"
          aria-pressed={value === "not-helpful"}
          onClick={() => void submitFeedback("not-helpful")}
        >
          <ThumbsDown size={16} aria-hidden="true" />
          No
        </button>
      </span>
    </section>
  );
}
