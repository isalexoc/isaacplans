"use client";

import { useCallback, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Share this page" control for a public marketing page.
 *
 * On a phone this opens the native share sheet, which is the whole point for this audience —
 * WhatsApp is one tap away and it is how these links actually travel. Desktop browsers without
 * `navigator.share` fall back to copying the link, and a browser that blocks the clipboard (or an
 * insecure origin) falls back again to a prompt the visitor can copy out of by hand.
 *
 * The URL is rebuilt from origin + pathname rather than taken from `location.href`, so an ad's
 * `utm_*` parameters are not passed along to whoever the link is shared with.
 *
 * All strings are passed in: the component is used from server components that already have the
 * page's own translations in hand, so it stays free of any one message namespace.
 */
export default function SharePageButton({
  title,
  text,
  labels,
  className,
}: {
  /** Share-sheet title — most apps show this as the headline. */
  title: string;
  /** Short line that rides along with the link (WhatsApp, SMS, Mail). */
  text: string;
  labels: {
    /** Resting state, e.g. "Compartir". */
    button: string;
    /** While the native sheet is opening. */
    opening: string;
    /** After the link lands on the clipboard. */
    copied: string;
    /** Prompt shown when even the clipboard is unavailable. */
    copyPrompt: string;
  };
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;

    const url = `${window.location.origin}${window.location.pathname}`;

    if (navigator.share) {
      setSharing(true);
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Dismissing the sheet is a normal outcome, not a failure to fall back from.
        if ((error as Error).name === "AbortError") return;
      } finally {
        setSharing(false);
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt(labels.copyPrompt, url);
    }
  }, [labels.copyPrompt, text, title]);

  const label = copied ? labels.copied : sharing ? labels.opening : labels.button;

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      disabled={sharing}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
        "border-brand/25 bg-white text-brand shadow-sm",
        "hover:border-brand/50 hover:bg-brand/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2",
        "disabled:cursor-wait disabled:opacity-70",
        "dark:bg-gray-950 dark:text-brand",
        copied && "border-green-500/40 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300",
        className
      )}
      aria-live="polite"
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>{label}</span>
    </button>
  );
}
