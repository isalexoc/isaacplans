"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import { money, type ImpactTierKey } from "@/lib/impact-quote/plans";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

type Made = { url: string; file: File };

/** The file name the server gave the image (`Content-Disposition`), without ".png". */
function serverFileName(res: Response): string | null {
  return /filename="([^"]+)\.png"/i.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? null;
}

/**
 * "Image to share": the vertical quote image for a client who wants time to think. One click to
 * create, then download it or hand it to the device's share sheet (WhatsApp on a phone, and on
 * Chrome for Windows).
 *
 * The intake's panel asks with a GET (names from the form, plan and price from the panel). Isaac's
 * box on /impact POSTs what he typed (`extra`) and no price: its server asks Impact again. Any
 * change to what goes into the image clears the one on screen, and an answer to an older request
 * is dropped.
 */
export default function ImpactQuoteImage({
  endpoint,
  tier,
  monthly,
  fileName,
  locale,
  clientLocale,
  method = "GET",
  extra,
  disabled = false,
}: {
  endpoint: string;
  tier: ImpactTierKey;
  /** 0 when unknown: the server then prices it from the form's household. Never sent by a POST. */
  monthly: number;
  /** Without ".png". Absent: the name the server gives it. */
  fileName?: string;
  locale: IntakeLocale;
  clientLocale: string;
  /** POST sends `{...extra, tier, lang}` as JSON, so nothing private lands in a URL. */
  method?: "GET" | "POST";
  /** More of what goes into the image (POST only); a change clears the image on screen. */
  extra?: Record<string, unknown>;
  /** "Create image" stays off, say until a name is typed. */
  disabled?: boolean;
}) {
  const { names, perMonth } = DECK_COPY[locale].quote;
  const [lang, setLang] = useState<"es" | "en">(clientLocale === "es" ? "es" : "en");
  const [made, setMade] = useState<Made | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "noPrice" | "error">("idle");
  const [canShare, setCanShare] = useState(false);
  /** Bumped whenever the inputs change: an answer to an older request must not show. */
  const generation = useRef(0);
  const extraKey = extra === undefined ? "" : JSON.stringify(extra);

  // A plan, price, language or any other input change makes the image on screen stale.
  useEffect(() => {
    generation.current += 1;
    setMade(null);
  }, [tier, monthly, lang, extraKey]);

  // The preview's blob URL lives as long as the preview: freed once it is replaced, cleared or unmounted.
  useEffect(() => {
    if (!made) return;
    return () => URL.revokeObjectURL(made.url);
  }, [made]);

  // Unmounted: an answer still on its way is for nobody, so it never becomes a blob URL.
  useEffect(
    () => () => {
      generation.current += 1;
    },
    []
  );

  async function create() {
    const asked = generation.current;
    /** The inputs changed while this request was out: its answer is for an image no longer wanted. */
    const stale = () => asked !== generation.current;
    setState("loading");
    try {
      const res =
        method === "POST"
          ? await fetch(endpoint, {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...extra, tier, lang }),
            })
          : await fetch(
              `${endpoint}?${new URLSearchParams({ tier, lang, ...(monthly > 0 ? { monthly: String(monthly) } : {}) })}`,
              { credentials: "same-origin" }
            );
      const blob = res.ok ? await res.blob() : null;
      if (stale()) {
        setState("idle");
        return;
      }
      // A GET's 400 means the intake has no price yet. A POST's means its body was refused, which
      // the box's own checks rule out: a plain failure, not "quote first".
      if (res.status === 400 && method === "GET") {
        setState("noPrice");
        return;
      }
      if (!blob) throw new Error("failed");
      const file = new File([blob], `${fileName ?? serverFileName(res) ?? "impact"}.png`, { type: "image/png" });
      setMade({ url: URL.createObjectURL(blob), file });
      setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
      setState("idle");
    } catch {
      setState(stale() ? "idle" : "error");
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
          disabled={disabled || state === "loading"}
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
