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

/**
 * Social share cards for the GLOBAL partner portal at /partner (es: /socio) — distinct from the
 * per-partner cards, which are DB fields on the partner record.
 *
 * Purpose-designed artwork carrying its own text, one per language. Deliberately NOT run through
 * `cloudinaryOgImageUrl`: these are 1200×686, and normalizing to a 1200×630 `c_fill` would shave
 * ~8% of the height off a card whose text sits near the edges. Platforms handle 1.75:1 fine.
 *
 * Dimensions are intentionally not declared in the metadata — crawlers read them from the file,
 * so swapping either URL for a differently-sized card cannot leave a stale width/height behind.
 */
export const PARTNER_PORTAL_OG_IMAGE_ES =
  "https://res.cloudinary.com/isaacdev/image/upload/w_1200,q_auto,f_auto/v1786485443/34736723-e344-4203-ac18-73707ed1b6be_syny7f.png";

export const PARTNER_PORTAL_OG_IMAGE_EN =
  "https://res.cloudinary.com/isaacdev/image/upload/w_1200,q_auto,f_auto/v1786485479/09990451-0bd3-4c52-bf23-e3942f9ff297_bm4kuo.png";

export function partnerPortalOgImage(locale: "en" | "es"): string {
  return locale === "es" ? PARTNER_PORTAL_OG_IMAGE_ES : PARTNER_PORTAL_OG_IMAGE_EN;
}

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
export function partnerOgImage(
  locale: "en" | "es",
  partner: { ogImageUrlEn: string; ogImageUrlEs: string; heroImageUrl: string }
): string {
  return cloudinaryOgImageUrl(resolvePartnerOgSource(locale, partner));
}

/**
 * The un-normalized source URL behind {@link partnerOgImage}, in priority order:
 * this language → the other language → the hero image → the placeholder.
 *
 * Falling through to the other language matters because the two are usually the same design with
 * translated text: a partner who has only made the Spanish card yet should still get a real image
 * on the English page rather than an unrelated hero crop.
 *
 * Exported so the admin preview can show exactly what will be used without duplicating the chain.
 */
export function resolvePartnerOgSource(
  locale: "en" | "es",
  partner: { ogImageUrlEn: string; ogImageUrlEs: string; heroImageUrl: string }
): string {
  const preferred = locale === "es" ? partner.ogImageUrlEs : partner.ogImageUrlEn;
  const other = locale === "es" ? partner.ogImageUrlEn : partner.ogImageUrlEs;
  return (
    preferred.trim() ||
    other.trim() ||
    partner.heroImageUrl.trim() ||
    PARTNER_HERO_IMAGE_PLACEHOLDER
  );
}
