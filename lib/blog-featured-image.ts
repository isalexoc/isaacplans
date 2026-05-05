/**
 * Cloudinary fetch URL: 16:9 hero, crop-to-fill (no letterboxing).
 *
 * `c_fill` scales to cover `w × h`, then trims overflow; `g_auto` keeps the crop
 * on the most salient region when the source aspect ratio differs from 16:9.
 *
 * https://cloudinary.com/documentation/transformation_reference
 *
 * Allow the Sanity CDN host under Cloudinary → Settings → Security → Allowed fetch domains.
 */
const CLOUD_NAME = "isaacdev";

const W = 1600;
const H = 900;

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
