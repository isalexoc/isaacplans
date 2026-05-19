import type { SupportedLocale } from "@/lib/seo/i18n";

const CLOUD_NAME =
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
  process.env.CLOUDINARY_CLOUD_NAME ??
  "isaacdev";

/** Uploaded OG assets (1200×630 source). */
const LEAVE_BEHIND_LANDING_OG = {
  en: {
    version: "v1779232065",
    publicId: "og_leave_image_english_iuktbh",
  },
  es: {
    version: "v1779232065",
    publicId: "og_leave_image_spanish_urfjw7",
  },
} as const;

/** Standard OG crop + modern format/quality for link previews. */
const LEAVE_BEHIND_OG_TRANSFORMS = "c_fill,w_1200,h_630,g_auto/f_auto,q_auto:good";

/**
 * Optimized Cloudinary URL for the public leave-behind landing page (Open Graph / Twitter).
 */
export function leaveBehindLandingOgImageUrl(locale: SupportedLocale): string {
  const asset = locale === "es" ? LEAVE_BEHIND_LANDING_OG.es : LEAVE_BEHIND_LANDING_OG.en;
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${LEAVE_BEHIND_OG_TRANSFORMS}/${asset.version}/${asset.publicId}.png`;
}
