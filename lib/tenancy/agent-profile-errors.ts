/**
 * Why a profile field was refused (lib/tenancy/agent-profile-input.ts), as a code that each form
 * words in its own language: the agent's /agent/profile in English or Spanish, Isaac's
 * /admin/agents in English. Pure and import-free, so the agent's form (a client component) can
 * import it without pulling the profile rules or their env reads into the browser.
 */

export const PROFILE_ERROR_CODES = [
  "name",
  "photo",
  "whatsapp",
  "email",
  "languages",
  "licensed",
  "states",
  "ibo",
  "impact",
  "locale",
] as const;
export type ProfileErrorCode = (typeof PROFILE_ERROR_CODES)[number];

export type ProfileErrorLocale = "en" | "es";

export const PROFILE_ERROR_TEXT: Readonly<Record<ProfileErrorLocale, Readonly<Record<ProfileErrorCode, string>>>> = {
  en: {
    name: "Use up to 60 letters.",
    photo: "Use an https:// link to your photo on a public site.",
    whatsapp: "Type the number with its country code, e.g. +1 540 555 0100.",
    email: "That email address doesn't look right.",
    languages: "Pick English, Spanish or both.",
    licensed: "Yes or no.",
    states: "Use two-letter US state codes.",
    ibo: "Letters, numbers and dashes only.",
    impact: "Use your https:// link on impacthealthsharing.com or mysharable.com.",
    locale: "English or Spanish.",
  },
  es: {
    name: "Use hasta 60 letras.",
    photo: "Use un enlace https:// a su foto en un sitio público.",
    whatsapp: "Escriba el número con el código de país, p. ej. +1 540 555 0100.",
    email: "Ese correo no parece correcto.",
    languages: "Elija inglés, español o ambos.",
    licensed: "Sí o no.",
    states: "Use las abreviaturas de dos letras de los estados.",
    ibo: "Solo letras, números y guiones.",
    impact: "Use su enlace https:// en impacthealthsharing.com o mysharable.com.",
    locale: "Inglés o español.",
  },
};

export function isProfileErrorCode(value: unknown): value is ProfileErrorCode {
  return typeof value === "string" && (PROFILE_ERROR_CODES as readonly string[]).includes(value);
}

/** Each field's code in words, for the language given. Unknown codes are left out. */
export function profileErrorsText<K extends string>(
  codes: Partial<Record<K, unknown>> | null | undefined,
  locale: ProfileErrorLocale
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const [field, code] of Object.entries(codes ?? {}) as [K, unknown][]) {
    if (isProfileErrorCode(code)) out[field] = PROFILE_ERROR_TEXT[locale][code];
  }
  return out;
}
