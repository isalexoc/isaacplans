/**
 * Shared types/constants for the ads-page hero + OG image overrides — safe to import from
 * both server code (lib/ads-images/settings.ts) and client components (the admin UI), since
 * this file touches no DB/server-only APIs.
 */

export type AdsLob = "final-expense" | "iul" | "aca" | "life-insurance";
export type AdsImageKind = "hero" | "og";
export type AdsLocale = "en" | "es";

export const ADS_LOBS: AdsLob[] = ["final-expense", "iul", "aca", "life-insurance"];
export const ADS_IMAGE_KINDS: AdsImageKind[] = ["hero", "og"];
export const ADS_LOCALES: AdsLocale[] = ["en", "es"];

export const ADS_LOB_LABELS: Record<AdsLob, string> = {
  "final-expense": "Final Expense",
  iul: "IUL",
  aca: "ACA",
  "life-insurance": "Life Insurance",
};

export const ADS_LOB_LIVE_PATH: Record<AdsLob, Record<AdsLocale, string>> = {
  "final-expense": {
    en: "/en/final-expense/get-covered",
    es: "/es/gastos-finales/obtener-cobertura",
  },
  iul: { en: "/en/iul/get-covered", es: "/es/iul/obtener-cobertura" },
  aca: { en: "/en/aca/get-covered", es: "/es/aca/obtener-cobertura" },
  "life-insurance": {
    en: "/en/life-insurance/get-covered",
    es: "/es/seguro-de-vida/obtener-cobertura",
  },
};

export type AdsImageSettingRow = {
  lob: AdsLob;
  kind: AdsImageKind;
  locale: AdsLocale;
  override: string | null;
  defaultUrl: string;
};
