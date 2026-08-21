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
 *  16:9 apply slot. `c_limit` never upscales a smaller original. */
export const HERO_IMAGE_TRANSFORM = "f_auto,q_auto,w_1600,c_limit";

/** An uploaded poster is just a hero-sized still, so it takes the same treatment. */
export const POSTER_IMAGE_TRANSFORM = HERO_IMAGE_TRANSFORM;

/** Social card: smart-cropped to the ratio Facebook and iMessage expect. */
export const OG_IMAGE_TRANSFORM = "f_auto,q_auto,w_1200,h_630,c_fill,g_auto";

/**
 * Video: ONE pinned format, deliberately. `c_limit` still never upscales a phone-shot clip to
 * 1280 and pay for pixels that were never there.
 *
 * This used to be `f_auto,q_auto,vc_auto,…`, chosen so modern browsers got VP9/AV1 and older ones
 * H.264. That reasoning is sound for a short clip and wrong for a hero video, because Cloudinary
 * derives a SEPARATE asset per browser family and transcodes each one on the first request that
 * asks for it. Measured on the Spanish Final Expense apply hero, an 11-minute talking head:
 *
 * | client           | delivered         | size    | etag       |
 * | ---------------- | ----------------- | ------- | ---------- |
 * | Chrome / Firefox | `video/webm; vp9` | 30.4 MB | `bff9e3ec` |
 * | Safari on iPhone | `video/mp4; hvc1` | 37.7 MB | `5ad46c02` |
 *
 * Two different files. Whoever arrives first on a device family nobody has used yet waits out a
 * full transcode of a multi-minute source, on a hero, above the fold. Warming the page in one
 * browser does nothing for the next visitor in another.
 *
 * H.264 in MP4 plays on every iPhone, Android, Safari, Chrome, Firefox and smart TV, so pinning it
 * means exactly one derived asset per video and one warm-up covers every visitor. Quality is
 * pinned to `q_auto:good` rather than plain `q_auto` because `q_auto` branches again on the
 * `Save-Data` request header, quietly producing yet another variant.
 *
 * The cost is accepted: Chrome downloads H.264 rather than the ~7 MB smaller VP9. Bandwidth is
 * cheap; a visitor watching a spinner on a hero is not.
 *
 * This constant is shared by every hero video on the site, including anything uploaded through
 * /admin/hero — so after uploading a new hero video, run `pnpm warm:media`.
 */
export const HERO_VIDEO_TRANSFORM = "f_mp4,vc_h264,q_auto:good,w_1280,c_limit";

/**
 * Auto poster: the video's own first frame (`so_0` = start offset zero). `f_auto` rather than a
 * hardcoded `f_jpg` so browsers that accept WebP/AVIF get the smaller one — this image is fetched
 * raw by the `poster` attribute, outside next/image, so the format choice is ours to make.
 */
export const VIDEO_POSTER_TRANSFORM = "so_0,f_auto,q_auto,w_1600,c_limit";

/** Inject a transform into a `secure_url` Cloudinary handed back at upload time. */
export function withTransform(secureUrl: string, transform: string, resource: "image" | "video") {
  return secureUrl.replace(`/${resource}/upload/`, `/${resource}/upload/${transform}/`);
}

/**
 * Cloudinary transformation parameter prefixes, used to tell a transform segment apart from a
 * folder in the public id. Deliberately an allow-list: a bare `startsWith letters + underscore`
 * test would eat a folder called `my_videos`, and silently rewriting somebody's path into a
 * 404 is a worse failure than leaving a URL untouched.
 */
const TRANSFORM_PARAMS = new Set([
  "w", "h", "c", "f", "q", "vc", "ac", "so", "eo", "du", "fl", "g", "b", "co", "e", "l", "o",
  "r", "x", "y", "z", "ar", "dpr", "br", "vs", "fps", "ki", "kf",
]);

function isTransformSegment(segment: string): boolean {
  const parts = segment.split(",");
  return parts.length > 0 && parts.every((p) => TRANSFORM_PARAMS.has(p.split("_")[0]));
}

/**
 * Force a stored video URL onto the current `HERO_VIDEO_TRANSFORM`.
 *
 * An override saved in /admin/hero stores the FULL delivery URL, with whatever transform was
 * current the day it was uploaded baked into it. So changing `HERO_VIDEO_TRANSFORM` fixes the
 * built-in defaults and silently misses every video Isaac actually uploaded — which are the ones
 * most likely to be cold. Rewriting on read fixes old and new overrides at once, with no data
 * migration and nothing for anyone to remember.
 *
 * A URL that is not a Cloudinary video delivery URL, or whose shape we don't recognise, is
 * returned untouched.
 */
export function withPinnedVideoTransform(url: string): string {
  const marker = "/video/upload/";
  const at = url.indexOf(marker);
  if (at === -1) return url;

  const head = url.slice(0, at + marker.length);
  const segments = url.slice(at + marker.length).split("/");

  // Drop the leading transform segments; keep the version and public id that follow.
  while (segments.length > 1 && isTransformSegment(segments[0])) segments.shift();
  if (segments.length === 0) return url;

  return `${head}${HERO_VIDEO_TRANSFORM}/${segments.join("/")}`;
}

export function videoUrl(publicId: string): string {
  return `${CLOUD}/video/upload/${HERO_VIDEO_TRANSFORM}/${publicId}.mp4`;
}

/**
 * Delivery URL for a still someone picked as a video's poster, rather than the auto first frame.
 * Takes the public id WITH its extension, exactly as it appears in the Cloudinary URL — `f_auto`
 * still serves WebP/AVIF where the browser accepts it, whatever the original format was.
 */
export function posterImageUrl(publicIdWithExtension: string): string {
  return `${CLOUD}/image/upload/${POSTER_IMAGE_TRANSFORM}/${publicIdWithExtension}`;
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
