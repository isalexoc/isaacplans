/**
 * Display and filename formatting shared by the editor, the API routes and the PDF.
 * No Node or server-only imports.
 */

import type { PremiumMode, PresentationData } from "./types";

const WHOLE_DOLLARS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const DOLLARS_AND_CENTS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$391,871", or "$213.87" with cents — the premium is the only figure NLG prints with cents. */
export function formatCurrency(value: number, cents = false): string {
  return (cents ? DOLLARS_AND_CENTS : WHOLE_DOLLARS).format(value);
}

/** The word under the premium: "$213.87 Monthly", "$2,400.00 Annually". */
export const PREMIUM_MODE_LABEL: Record<PremiumMode, string> = {
  Monthly: "Monthly",
  Quarterly: "Quarterly",
  "Semi-Annual": "Semi-Annually",
  Annual: "Annually",
};

/** "2026-10-13" → "October 13, 2026". Parsed at noon UTC so no timezone shifts the day. */
export function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** ASCII kebab-case: this ends up in a Downloads folder and a Content-Disposition header. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** e.g. `americo-instant-decision-iul-mario-silva-2026-10-13.pdf` */
export function summaryPdfFilename(presentation: PresentationData): string {
  const parts = [
    slugify(presentation.carrierDisplayName),
    slugify(presentation.productName),
    slugify(presentation.clientName),
    presentation.preparedDate,
  ].filter(Boolean);
  return `${parts.join("-") || "illustration-summary"}.pdf`;
}
