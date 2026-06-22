/**
 * Locale-specific Open Graph / link-preview images for the IUL intake page.
 *
 * The source cards are already hosted on Cloudinary, so "optimize" = inject delivery
 * transforms after `/image/upload/` (modern format + quality). We keep the SQUARE card as
 * the primary preview — a 1200×630 landscape crop would clip the card's text — and expose
 * the vertical as a secondary image.
 */

type OgLocale = "en" | "es";

const SOURCES: Record<OgLocale, { square: string; vertical: string }> = {
  en: {
    square:
      "https://res.cloudinary.com/isaacdev/image/upload/v1782138785/social-media/iul/cards/square-1782138778523.png",
    vertical:
      "https://res.cloudinary.com/isaacdev/image/upload/v1782138785/social-media/iul/cards/vertical-1782138778523.png",
  },
  es: {
    square:
      "https://res.cloudinary.com/isaacdev/image/upload/v1782139092/social-media/iul/cards/square-1782139085250.png",
    vertical:
      "https://res.cloudinary.com/isaacdev/image/upload/v1782139092/social-media/iul/cards/vertical-1782139085250.png",
  },
};

/** Inject Cloudinary delivery transforms into an existing /image/upload/ URL. */
function optimize(url: string, transforms: string): string {
  return url.replace("/image/upload/", `/image/upload/${transforms}/`);
}

const SQUARE_TRANSFORMS = "f_auto,q_auto:good,w_1200,h_1200,c_fill,g_auto";
const VERTICAL_TRANSFORMS = "f_auto,q_auto:good,w_1080,h_1920,c_fill,g_auto";

export function iulIntakeOgImages(locale: OgLocale): { square: string; vertical: string } {
  const src = locale === "es" ? SOURCES.es : SOURCES.en;
  return {
    square: optimize(src.square, SQUARE_TRANSFORMS),
    vertical: optimize(src.vertical, VERTICAL_TRANSFORMS),
  };
}
