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

/** Static marketing images hosted on uhone.com (used in img src). */
export function uhoneMarketingAssetUrl(filePath: string): string {
  const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `https://www.uhone.com/ContentManagement/FileAttachment.ashx?FilePath=${encodeURIComponent(path)}`;
}
