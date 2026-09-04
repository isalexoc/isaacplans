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
 * What lands in the file.
 *   full       - every section with its tips, then the objection appendix (the default)
 *   script     - the six sections only
 *   objections - the objection cards only, for the binder tab an agent flips to mid-call
 *   complete   - the "Complete Script (All-in-One)" field on its own
 */
export const SCRIPT_PDF_VARIANTS = ["full", "script", "objections", "complete"] as const;
export type ScriptPdfVariant = (typeof SCRIPT_PDF_VARIANTS)[number];

export type ScriptSectionKey =
  | "openingIntroduction"
  | "discoveryQuestions"
  | "productPresentation"
  | "objectionHandling"
  | "closingTechniques"
  | "psychologySalesTips";

/**
 * The sections, in the order they are shown on screen.
 *
 * Kept identical to `sectionConfig` in components/presentation-scripts-content.tsx — a printed
 * script whose order differs from the screen is worse than no printed script at all. If that list
 * moves, move this one with it.
 */
export const SCRIPT_SECTIONS: ReadonlyArray<{
  key: ScriptSectionKey;
  en: string;
  es: string;
}> = [
  { key: "openingIntroduction", en: "Opening & Introduction", es: "Apertura e Introducción" },
  {
    key: "discoveryQuestions",
    en: "Discovery Questions & Qualification",
    es: "Preguntas de Descubrimiento y Calificación",
  },
  { key: "productPresentation", en: "Product Presentation", es: "Presentación del Producto" },
  { key: "objectionHandling", en: "Objection Handling", es: "Manejo de Objeciones" },
  { key: "closingTechniques", en: "Closing — Three Options", es: "Cierre — Tres Opciones" },
  { key: "psychologySalesTips", en: "Psychology & Sales Tips", es: "Psicología y Consejos de Ventas" },
];

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

export function isScriptPdfVariant(value: unknown): value is ScriptPdfVariant {
  return (
    typeof value === "string" && (SCRIPT_PDF_VARIANTS as readonly string[]).includes(value)
  );
}

export const LANGUAGE_LABEL: Record<ScriptLanguage, string> = {
  en: "English",
  es: "Español",
};

/**
 * e.g. `final-expense-script-en-2026-09-04.pdf`.
 *
 * Dated on purpose: scripts change, and the sheet already sitting on the desk should be
 * distinguishable from the one just downloaded. It also means a second download never silently
 * overwrites the first in the Downloads folder.
 */
export function presentationScriptFilename(
  lob: ObjectionLob,
  language: ScriptPdfLanguage,
  variant: ScriptPdfVariant,
  date: Date = new Date()
): string {
  const kind =
    variant === "objections"
      ? "objections"
      : variant === "complete"
        ? "complete-script"
        : "script";
  const lang = language === "both" ? "en-es" : language;
  return `${LOB_SLUG[lob]}-${kind}-${lang}-${date.toISOString().slice(0, 10)}.pdf`;
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
