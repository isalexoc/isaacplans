"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

interface ShareButtonProps {
  title: string;
  url: string;
  locale?: string;
  className?: string;
}

export function ShareButton({ title, url, locale = "en", className }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const label = locale === "es" ? "Compartir" : "Share";
  const copiedLabel = locale === "es" ? "¡Copiado!" : "Copied!";

  async function handleShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — silent fail
    }
  }

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors ${className ?? ""}`}
      aria-label={`${label} — ${title}`}
    >
      <Share2 className="w-4 h-4 shrink-0" />
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
