/**
 * Shared vocabulary and filename rules for the printable sales-script PDF.
 *
 * Deliberately free of `server-only` and of every Node import: the browser trigger
 * (./api.ts) builds the fallback download filename from here, exactly the way
 * lib/mailing-labels/format.ts is shared by the route and the admin client.
 */

import { OBJECTION_LOBS, type ObjectionLob } from "@/lib/objections/types";

export type ScriptLanguage = "en" | "es";
/** "both" prints the English document and the Spanish document back to back in one file. */
export type ScriptPdfLanguage = ScriptLanguage | "both";

export const SCRIPT_PDF_LANGUAGES = ["en", "es", "both"] as const;

/**
 * The export is deliberately ONE thing: the "Complete Script (All-in-One)" field.
 *
 * The per-section script and the objection cards are for reading on screen, where they are
 * searchable and collapsible. On paper the all-in-one is what an agent actually wants in front of
 * them, and printing everything produced a 21-page document that duplicated itself.
 */

/** Product names for the masthead, in both languages. */
export const LOB_TITLE: Record<ObjectionLob, { en: string; es: string }> = {
  iul: { en: "IUL — Indexed Universal Life", es: "IUL — Vida Universal Indexada" },
  aca: { en: "ACA Health Insurance", es: "Seguro de Salud ACA" },
  dentalVision: { en: "Dental & Vision", es: "Dental y Visión" },
  hospitalIndemnity: { en: "Hospital Indemnity", es: "Indemnización Hospitalaria" },
  finalExpense: { en: "Final Expense", es: "Gastos Finales" },
  shortTermMedical: { en: "Temporary Health Insurance", es: "Seguro de Salud Temporal" },
};

/** Filename stem per product. Kebab-case, no accents — this ends up in a Downloads folder. */
export const LOB_SLUG: Record<ObjectionLob, string> = {
  iul: "iul",
  aca: "aca",
  dentalVision: "dental-vision",
  hospitalIndemnity: "hospital-indemnity",
  finalExpense: "final-expense",
  shortTermMedical: "temporary-health",
};

const LOB_VALUES = new Set<string>(OBJECTION_LOBS.map((lob) => lob.value));

export function isScriptLob(value: unknown): value is ObjectionLob {
  return typeof value === "string" && LOB_VALUES.has(value);
}

export function isScriptPdfLanguage(value: unknown): value is ScriptPdfLanguage {
  return value === "en" || value === "es" || value === "both";
}

export const LANGUAGE_LABEL: Record<ScriptLanguage, string> = {
  en: "English",
  es: "Español",
};

/**
 * e.g. `final-expense-complete-script-en-2026-09-04.pdf`.
 *
 * Dated on purpose: scripts change, and the sheet already sitting on the desk should be
 * distinguishable from the one just downloaded. It also means a second download never silently
 * overwrites the first in the Downloads folder.
 */
export function presentationScriptFilename(
  lob: ObjectionLob,
  language: ScriptPdfLanguage,
  date: Date = new Date()
): string {
  const lang = language === "both" ? "en-es" : language;
  return `${LOB_SLUG[lob]}-complete-script-${lang}-${date.toISOString().slice(0, 10)}.pdf`;
}

/**
 * The built-in Helvetica the PDF uses is WinAnsi (cp1252) encoded, so anything outside that set
 * has no glyph — an emoji pasted into a script would come out as a blank box or worse. Spanish is
 * entirely inside cp1252 (á é í ó ú ñ ü ¿ ¡), as are curly quotes, the en/em dash and the ellipsis,
 * so in practice this only ever strips emoji.
 */
const WIN_ANSI_HIGH =
  "€‚ƒ„…†‡ˆ‰Š‹ŒŽ" +
  "‘’“”•–—˜™š›œžŸ";

export function winAnsiSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff || WIN_ANSI_HIGH.includes(ch)) out += ch;
  }
  return out;
}
