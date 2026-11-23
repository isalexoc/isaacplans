"use client";

import { useEffect, useId, useMemo, useState, type TouchEvent } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import ImpactQuoteImage from "@/components/intake/impact-quote-image";
import { holdGaOff } from "@/lib/analytics/ga-id";
import {
  cleanQuoteImageName,
  isQuoteImageName,
  namesFitQuote,
  QUOTE_IMAGE_NAME_MAX,
  QUOTE_IMAGE_OTHERS_MAX,
  type HouseholdSize,
  type ImpactTierKey,
} from "@/lib/impact-quote/plans";
import { DECK_COPY, type DeckLocale } from "./copy";

const COPY = {
  en: {
    title: "Quote image for someone",
    private: "Only you see this",
    name: "Name on the image",
    others: "Other people (optional, one per line)",
    typeName: "Type a name to create the image.",
    latinOnly: "Names can only use Latin letters (A–Z, á, ñ…).",
    upToMax: `Up to ${QUOTE_IMAGE_OTHERS_MAX} other people.`,
    tooMany: (household: string) => `More names than people quoted (${household}).`,
  },
  es: {
    title: "Imagen de cotización para alguien",
    private: "Solo usted ve esto",
    name: "Nombre en la imagen",
    others: "Otras personas (opcional, una por línea)",
    typeName: "Escriba un nombre para crear la imagen.",
    latinOnly: "Los nombres solo pueden usar letras latinas (A–Z, á, ñ…).",
    upToMax: `Hasta ${QUOTE_IMAGE_OTHERS_MAX} personas más.`,
    tooMany: (household: string) => `Hay más nombres que personas cotizadas (${household}).`,
  },
} as const;

/** Every line at most 80 characters, as the name's own maxLength does. Lines are never dropped. */
function clipLines(text: string): string {
  return text
    .split("\n")
    .map((line) => line.slice(0, QUOTE_IMAGE_NAME_MAX))
    .join("\n");
}

/**
 * Meta Pixel off for the rest of this page: no more events, so no automatic advanced matching of
 * what is typed here. The Pixel loads after the page, so wait for it a little if it isn't there.
 */
function revokePixelConsent(): () => void {
  const revoke = () => {
    if (typeof window.fbq !== "function") return false;
    window.fbq("consent", "revoke");
    return true;
  };
  if (revoke()) return () => {};
  let tries = 0;
  const timer = window.setInterval(() => {
    if (revoke() || ++tries >= 20) window.clearInterval(timer);
  }, 500);
  return () => window.clearInterval(timer);
}

/**
 * Isaac's quote image for anyone he quotes on /impact (a client's friend or relative), with no
 * intake: he types their name, and the image comes out of the plan selected above and the quote's
 * two answers. Admin only: /impact loads this file only for an admin.
 *
 * /impact is public, so Meta Pixel and GA run here. When this box mounts, both are switched off:
 * Pixel consent is revoked until the page is reloaded, and GA is held off for the rest of the
 * page's life (`holdGaOff`: the layout's privacy guard checks the hold, whatever order the two
 * effects run in, and on later path changes). The inputs sit in no form and carry no name-like attribute, so nothing
 * in the page reads them as a person's name. The names go out in a POST body only, are cleaned
 * and checked as the route checks them (one line each, letters the image's font has), and are
 * kept nowhere.
 */
export default function GuideQuoteImage({
  locale,
  tier,
  monthly,
  asked,
  oldestDob,
  senior,
}: {
  locale: DeckLocale;
  tier: ImpactTierKey;
  /** The selected card's price, shown beside the plan. The server prices the image itself. */
  monthly: number;
  asked: HouseholdSize;
  oldestDob: string;
  senior: boolean;
}) {
  const c = COPY[locale];
  const q = DECK_COPY[locale].quote;
  const id = useId();
  const [applicantText, setApplicantText] = useState("");
  const [othersText, setOthersText] = useState("");

  useEffect(() => {
    holdGaOff();
    return revokePixelConsent();
  }, []);

  // Cleaned exactly as the route cleans them, so the button and the server never disagree.
  const applicant = cleanQuoteImageName(applicantText);
  const others = useMemo(() => othersText.split("\n").map(cleanQuoteImageName).filter(Boolean), [othersText]);
  const applicantBad = applicant !== "" && !isQuoteImageName(applicant);
  const othersBad = others.some((name) => !isQuoteImageName(name));
  const tooManyOthers = others.length > QUOTE_IMAGE_OTHERS_MAX;
  const fits = namesFitQuote(1 + others.length, asked, senior);
  // Why "Create image" waits, if it does: the first thing to fix.
  const hint = !applicant
    ? c.typeName
    : applicantBad || othersBad
      ? c.latinOnly
      : tooManyOthers
        ? c.upToMax
        : !fits
          ? c.tooMany(q.household(asked, null))
          : null;
  const hintId = `${id}-hint`;
  const extra = useMemo(() => ({ applicant, others, asked, oldestDob }), [applicant, others, asked, oldestDob]);

  // Swipes in here are for the text, never for turning the guide's page.
  const keepTouch = (e: TouchEvent) => e.stopPropagation();

  const input =
    "w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

  return (
    <div
      onTouchStart={keepTouch}
      onTouchEnd={keepTouch}
      className="mt-6 rounded-3xl border-2 border-dashed border-brand/40 bg-white p-4 text-gray-900 dark:bg-gray-950 dark:text-gray-100 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-bold">{c.title}</p>
        <span className="flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand dark:text-sky-300">
          <Lock className="h-3.5 w-3.5" />
          {c.private}
        </span>
      </div>

      <label htmlFor={`${id}-a`} className="mt-4 block text-sm font-semibold">
        {c.name}
      </label>
      <input
        id={`${id}-a`}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={QUOTE_IMAGE_NAME_MAX}
        value={applicantText}
        onChange={(e) => setApplicantText(e.target.value)}
        aria-invalid={applicantBad || undefined}
        aria-describedby={hintId}
        className={cn("mt-1", input)}
      />

      <label htmlFor={`${id}-b`} className="mt-3 block text-sm font-semibold">
        {c.others}
      </label>
      <textarea
        id={`${id}-b`}
        rows={3}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={othersText}
        onChange={(e) => setOthersText(clipLines(e.target.value))}
        aria-invalid={(applicant !== "" && (othersBad || tooManyOthers || !fits)) || undefined}
        aria-describedby={hintId}
        className={cn("mt-1 resize-y", input)}
      />

      {/* Always in the page (empty when all is well), so a screen reader hears each new reason. */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn("text-sm", hint && "mt-2", applicant ? "font-medium text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400")}
      >
        {hint}
      </p>

      <ImpactQuoteImage
        endpoint="/api/admin/impact-quote-image"
        method="POST"
        tier={tier}
        monthly={monthly}
        extra={extra}
        disabled={hint !== null}
        locale={locale}
        clientLocale={locale}
      />
    </div>
  );
}
