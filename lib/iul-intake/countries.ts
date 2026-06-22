/**
 * Bilingual, alphabetical country list for IUL intake `country` fields. Reuses the ISO
 * code→name maps that ship with `react-phone-number-input` (already a dependency) so we
 * don't add a countries package. Stored value is the English name (stable for the CRM).
 */

import en from "react-phone-number-input/locale/en.json";
import es from "react-phone-number-input/locale/es.json";

export type CountryOption = { value: string; labelEn: string; labelEs: string };

const enMap = en as Record<string, string>;
const esMap = es as Record<string, string>;

// 2-letter ISO codes only; ZZ ("International") and ext/country/phone keys excluded.
const isCountryCode = (k: string): boolean => /^[A-Z]{2}$/.test(k) && k !== "ZZ";

const BASE: CountryOption[] = Object.keys(enMap)
  .filter(isCountryCode)
  .map((code) => ({
    value: enMap[code],
    labelEn: enMap[code],
    labelEs: esMap[code] || enMap[code],
  }));

/** Countries sorted alphabetically by the given locale's label. */
export function countriesFor(locale: "en" | "es"): CountryOption[] {
  const key = locale === "es" ? "labelEs" : "labelEn";
  return [...BASE].sort((a, b) => a[key].localeCompare(b[key], locale));
}
