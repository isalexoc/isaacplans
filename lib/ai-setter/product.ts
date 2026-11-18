/**
 * Product line, language and calendar for a lead — all derived in code, never by the model.
 *
 * Calendar ids are the public booking-widget ids hard-coded in app/[locale]/<line>/calendar/page.tsx
 * (in GHL the widget id is the calendarId). `pnpm ai-setter:try --calendars` checks every one of them
 * against GET /calendars/ before the setter is switched on.
 *
 * Pure: no DB, no server-only.
 */

import { DEFAULT_SCHEDULE_TIMEZONE } from "./config";
import type { Lang, ProductLine, Register, WeeklySchedule } from "./types";

export const CALENDAR_IDS: Record<ProductLine, Record<Lang, string>> = {
  aca: { en: "HR7iDiMN8k01DUkGl8z0", es: "MGgUxlHXgfQGa9UoZcv6" },
  short_term_medical: { en: "W4HpeJCBnxmO8XOuXWgn", es: "oWauKhvdkWNdNscrp8az" },
  dental_vision: { en: "62geCc4o9uF3lhsfcJ14", es: "rRdoJtrmAvJ0FsgZwQqs" },
  hospital_indemnity: { en: "yh1YlMZR4YcDRWbDcZus", es: "fd7uQMNIBfZ8VmyRj3yH" },
  final_expense: { en: "ndTlLivbrRxtySFg7jgQ", es: "cp075CJgwaZppyW7EVmV" },
  iul: { en: "xy5oO9qhTMh3A2AGCM9v", es: "lilkHWZAPk2Xx41VMhfB" },
  // Life insurance and Health Alternative pages use the general calendar today.
  life_insurance: { en: "NSjUB0yiEwvZarpmvMcx", es: "tPPqNMldYmNWIVCyPkHd" },
  health_alternative: { en: "NSjUB0yiEwvZarpmvMcx", es: "tPPqNMldYmNWIVCyPkHd" },
  general: { en: "NSjUB0yiEwvZarpmvMcx", es: "tPPqNMldYmNWIVCyPkHd" },
};

export function calendarIdFor(product: ProductLine | null, lang: Lang): string {
  return CALENDAR_IDS[product ?? "general"][lang];
}

/**
 * Self-booking page for the "pick your own time" fallback (prefilled by the caller). Localized
 * slugs from i18n/routing.ts — keep in sync.
 */
export const BOOKING_PATHS: Record<ProductLine, Record<Lang, string>> = {
  aca: { en: "/en/aca/calendar", es: "/es/aca/calendario" },
  short_term_medical: { en: "/en/short-term-medical/calendar", es: "/es/cobertura-a-corto-plazo/calendario" },
  dental_vision: { en: "/en/dental-vision/calendar", es: "/es/dental-vision/calendario" },
  hospital_indemnity: { en: "/en/hospital-indemnity/calendar", es: "/es/indemnizacion-hospitalaria/calendario" },
  final_expense: { en: "/en/final-expense/calendar", es: "/es/gastos-finales/calendario" },
  iul: { en: "/en/iul/calendar", es: "/es/iul/calendario" },
  life_insurance: { en: "/en/life-insurance/calendar", es: "/es/seguro-de-vida/calendario" },
  health_alternative: { en: "/en/health-alternative/calendar", es: "/es/alternativa-de-salud/calendario" },
  general: { en: "/en/contact-me/calendar", es: "/es/contacto/calendario" },
};

/**
 * Tag → product, checked in this order (specific lines before the general ones). Matching is
 * case-insensitive on the whole tag. Sources: create-contact, Leads the Way, Telegram, partners.
 */
const PRODUCT_TAGS: Array<[ProductLine, string[]]> = [
  ["final_expense", ["final expense lead", "fe_get_covered_funnel", "fe_senior_life_spanish", "fe_senior_life_english", "senior life lead", "leads the way"]],
  ["iul", ["iul lead", "iul_get_covered_funnel", "iul_guia_funnel", "iul_guia_solicitada", "iul_empire_growth"]],
  ["aca", ["aca lead", "aca_get_covered_funnel"]],
  ["health_alternative", ["health coverage alternative lead", "health_alternative_get_covered_funnel", "referral partner lead"]],
  ["short_term_medical", ["short term medical lead"]],
  ["dental_vision", ["dental & vision lead"]],
  ["hospital_indemnity", ["hospital indemnity lead"]],
  ["life_insurance", ["life insurance lead", "life_insurance_get_covered_funnel"]],
  ["general", ["contact page lead"]],
];

/** call-summary `lineOfBusiness` → product (the latest call wins over tags when present). */
const CALL_LOB_TO_PRODUCT: Record<string, ProductLine> = {
  aca: "aca",
  stm: "short_term_medical",
  dental_vision: "dental_vision",
  hospital_indemnity: "hospital_indemnity",
  iul: "iul",
  final_expense: "final_expense",
};

export function productFromSignals(tags: string[], callLineOfBusiness: string | null): ProductLine {
  if (callLineOfBusiness && CALL_LOB_TO_PRODUCT[callLineOfBusiness]) return CALL_LOB_TO_PRODUCT[callLineOfBusiness];
  const lower = new Set(tags.map((t) => t.trim().toLowerCase()));
  for (const [product, names] of PRODUCT_TAGS) {
    if (names.some((n) => lower.has(n))) return product;
  }
  return "general";
}

/** Same rule every GHL workflow and module uses: an exact `spanish` tag means Spanish. */
export function languageFromTags(tags: string[]): Lang {
  return tags.some((t) => t.trim().toLowerCase() === "spanish") ? "es" : "en";
}

/**
 * What the lead asked about, for "Isaac received your request about …". Brand voice: never
 * "insurance / policy / premium" or "seguro / póliza / prima".
 */
const TOPIC: Record<ProductLine, { en: string; es: { usted: string; tu: string } }> = {
  aca: { en: "health coverage", es: { usted: "cobertura de salud", tu: "cobertura de salud" } },
  short_term_medical: {
    en: "short-term health coverage",
    es: { usted: "cobertura médica temporal", tu: "cobertura médica temporal" },
  },
  dental_vision: { en: "dental and vision coverage", es: { usted: "cobertura dental y de visión", tu: "cobertura dental y de visión" } },
  hospital_indemnity: {
    en: "extra protection for hospital stays",
    es: { usted: "protección extra para hospitalización", tu: "protección extra para hospitalización" },
  },
  final_expense: {
    en: "protecting your family from final expenses",
    es: { usted: "proteger a su familia de los gastos finales", tu: "proteger a tu familia de los gastos finales" },
  },
  iul: {
    // who_is_this already says "You asked us about {topic}": no second "you asked about" here.
    en: "the IUL plan",
    es: { usted: "el plan IUL", tu: "el plan IUL" },
  },
  life_insurance: { en: "life protection for your family", es: { usted: "protección de vida para su familia", tu: "protección de vida para tu familia" } },
  health_alternative: {
    en: "a health coverage alternative",
    es: { usted: "una alternativa de cobertura de salud", tu: "una alternativa de cobertura de salud" },
  },
  general: { en: "your coverage options", es: { usted: "sus opciones de cobertura", tu: "tus opciones de cobertura" } },
};

export function topicPhrase(product: ProductLine | null, lang: Lang, register: Register | null): string {
  const t = TOPIC[product ?? "general"];
  return lang === "en" ? t.en : t.es[register ?? "usted"];
}

export const PRODUCT_LABELS: Record<ProductLine, { en: string; es: string }> = {
  aca: { en: "ACA", es: "ACA" },
  short_term_medical: { en: "Short-term medical", es: "Médico temporal" },
  dental_vision: { en: "Dental & vision", es: "Dental y visión" },
  hospital_indemnity: { en: "Hospital indemnity", es: "Indemnización hospitalaria" },
  final_expense: { en: "Final expense", es: "Gastos finales" },
  iul: { en: "IUL", es: "IUL" },
  life_insurance: { en: "Life", es: "Vida" },
  health_alternative: { en: "Health alternative", es: "Alternativa de salud" },
  general: { en: "General", es: "General" },
};

/**
 * Isaac's working hours (ET), Isaac's words on 2026-11-17: in the office until 2 pm Mon–Thu and
 * until 1 pm Fri/Sat; Tuesdays and Sundays all day; free again from 9:30 pm Mon–Thu and from
 * 10:30 pm Fri/Sat. The 9:00 start and midnight end are assumptions; editable in Ajustes.
 */
export const DEFAULT_SCHEDULE: WeeklySchedule = {
  timeZone: DEFAULT_SCHEDULE_TIMEZONE,
  days: {
    0: [{ start: "09:00", end: "24:00" }],
    1: [
      { start: "09:00", end: "14:00" },
      { start: "21:30", end: "24:00" },
    ],
    2: [{ start: "09:00", end: "24:00" }],
    3: [
      { start: "09:00", end: "14:00" },
      { start: "21:30", end: "24:00" },
    ],
    4: [
      { start: "09:00", end: "14:00" },
      { start: "21:30", end: "24:00" },
    ],
    5: [
      { start: "09:00", end: "13:00" },
      { start: "22:30", end: "24:00" },
    ],
    6: [
      { start: "09:00", end: "13:00" },
      { start: "22:30", end: "24:00" },
    ],
  },
};
