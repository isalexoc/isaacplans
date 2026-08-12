/**
 * Cloudinary delivery URLs for admin-uploaded page media.
 *
 * Video is delivered as a plain progressive MP4 rather than HLS: these are short hero clips, the
 * browser range-requests only what it plays with `preload="metadata"`, and HLS would mean shipping
 * hls.js to every visitor on pages whose load time costs ad money. Same convention the existing
 * carrier intro videos already use (see components/uhone-intro-video.tsx).
 *
 * Client-safe (pure string building) — the admin preview and the server renderer share it.
 */

const CLOUD = "https://res.cloudinary.com/isaacdev";

/** Hero: cap the width, let `f_auto,q_auto` pick format and compression. No forced crop — the
 *  page's own `object-cover` frames it, so one upload works in both the tall ads panel and the
 *  16:9 apply slot. */
export const HERO_IMAGE_TRANSFORM = "f_auto,q_auto,w_1600,c_limit";

/** Social card: smart-cropped to the ratio Facebook and iMessage expect. */
export const OG_IMAGE_TRANSFORM = "f_auto,q_auto,w_1200,h_630,c_fill,g_auto";

/** Video: width-capped, auto codec/quality. */
export const HERO_VIDEO_TRANSFORM = "f_auto,q_auto,w_1280";

/** Poster frame pulled from the first frame of the video (`so_0` = start offset zero). */
export const VIDEO_POSTER_TRANSFORM = "so_0,f_jpg,q_auto,w_1280";

/** Inject a transform into a `secure_url` Cloudinary handed back at upload time. */
export function withTransform(secureUrl: string, transform: string, resource: "image" | "video") {
  return secureUrl.replace(`/${resource}/upload/`, `/${resource}/upload/${transform}/`);
}

export function videoUrl(publicId: string): string {
  return `${CLOUD}/video/upload/${HERO_VIDEO_TRANSFORM}/${publicId}.mp4`;
}

/**
 * Still frame for a video, used as the `poster` and as the reduced-motion fallback. Lives on
 * `res.cloudinary.com/isaacdev/**`, which next.config.mjs already allows, so `next/image` can
 * render it without a config change.
 */
export function videoPosterUrl(publicId: string): string {
  return `${CLOUD}/video/upload/${VIDEO_POSTER_TRANSFORM}/${publicId}.jpg`;
}

/** Only Cloudinary URLs on Isaac's cloud are accepted — the sole host next/image permits here. */
export function isAllowedCloudinaryUrl(url: string): boolean {
  return /^https:\/\/res\.cloudinary\.com\/isaacdev\/.+/i.test(url.trim());
}

/** True for a delivery URL that points at the video resource type rather than an image. */
export function isVideoUrl(url: string): boolean {
  return url.includes("/video/upload/");
}

/**
 * Best-effort public id from a Cloudinary delivery URL, so an admin can paste a URL they copied
 * out of the Cloudinary console and still get a matching poster frame. Strips the transform
 * segment (the one containing commas or a known prefix) and the file extension.
 */
export function publicIdFromUrl(url: string): string | null {
  const match = url.match(/\/(?:image|video)\/upload\/(.+)$/);
  if (!match) return null;
  const rest = match[1];
  const segments = rest.split("/").filter(Boolean);
  // Drop leading transform segments — Cloudinary transforms always contain a `_` param pair, and
  // a version segment is `v` followed by digits (which we keep, it is part of the public id).
  while (segments.length > 1 && /[,]/.test(segments[0])) segments.shift();
  const joined = segments.join("/");
  const withoutExt = joined.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt || null;
}
