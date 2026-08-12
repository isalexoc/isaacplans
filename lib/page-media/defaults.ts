/**
 * The built-in media every page shows when the admin has not overridden it.
 *
 * These URLs are reproduced exactly as the pages built them before this system existed, so
 * switching a page over to `getEffectivePageMedia` changes nothing visually until Isaac uploads
 * something. Three sources are consolidated here:
 *
 *  - main heroes: the `imagePublicId` each page passes to `components/hero-template.tsx`, which
 *    built `…/f_auto,q_auto,w_800,c_fill,g_auto/<id>.webp` internally;
 *  - apply heroes: the `*_APPLY_HERO_IMAGE` constants in lib/get-covered-fast/constants.ts;
 *  - ads heroes + social cards: the ten getters in the same file.
 *
 * Social cards for the main and apply surfaces are deliberately absent: those pages already read
 * theirs from a next-intl message key, and duplicating the URL here would create two places to
 * change it. They pass the message value in as `fallbackUrl` instead.
 */

import {
  getFinalExpenseGetCoveredHeroImageUrl,
  getFinalExpenseGetCoveredOgImageUrl,
  getIulGetCoveredHeroImageUrl,
  getIulGetCoveredOgImageUrl,
  getAcaGetCoveredHeroImageUrl,
  getAcaGetCoveredOgImageUrl,
  getLifeInsuranceGetCoveredHeroImageUrl,
  getLifeInsuranceGetCoveredOgImageUrl,
  getHealthAlternativeGetCoveredHeroImageUrl,
  getHealthAlternativeGetCoveredOgImageUrl,
  ACA_APPLY_HERO_IMAGE,
  FE_APPLY_HERO_IMAGE,
  STM_APPLY_HERO_IMAGE,
  DENTAL_VISION_APPLY_HERO_IMAGE,
  HOSPITAL_INDEMNITY_APPLY_HERO_IMAGE,
  LIFE_INSURANCE_APPLY_HERO_IMAGE,
  HEALTH_ALTERNATIVE_APPLY_HERO_IMAGE,
} from "@/lib/get-covered-fast/constants";
import type { LobSlug, MediaKind, MediaSurface } from "./shared";

/** Exactly the URL `components/hero-template.tsx` builds from a public id. */
function heroTemplateUrl(publicId: string): string {
  return `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_800,c_fill,g_auto/${publicId}.webp`;
}

/** The public id each main page passes to the hero template today. */
const MAIN_HERO_PUBLIC_ID: Record<LobSlug, string> = {
  aca: "tmpfs1tzoqj_1_qqzvsx",
  "short-term-medical": "pexels-chokniti-khongchum-1197604-3938022_bujifm",
  "dental-vision": "tmp48ylol1v_1_ig0hto",
  "hospital-indemnity": "pexels-rdne-6129237_vbgahf_1_gfwx1z",
  iul: "pexels-victor-l-19338-2790434_1_pr9bng",
  "life-insurance": "pexels-emma-bauso-1183828-2253879_1_zd87oq",
  "health-alternative": "tmpfs1tzoqj_1_qqzvsx",
  "final-expense": "final_expense_hero_fbimsc",
};

const APPLY_HERO: Record<LobSlug, string> = {
  aca: ACA_APPLY_HERO_IMAGE,
  "short-term-medical": STM_APPLY_HERO_IMAGE,
  "dental-vision": DENTAL_VISION_APPLY_HERO_IMAGE,
  "hospital-indemnity": HOSPITAL_INDEMNITY_APPLY_HERO_IMAGE,
  // The IUL apply page branched on locale inline before this; the EN card is the default and
  // Spanish is now a per-locale override Isaac can set in the admin tool.
  iul: "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1280,c_limit/v1767070514/quote_iul_en_cxwq4x.png",
  "life-insurance": LIFE_INSURANCE_APPLY_HERO_IMAGE,
  "health-alternative": HEALTH_ALTERNATIVE_APPLY_HERO_IMAGE,
  "final-expense": FE_APPLY_HERO_IMAGE,
};

type Getter = (locale: string) => string;

/** Only the five lines with a paid-ads funnel have an `ads` surface. */
const ADS_GETTERS: Partial<Record<LobSlug, Record<MediaKind, Getter>>> = {
  aca: { hero: getAcaGetCoveredHeroImageUrl, og: getAcaGetCoveredOgImageUrl },
  iul: { hero: getIulGetCoveredHeroImageUrl, og: getIulGetCoveredOgImageUrl },
  "final-expense": {
    hero: getFinalExpenseGetCoveredHeroImageUrl,
    og: getFinalExpenseGetCoveredOgImageUrl,
  },
  "life-insurance": {
    hero: getLifeInsuranceGetCoveredHeroImageUrl,
    og: getLifeInsuranceGetCoveredOgImageUrl,
  },
  "health-alternative": {
    hero: getHealthAlternativeGetCoveredHeroImageUrl,
    og: getHealthAlternativeGetCoveredOgImageUrl,
  },
};

/**
 * Built-in URL for one cell, or "" when there is no registered default — which happens for main
 * and apply social cards, where the caller supplies `fallbackUrl` from its message key instead.
 */
export function defaultMediaUrl(
  lob: LobSlug,
  surface: MediaSurface,
  kind: MediaKind,
  locale: string
): string {
  if (surface === "ads") {
    return ADS_GETTERS[lob]?.[kind](locale) ?? "";
  }
  if (kind === "hero") {
    return surface === "main" ? heroTemplateUrl(MAIN_HERO_PUBLIC_ID[lob]) : APPLY_HERO[lob];
  }
  return "";
}
