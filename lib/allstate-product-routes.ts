/**
 * URL slugs and NatGen `product=` params for Allstate Health Solutions product pages.
 */

export const ALLSTATE_SENIOR_PRODUCT_SLUGS = [
  "all-products",
  "dental-vision-hearing",
  "senior-indemnity",
  "my-life-senior",
] as const;

export const ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS = [
  "accident",
  "dental",
  "life-cancer-critical-illness",
  "fixed-benefit-indemnity",
  "my-life-wellness",
] as const;

export const ALLSTATE_CANCER_ONLY_SLUG = "cancer-only" as const;

export type AllstateSeniorProductSlug = (typeof ALLSTATE_SENIOR_PRODUCT_SLUGS)[number];
export type AllstateIndividualProductSlug =
  (typeof ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS)[number];

/** NatGen `product` query value per URL slug (path segment). */
export const ALLSTATE_SLUG_TO_PRODUCT_PARAM: Record<
  AllstateSeniorProductSlug | AllstateIndividualProductSlug | typeof ALLSTATE_CANCER_ONLY_SLUG,
  string
> = {
  "all-products": "all-products",
  "dental-vision-hearing": "dvh",
  "senior-indemnity": "senior-indemnity",
  "my-life-senior": "my-life-senior",
  accident: "accident",
  dental: "dental",
  "life-cancer-critical-illness": "life-cancer-critical-illness",
  "fixed-benefit-indemnity": "fixed-benefit-indemnity",
  "my-life-wellness": "my-life-wellness",
  [ALLSTATE_CANCER_ONLY_SLUG]: "cancer-only",
};

export function isAllstateSeniorSlug(s: string): s is AllstateSeniorProductSlug {
  return (ALLSTATE_SENIOR_PRODUCT_SLUGS as readonly string[]).includes(s);
}

export function isAllstateIndividualSlug(
  s: string
): s is AllstateIndividualProductSlug {
  return (ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS as readonly string[]).includes(s);
}

export function natgenProductParamForSlug(
  slug:
    | AllstateSeniorProductSlug
    | AllstateIndividualProductSlug
    | typeof ALLSTATE_CANCER_ONLY_SLUG
): string {
  return ALLSTATE_SLUG_TO_PRODUCT_PARAM[slug];
}
