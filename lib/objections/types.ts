import type { PortableText } from "@portabletext/react";

/**
 * The objection vocabulary, in one dependency-free place.
 *
 * This file is imported by BOTH the Sanity Studio bundle (sanity/schemaTypes/objectionType.ts)
 * and the reading view, so it must stay free of `server-only` and of any Node import.
 * `lib/call-study/analysis.ts` is `import "server-only"` and can never be imported from schema code.
 *
 * The `objectionType` VALUES are a join key, not a private enum. They must stay identical to:
 *   - the prompt taxonomy at lib/call-study/analysis.ts:60
 *   - the `objection_type` column on call_study_snippets (lib/db/schema.ts:628)
 * so a future version of the objection card can show the verbatim client quotes and the rebuttals
 * that actually worked, pulled from recorded calls of the same type.
 */

export const OBJECTION_TYPES = [
  "price",
  "spouse",
  "trust",
  "timing",
  "already_covered",
  "health",
  "thinking_about_it",
  "other",
] as const;

export type ObjectionType = (typeof OBJECTION_TYPES)[number];

/**
 * Human labels. The stored value is machine-readable and shared with the call analyser;
 * these are what Isaac actually reads. `spouse` is the odd one — in the Final Expense script
 * the objection is "I need to talk to my kids first", so the label says what it means.
 */
export const OBJECTION_TYPE_LABELS: Record<ObjectionType, { en: string; es: string }> = {
  price: { en: "Price / can't afford it", es: "Precio / no puede pagarlo" },
  spouse: { en: "Needs to talk to someone", es: "Necesita consultarlo" },
  trust: { en: "Doesn't trust / won't share info", es: "Desconfía / no da información" },
  timing: { en: "Timing — call me back", es: "Momento — que llame luego" },
  already_covered: { en: "Already has coverage", es: "Ya tiene cobertura" },
  health: { en: "Health concerns", es: "Temas de salud" },
  thinking_about_it: { en: "Wants to think about it", es: "Quiere pensarlo" },
  other: { en: "Something else", es: "Otra cosa" },
};

/** Light + dark pairs, shaped like the badges in components/admin/call-study/snippet-library.tsx. */
export const OBJECTION_TYPE_BADGE: Record<ObjectionType, string> = {
  price:
    "ring-1 ring-inset bg-amber-100 text-amber-900 ring-amber-500/25 dark:bg-amber-500/20 dark:text-amber-200 dark:ring-amber-400/50",
  spouse:
    "ring-1 ring-inset bg-violet-100 text-violet-900 ring-violet-500/25 dark:bg-violet-500/20 dark:text-violet-200 dark:ring-violet-400/50",
  trust:
    "ring-1 ring-inset bg-rose-100 text-rose-900 ring-rose-500/25 dark:bg-rose-500/20 dark:text-rose-200 dark:ring-rose-400/50",
  timing:
    "ring-1 ring-inset bg-blue-100 text-blue-900 ring-blue-500/25 dark:bg-blue-500/20 dark:text-blue-200 dark:ring-blue-400/50",
  already_covered:
    "ring-1 ring-inset bg-emerald-100 text-emerald-900 ring-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/50",
  health:
    "ring-1 ring-inset bg-cyan-100 text-cyan-900 ring-cyan-500/25 dark:bg-cyan-500/20 dark:text-cyan-200 dark:ring-cyan-400/50",
  thinking_about_it:
    "ring-1 ring-inset bg-fuchsia-100 text-fuchsia-900 ring-fuchsia-500/25 dark:bg-fuchsia-500/20 dark:text-fuchsia-200 dark:ring-fuchsia-400/50",
  other:
    "ring-1 ring-inset bg-slate-100 text-slate-700 ring-slate-500/25 dark:bg-slate-500/20 dark:text-slate-200 dark:ring-slate-400/50",
};

/** Solid dots for the command palette rows, where a full badge would be noise. */
export const OBJECTION_TYPE_DOT: Record<ObjectionType, string> = {
  price: "bg-amber-600 dark:bg-amber-400",
  spouse: "bg-violet-600 dark:bg-violet-400",
  trust: "bg-rose-600 dark:bg-rose-400",
  timing: "bg-blue-600 dark:bg-blue-400",
  already_covered: "bg-emerald-600 dark:bg-emerald-400",
  health: "bg-cyan-600 dark:bg-cyan-400",
  thinking_about_it: "bg-fuchsia-600 dark:bg-fuchsia-400",
  other: "bg-slate-500 dark:bg-slate-400",
};

/**
 * Products, with the SAME values as presentationScriptType.ts's lineOfBusiness list.
 *
 * Careful: components/admin/call-study/snippet-library.tsx declares a DIFFERENT line-of-business
 * vocabulary (`final_expense`, `term_life`, `annuity`…) for a different purpose. Using those values
 * here would produce a library where every card is silently invisible.
 */
export const OBJECTION_LOBS = [
  { value: "iul", title: "IUL (Indexed Universal Life)", short: "IUL" },
  { value: "aca", title: "ACA / Obamacare", short: "ACA" },
  { value: "dentalVision", title: "Dental & Vision", short: "Dental & Vision" },
  { value: "hospitalIndemnity", title: "Hospital Indemnity", short: "Hospital Indemnity" },
  { value: "finalExpense", title: "Final Expense / Burial", short: "Final Expense" },
  { value: "shortTermMedical", title: "Temporary health insurance", short: "Temporary health" },
] as const;

export type ObjectionLob = (typeof OBJECTION_LOBS)[number]["value"];

/** Borrowed from the renderer so we neither use `any[]` nor depend on @portabletext/types directly. */
export type PortableTextValue = React.ComponentProps<typeof PortableText>["value"];

export interface Objection {
  _id: string;
  titleEn?: string;
  titleEs?: string;
  objectionType: ObjectionType;
  /** Empty or absent means: show on every product. */
  linesOfBusiness?: string[];
  triggersEn?: string[];
  triggersEs?: string[];
  answerEn?: PortableTextValue;
  answerEs?: PortableTextValue;
}

/**
 * Does this objection belong to a product?
 *
 * Deliberately plain JS rather than a GROQ filter. In GROQ `count(undefinedField) == 0` is FALSE —
 * Sanity stores an empty array as undefined — so the equivalent query needs a `!defined()` guard or
 * every universal objection silently disappears. Here the empty case is just falsy.
 */
export function appliesToLob(objection: Objection, lob: string): boolean {
  const lobs = objection.linesOfBusiness;
  return !lobs || lobs.length === 0 || lobs.includes(lob);
}

/**
 * Can this objection be shown in this language?
 *
 * Both the title and a non-empty answer are required. English and Spanish do not line up in the
 * source content, so some objections genuinely exist in one language only. A card that opens onto
 * an empty panel costs dead air on a live call; a card that was never shown costs nothing.
 */
export function visibleIn(objection: Objection, language: "en" | "es"): boolean {
  const title = language === "en" ? objection.titleEn : objection.titleEs;
  const answer = language === "en" ? objection.answerEn : objection.answerEs;
  return Boolean(title?.trim()) && Array.isArray(answer) && answer.length > 0;
}

export function objectionTitle(objection: Objection, language: "en" | "es"): string {
  return (language === "en" ? objection.titleEn : objection.titleEs) ?? "";
}

export function objectionAnswer(
  objection: Objection,
  language: "en" | "es"
): PortableTextValue | undefined {
  return language === "en" ? objection.answerEn : objection.answerEs;
}

export function isObjectionType(value: unknown): value is ObjectionType {
  return typeof value === "string" && (OBJECTION_TYPES as readonly string[]).includes(value);
}
