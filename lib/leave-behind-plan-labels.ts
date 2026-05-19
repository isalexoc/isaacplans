/** Fallbacks when split JSON has not loaded yet (next-intl `default` option). */
export const LEAVE_BEHIND_PLAN_LABEL_DEFAULTS = {
  en: {
    planPreferred: "Preferred, Super Preferred, or Standard (no ROP)",
    planModified: "Modified – ROP + 10% first 2 years",
    planGuaranteed: "Guaranteed – ROP + 10% first 3 years",
  },
  es: {
    planPreferred: "Preferido, Súper preferido o Estándar (sin ROP)",
    planModified: "Modificado – ROP + 10% primeros 2 años",
    planGuaranteed: "Garantizado – ROP + 10% primeros 3 años",
  },
} as const;
