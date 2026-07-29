/**
 * Locale-specific Open Graph / link-preview images for the ACA intake page.
 *
 * The source cards are already hosted on Cloudinary, so "optimize" = inject delivery
 * transforms after `/image/upload/` rather than re-uploading anything.
 *
 * Choices worth knowing:
 *  - `c_limit` (not `c_fill`): the sources are 1080×1080, so a `w_1200` fill would UPSCALE
 *    them — more bytes, no more detail. `c_limit` caps at 1200 and leaves anything smaller
 *    alone, so this stays correct if a larger card is swapped in later.
 *  - Square is the only aspect served. A 1200×630 landscape crop clips the card's text, and
 *    every major scraper renders a square card fine (same call as the IUL intake page).
 *  - `f_auto` negotiates on the request's Accept header: browsers get WebP (~147 KB, 57%
 *    smaller than the 346 KB PNG), and scrapers that don't advertise WebP fall back to JPEG
 *    (~209 KB, 40% smaller). Nothing is left un-optimized.
 */

type OgLocale = "en" | "es";

const SOURCES: Record<OgLocale, string> = {
  en: "https://res.cloudinary.com/isaacdev/image/upload/v1785334793/square-medical-en_s783ks.png",
  es: "https://res.cloudinary.com/isaacdev/image/upload/v1785334808/square-medical-es_qg0pem.png",
};

/** Inject Cloudinary delivery transforms into an existing /image/upload/ URL. */
function optimize(url: string, transforms: string): string {
  return url.replace("/image/upload/", `/image/upload/${transforms}/`);
}

/** Resize as its own component, then format + quality — Cloudinary's recommended ordering. */
const SQUARE_TRANSFORMS = "c_limit,w_1200,h_1200/f_auto/q_auto:good";

/** Intrinsic size of the delivered card, for the OG `width`/`height` tags. */
export const ACA_OG_SIZE = { width: 1080, height: 1080 } as const;

export function acaIntakeOgImage(locale: OgLocale): string {
  return optimize(locale === "es" ? SOURCES.es : SOURCES.en, SQUARE_TRANSFORMS);
}
