"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type CodeCopyButtonProps = {
  code: string;
};

export function CodeCopyButton({ code }: CodeCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1600);

    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <button
      type="button"
      className="code-copy-button"
      aria-label="Copy code"
      onClick={handleCopy}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}
