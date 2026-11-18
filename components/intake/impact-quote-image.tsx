"use client";

import { useEffect, useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import { money, type ImpactTierKey } from "@/lib/impact-quote/plans";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

type Made = { url: string; file: File };

/**
 * "Image to share": the vertical quote image for a client who wants time to think, made from the
 * form (names) and the quote (plan, price). One click to create, then download it or hand it to the
 * device's share sheet (WhatsApp on a phone, and on Chrome for Windows).
 */
export default function ImpactQuoteImage({
  endpoint,
  tier,
  monthly,
  fileName,
  locale,
  clientLocale,
}: {
  endpoint: string;
  tier: ImpactTierKey;
  /** 0 when unknown: the server then prices it from the form's household. */
  monthly: number;
  fileName: string;
  locale: IntakeLocale;
  clientLocale: string;
}) {
  const { names, perMonth } = DECK_COPY[locale].quote;
  const [lang, setLang] = useState<"es" | "en">(clientLocale === "es" ? "es" : "en");
  const [made, setMade] = useState<Made | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "noPrice" | "error">("idle");
  const [canShare, setCanShare] = useState(false);

  // A plan, price or language change makes the image on screen stale.
  useEffect(() => {
    setMade((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [tier, monthly, lang]);

  async function create() {
    setState("loading");
    try {
      const params = new URLSearchParams({ tier, lang, ...(monthly > 0 ? { monthly: String(monthly) } : {}) });
      const res = await fetch(`${endpoint}?${params}`, { credentials: "same-origin" });
      if (res.status === 400) {
        setState("noPrice");
        return;
      }
      if (!res.ok) throw new Error("failed");
      const blob = await res.blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      setMade((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { url: URL.createObjectURL(blob), file };
      });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      setState("idle");
    } catch {
      setState("error");
    }
  }

  async function share() {
    if (!made) return;
    try {
      await navigator.share({ files: [made.file] });
    } catch {
      /* the share sheet was dismissed */
    }
  }

  return (
    <div className="mt-3 border-t border-brand/20 pt-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <ImageIcon className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.quoteImageTitle, locale)} · {names[tier].name}
        {monthly > 0 && ` · ${money(monthly)}${perMonth}`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value === "en" ? "en" : "es")}
          className="h-10 rounded-xl border-2 border-gray-200 bg-white px-2 text-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <button
          type="button"
          onClick={create}
          disabled={state === "loading"}
          className={`${OUTLINE_BTN} w-auto px-4 py-2 text-sm disabled:opacity-50`}
        >
          {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {tr(state === "loading" ? UI.quoteImageCreating : UI.quoteImageCreate, locale)}
        </button>
      </div>
      {state === "noPrice" && <p className="mt-2 text-sm font-medium text-amber-700">{tr(UI.quoteImageNeedPrice, locale)}</p>}
      {state === "error" && <p className="mt-2 text-sm font-medium text-amber-700">{tr(UI.quoteImageFailed, locale)}</p>}
      {made && (
        <div className="mt-3 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, nothing to optimize */}
          <img src={made.url} alt={tr(UI.quoteImageTitle, locale)} className="h-56 w-auto rounded-lg border shadow-sm" />
          <div className="flex flex-col gap-2">
            <a href={made.url} download={made.file.name} className={`${OUTLINE_BTN} w-auto px-4 py-2 text-sm`}>
              <Download className="h-4 w-4" /> {tr(UI.quoteImageDownload, locale)}
            </a>
            {canShare && (
              <button type="button" onClick={share} className={`${OUTLINE_BTN} w-auto px-4 py-2 text-sm`}>
                <Share2 className="h-4 w-4" /> {tr(UI.quoteImageShare, locale)}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
