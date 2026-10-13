/**
 * Cover photos for the summary's first page — the lifestyle shot NLG puts behind its cover.
 * Reuses photos already on the site's Cloudinary account (licensed Pexels images used on the
 * get-covered heroes), so nothing new is uploaded.
 */

import type { CoverPhotoKey } from "./types";

const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

export const COVER_PHOTOS: Record<CoverPhotoKey, { label: string; publicId: string }> = {
  young_family: { label: "Young family", publicId: "v1785773108/pexels-helenalopes-27176986_quwu4i" },
  senior_couple: { label: "Senior couple", publicId: "pexels-gustavo-fring-4894565_seqt6k" },
  dad_daughter: { label: "Dad & daughter", publicId: "v1785777580/pexels-freestockpro-12969212_1_xck4cm" },
  family_home: { label: "Family at home", publicId: "pexels-august-de-richelieu-4260639_qgzqnk" },
};

export const DEFAULT_COVER_PHOTO: CoverPhotoKey = "young_family";

/** Small preview for the editor's photo picker (browser, so f_auto is fine here). */
export function coverPhotoThumbUrl(key: CoverPhotoKey): string {
  const photo = COVER_PHOTOS[key] ?? COVER_PHOTOS[DEFAULT_COVER_PHOTO];
  return `${CLOUDINARY}/c_fill,g_auto,w_240,h_178,q_auto,f_auto/${photo.publicId}`;
}

/**
 * Cropped to the cover's photo box with faces kept in frame. JPEG, because react-pdf decodes
 * only JPEG and PNG, and a photo as PNG would be several megabytes.
 */
export function coverPhotoUrl(key: CoverPhotoKey, widthPx: number, heightPx: number): string {
  const photo = COVER_PHOTOS[key] ?? COVER_PHOTOS[DEFAULT_COVER_PHOTO];
  return `${CLOUDINARY}/c_fill,g_auto,w_${widthPx},h_${heightPx},q_auto:good,f_jpg/${photo.publicId}`;
}
