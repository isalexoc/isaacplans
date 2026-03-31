/** Isaac Plans broker ID on shop.uhone.com — override via NEXT_PUBLIC_UHONE_BROKER_ID if needed */
export const UHONE_BROKER_ID =
  process.env.NEXT_PUBLIC_UHONE_BROKER_ID ?? "AA5607941";

const CENSUS_BASE = "https://shop.uhone.com/en/quote/census";

/**
 * UnitedHealthOne shop census URL (English flow). Opens in a new tab from the site.
 * @param segment — optional path segment after `/census/` (e.g. `shortterm`, `dental`). Omit for “All plans”.
 */
export function uhoneShopCensusUrl(segment?: string): string {
  const q = `brokerid=${UHONE_BROKER_ID}`;
  return segment ? `${CENSUS_BASE}/${segment}?${q}` : `${CENSUS_BASE}?${q}`;
}

/**
 * UHOne “all plans” census — same href as the official dedicated button:
 * `https://shop.uhone.com/en/quote/census?brokerid=AA5607941` when `UHONE_BROKER_ID` is default.
 * (UHOne snippet uses `<a href="…census?brokerid=…">` with `allPlans_btn.jpg`.)
 */
export const UHONE_ALL_PLANS_CENSUS_URL = uhoneShopCensusUrl();

/** Static marketing images hosted on uhone.com (used in img src). */
export function uhoneMarketingAssetUrl(filePath: string): string {
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `https://www.uhone.com/ContentManagement/FileAttachment.ashx?FilePath=${encodeURIComponent(path)}`;
}

/** UHOne “All plans” button artwork (`allPlans_btn.jpg`) — same asset as their marketing embed. */
export const UHONE_ALL_PLANS_BUTTON_IMAGE_URL =
  uhoneMarketingAssetUrl("/allPlans_btn.jpg");

/** UnitedHealthcare mark — Cloudinary f_auto, q_auto, capped width for crisp logos */
export const UHONE_UHC_LOGO_URL =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_480,c_limit/v1774718587/united-healthcare-logo_avzxnj.png";
