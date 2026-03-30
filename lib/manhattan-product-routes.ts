import { manhattanDirectQuoteUrl } from "@/lib/manhattan-direct-quote";

/**
 * URL slugs for Manhattan Life product landing pages (`/carriers/manhattan/[product]`)
 * map to `direct.manhattanlife.com` path segments after `/isaacplans/`.
 */

export const MANHATTAN_ALL_PRODUCTS_SLUG = "all-products" as const;

/** Ordered slug list for the hub and `generateStaticParams`. */
export const MANHATTAN_PRODUCT_SLUGS = [
  MANHATTAN_ALL_PRODUCTS_SLUG,
  "24-hour-accident",
  "accident",
  "affordable-choice",
  "cancer-care-plus",
  "cancer-heart-attack-stroke-mac",
  "cancer-heart-attack-stroke-lac",
  "critical-protection-recovery",
  "dental-vision-hearing-select",
  "dental-vision-hearing",
  "first-choice-blue-ribbon",
  "home-health-care",
  "home-health-care-select",
  "home-health-care-select-mac",
  "hospital-indemnity-select",
  "omniflex-short-term-care",
  "out-of-pocket-protection",
  "secure-advantage-final-expense",
] as const;

export type ManhattanProductSlug = (typeof MANHATTAN_PRODUCT_SLUGS)[number];

/** `null` = all-plans base URL (no suffix). */
export const MANHATTAN_SLUG_TO_CODE: Record<ManhattanProductSlug, string | null> = {
  [MANHATTAN_ALL_PRODUCTS_SLUG]: null,
  "24-hour-accident": "24H",
  accident: "ACC",
  "affordable-choice": "AFC",
  "cancer-care-plus": "CCP",
  "cancer-heart-attack-stroke-mac": "CHASMAC",
  "cancer-heart-attack-stroke-lac": "CHASLAC",
  "critical-protection-recovery": "CPR",
  "dental-vision-hearing-select": "DVHS",
  "dental-vision-hearing": "DVH",
  "first-choice-blue-ribbon": "FCSBR",
  "home-health-care": "HHCSLAC",
  "home-health-care-select": "HHCSLACS",
  "home-health-care-select-mac": "HHCMACS",
  "hospital-indemnity-select": "HIS",
  "omniflex-short-term-care": "STC",
  "out-of-pocket-protection": "OOP",
  "secure-advantage-final-expense": "FE",
};

export function isManhattanProductSlug(s: string): s is ManhattanProductSlug {
  return (MANHATTAN_PRODUCT_SLUGS as readonly string[]).includes(s);
}

export function manhattanQuoteUrlForSlug(slug: ManhattanProductSlug): string {
  const code = MANHATTAN_SLUG_TO_CODE[slug];
  return code ? manhattanDirectQuoteUrl(code) : manhattanDirectQuoteUrl();
}
