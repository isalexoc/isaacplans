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
  en: "A licensed agent walks you through your options in plain language, finds a plan that fits your budget, and sends you proof of coverage you can use right away. Asking costs nothing.",
  es: "Un agente con licencia le explica sus opciones en su idioma, busca un plan que se ajuste a su presupuesto y le envía la constancia de cobertura que necesita. Preguntar no cuesta nada.",
};

export const PARTNER_DEFAULT_AUDIENCE: Bilingual = {
  en: "Many applications ask you to show you can cover your own medical costs. We help you meet that requirement with real coverage you can actually afford — not a policy that looks good on paper and leaves you stuck when you need it.",
  es: "Muchos trámites le piden demostrar que usted puede cubrir sus propios gastos médicos. Le ayudamos a cumplir ese requisito con una cobertura real y a un precio que sí puede pagar — no una póliza que se ve bien en papel y lo deja desamparado cuando la necesita.",
};

export function pickCopy(
  value: string | null | undefined,
  fallback: Bilingual,
  locale: PartnerCopyLocale
): string {
  const trimmed = value?.trim();
  return trimmed || fallback[locale];
}
