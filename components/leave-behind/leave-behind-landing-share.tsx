"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaveBehindLandingShareProps = {
  className?: string;
};

export function LeaveBehindLandingShare({ className }: LeaveBehindLandingShareProps) {
  const t = useTranslations("finalExpenseLeaveBehind.landing");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;

    const url = window.location.href;
    const shareData = {
      title: t("shareTitle"),
      text: t("shareText"),
      url,
    };

    if (navigator.share) {
      setSharing(true);
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
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
      window.prompt(t("shareCopyPrompt"), url);
    }
  }, [t]);

  const label = copied ? t("shareCopied") : sharing ? t("shareOpening") : t("shareButton");

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      disabled={sharing}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition",
        "border-white/20 bg-white/5 text-white backdrop-blur-sm",
        "hover:border-sky-400/40 hover:bg-sky-500/15 hover:text-sky-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a12]",
        "disabled:cursor-wait disabled:opacity-70",
        copied && "border-emerald-400/40 bg-emerald-500/15 text-emerald-100",
        className
      )}
      aria-live="polite"
      aria-label={copied || sharing ? undefined : t("shareButton")}
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Share2 className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span className={cn(copied || sharing ? "inline" : "hidden sm:inline")}>{label}</span>
    </button>
  );
}
