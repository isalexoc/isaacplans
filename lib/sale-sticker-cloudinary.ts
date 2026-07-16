/** Cloudinary helpers for the sale-sticker tool. */

export const SALE_STICKER_CLOUDINARY_ROOT_FOLDER = "isaacplans";

/** Upload path for optional personal images: isaacplans/sale-stickers/{userId}/extras */
export function saleStickerUploadFolder(userId: string): string {
  return `${SALE_STICKER_CLOUDINARY_ROOT_FOLDER}/sale-stickers/${userId}/extras`;
}

function cloudName(): string {
  const name =
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
  if (!name) throw new Error("Cloudinary cloud name is not configured");
  return name;
}

/**
 * Agent photo as a background-removed, face-centered cutout for the sticker.
 * Reuses the agent's existing leave-behind profile photo publicId — we just apply
 * different transforms (background removal + face crop) at delivery time.
 */
export function saleStickerAgentCutoutUrl(publicId: string): string {
  if (!publicId) return "";
  const transforms =
    "e_background_removal/c_thumb,g_face,w_600,h_600/e_improve/e_sharpen:60/f_png/q_auto:best";
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transforms}/${publicId}`;
}

/**
 * Extract a Cloudinary public ID from any delivery URL, stripping leading
 * transformation components and an optional version segment. Handles both
 * `.../upload/e_improve/c_fill,.../<publicId>` and `.../upload/v123/<publicId>.jpg`.
 */
export function extractCloudinaryPublicId(url: string): string {
  if (!url) return "";
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return "";
  const segments = url.slice(i + marker.length).split("/");
  let idx = 0;
  // Skip leading transformation components (contain a Cloudinary "x_" param token).
  while (idx < segments.length && /(^|,)[a-z]{1,3}_[^/]*/.test(segments[idx])) idx++;
  // Skip a version segment like v1699999999.
  if (idx < segments.length && /^v\d+$/.test(segments[idx])) idx++;
  return segments.slice(idx).join("/").replace(/\.[a-zA-Z0-9]+$/, "");
}

/**
 * Resolve the agent cutout URL from a leave-behind profile. Prefers the stored
 * publicId; falls back to deriving it from the profile photo URL (legacy profiles
 * saved a raw URL without a publicId). Last resort: the raw URL (no cutout).
 */
export function resolveAgentCutoutUrl(publicId: string, profileImageUrl: string): string {
  const pid = publicId || extractCloudinaryPublicId(profileImageUrl);
  if (pid) return saleStickerAgentCutoutUrl(pid);
  return profileImageUrl || "";
}

/** Optional personal image, delivered as uploaded (background-removal option retired). */
export function saleStickerExtraImageUrl(publicId: string): string {
  if (!publicId) return "";
  const transforms = "c_limit,w_700,h_700/q_auto:good/f_auto";
  return `https://res.cloudinary.com/${cloudName()}/image/upload/${transforms}/${publicId}`;
}
