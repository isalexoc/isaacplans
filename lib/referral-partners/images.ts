/**
 * Placeholder art for partner landing pages.
 *
 * These are stand-ins, not final creative. Both slots are editable per partner in
 * /admin/referral-partners (Hero image URL / Section image URL), so replacing them is a form
 * field, not a deploy. A partner with blank fields falls back to what's here.
 *
 * Same approach the Final Expense apply page took with FE_APPLY_HERO_IMAGE: reuse an existing
 * Cloudinary asset we already own rather than ship a broken <Image> while the real photo is
 * being chosen. Anything swapped in must be on a host listed in next.config.mjs remotePatterns
 * (Cloudinary already is) — or set `unoptimized`, which the partner logo already does.
 */

import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";

const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

/** Hero art — portrait-ish crop, sits beside the headline on desktop. PLACEHOLDER. */
export const PARTNER_HERO_IMAGE_PLACEHOLDER = `${CLOUDINARY}/f_auto,q_auto,w_1000,h_1100,c_fill,g_auto/pexels-wanda-yanery-villarraga-tole-584965425-17052722_ewanjk.jpg`;

/** Art beside the "what immigration looks at" block — landscape. PLACEHOLDER. */
export const PARTNER_SECTION_IMAGE_PLACEHOLDER = `${CLOUDINARY}/f_auto,q_auto,w_1000,h_750,c_fill,g_auto/pexels-gustavo-fring-4894565_seqt6k`;

export function partnerHeroImage(url: string): string {
  return url.trim() || PARTNER_HERO_IMAGE_PLACEHOLDER;
}

export function partnerSectionImage(url: string): string {
  return url.trim() || PARTNER_SECTION_IMAGE_PLACEHOLDER;
}

/**
 * Social share preview (og:image), normalized to 1200×630.
 *
 * Falls back to the hero image so a partner who never sets one still shares with a real photo
 * rather than nothing — the wrong aspect ratio is cropped by `c_fill,g_auto`, which beats a blank
 * card on WhatsApp. Everything goes through Cloudinary fetch, so a partner can paste any https
 * URL without pre-cropping it.
 *
 * Note: non-Cloudinary sources must be allowlisted under Cloudinary → Settings → Security →
 * Allowed fetch domains, same caveat as the blog's OG images.
 */
export function partnerOgImage(ogImageUrl: string, heroImageUrl: string): string {
  const chosen = ogImageUrl.trim() || heroImageUrl.trim() || PARTNER_HERO_IMAGE_PLACEHOLDER;
  return cloudinaryOgImageUrl(chosen);
}
