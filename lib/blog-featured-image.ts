/**
 * Cloudinary fetch URL helpers.
 *
 * `c_fill` scales to cover `w × h`, then trims overflow; `g_auto` keeps the crop
 * on the most salient region when the source aspect ratio differs from the target.
 * `f_jpg,q_80` forces JPEG at quality 80 — keeps OG images well under 300 KB.
 * JPEG is used instead of f_auto because some social crawlers (LinkedIn, iMessage)
 * still don't support WebP for og:image.
 *
 * https://cloudinary.com/documentation/transformation_reference
 *
 * Allow isaacplans.com under Cloudinary → Settings → Security → Allowed fetch domains.
 */
const CLOUD_NAME = "isaacdev";

const W = 1600;
const H = 900;

/**
 * Generic Cloudinary fetch URL for any w×h target.
 * Serves WebP/AVIF automatically (`f_auto`) with smart-gravity crop (`g_auto`).
 */
export function cloudinaryFetchedImageUrl(
  remoteImageUrl: string,
  w: number,
  h: number
): string | null {
  const trimmed = remoteImageUrl?.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) return null;

  const transformations = `f_auto,q_auto,c_fill,g_auto,w_${w},h_${h}`;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${encodeURIComponent(trimmed)}`;
}

export function cloudinaryFetchedFeaturedHeroUrl(remoteImageUrl: string): string | null {
  const trimmed = remoteImageUrl?.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) {
    return null;
  }

  const transformations = [
    "f_auto",
    "q_auto",
    "c_fill",
    "g_auto",
    `w_${W}`,
    `h_${H}`,
  ].join(",");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${encodeURIComponent(trimmed)}`;
}

/**
 * Returns a Cloudinary fetch URL optimised for Open Graph images:
 *   1200×630 px, JPEG, quality 80 — consistently under 300 KB.
 * Pass any publicly accessible image URL (Sanity CDN, isaacplans.com/images/*, etc.).
 */
export function cloudinaryOgImageUrl(originalUrl: string): string {
  const trimmed = originalUrl?.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) {
    return originalUrl;
  }

  const transformations = "c_fill,g_auto,w_1200,h_630,f_jpg,q_80";
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/fetch/${transformations}/${encodeURIComponent(trimmed)}`;
}
