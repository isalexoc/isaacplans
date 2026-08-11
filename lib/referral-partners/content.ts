/**
 * Fallbacks for the three copy fields a partner record can override on the shared landing
 * template: headline, intro, and the "why your clients specifically need this" paragraph.
 *
 * Everything else on the page — benefits, steps, FAQ, form labels — lives in next-intl under the
 * `partnerReferral` namespace, same as every other page in the app. Only the per-partner copy is
 * here, because only that copy has to survive a partner record with blank fields.
 *
 * Tone note: the audience reads in their second language, often on a phone, often anxious about
 * a pending application. Short sentences, no insurance jargon, no false promises about status.
 */

export type PartnerCopyLocale = "en" | "es";

type Bilingual = { en: string; es: string };

export const PARTNER_DEFAULT_HEADLINE: Bilingual = {
  en: "Affordable health coverage for your family",
  es: "Cobertura médica asequible para su familia",
};

export const PARTNER_DEFAULT_INTRO: Bilingual = {
  en: "A licensed agent finds a plan that fits your budget and sends you proof of coverage you can use right away. Asking costs nothing.",
  es: "Un agente con licencia busca un plan que se ajuste a su presupuesto y le envía la constancia de cobertura que necesita. Preguntar no cuesta nada.",
};

/** Optional short lead-in under the situations heading. Blank on a partner renders nothing. */
export const PARTNER_DEFAULT_AUDIENCE: Bilingual = {
  en: "",
  es: "",
};

export function pickCopy(
  value: string | null | undefined,
  fallback: Bilingual,
  locale: PartnerCopyLocale
): string {
  const trimmed = value?.trim();
  return trimmed || fallback[locale];
}
