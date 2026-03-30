/**
 * URL slugs and hero assets for UHOne product landing pages (not Short Term Medical—see /carriers/uhone/shortterm).
 */

import type { UhoneHubProductId } from "./uhone-hub-products";

const IMG = {
  a: "https://res.cloudinary.com/isaacdev/image/upload/v1774840012/pexels-silverkblack-36763394_tzio8j.jpg",
  b: "https://res.cloudinary.com/isaacdev/image/upload/v1774840011/pexels-silverkblack-36729921_enccme.jpg",
  c: "https://res.cloudinary.com/isaacdev/image/upload/v1774840011/pexels-silverkblack-36713490_r4bk1n.jpg",
  d: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-silverkblack-23496711_xq1oxx.jpg",
  e: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-olly-3776833_h7cew9.jpg",
  f: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-8777831_vm3jn8.jpg",
  g: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-8636650_mrnxo7.jpg",
  h: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-7893813_v0ovth.jpg",
  i: "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-ivan-s-9630189_usy7h5.jpg",
  j: "https://res.cloudinary.com/isaacdev/image/upload/v1774840005/pexels-fauxels-3184407_ydz0wi.jpg",
  k: "https://res.cloudinary.com/isaacdev/image/upload/v1774840005/pexels-alexy-almond-3758052_zeqi0s.jpg",
} as const;

export const UHONE_PRODUCT_PAGE_SLUGS = [
  "triterm",
  "health-protector",
  "advantage-guard",
  "hospital-wise",
  "hospital-indemnity-gi",
  "hospital-guard",
  "hospital-safeguard",
  "critical-guard",
  "term-life",
  "dental-wise",
  "dental-discount",
  "vision-wise",
  "accident-wise",
  "accident-pro",
  "healthiest-you",
  "mental-health",
] as const;

export type UhoneProductPageSlug = (typeof UHONE_PRODUCT_PAGE_SLUGS)[number];

/** shop.uhone.com census segment targets (from hub config) */
export const SLUG_TO_PRODUCT_ID: Record<UhoneProductPageSlug, UhoneHubProductId> = {
  triterm: "triTerm",
  "health-protector": "healthProtector",
  "advantage-guard": "advantageGuard",
  "hospital-wise": "hospitalWise",
  "hospital-indemnity-gi": "hospitalIndemnityGi",
  "hospital-guard": "hospitalGuard",
  "hospital-safeguard": "hospitalSafeGuard",
  "critical-guard": "criticalGuard",
  "term-life": "termLife",
  "dental-wise": "dentalWise",
  "dental-discount": "dentalDiscount",
  "vision-wise": "visionWise",
  "accident-wise": "accidentWise",
  "accident-pro": "accidentPro",
  "healthiest-you": "healthiestYou",
  "mental-health": "mentalHealth",
};

const PRODUCT_ID_TO_SLUG = Object.fromEntries(
  Object.entries(SLUG_TO_PRODUCT_ID).map(([slug, id]) => [id, slug])
) as Record<
  Exclude<UhoneHubProductId, "shortTerm">,
  UhoneProductPageSlug
>;

export function isUhoneProductPageSlug(s: string): s is UhoneProductPageSlug {
  return (UHONE_PRODUCT_PAGE_SLUGS as readonly string[]).includes(s);
}

export function slugToProductId(slug: string): UhoneHubProductId | null {
  if (!isUhoneProductPageSlug(slug)) return null;
  return SLUG_TO_PRODUCT_ID[slug];
}

/** Map hub product id → URL slug (null for shortTerm — use /carriers/uhone/shortterm). */
export function productIdToSlug(
  productId: UhoneHubProductId
): UhoneProductPageSlug | null {
  if (productId === "shortTerm") return null;
  return PRODUCT_ID_TO_SLUG[productId] ?? null;
}

/** Hero image per slug (11 unique assets; some reused by category). */
const HERO_BY_SLUG: Record<UhoneProductPageSlug, string> = {
  triterm: IMG.a,
  "health-protector": IMG.b,
  "advantage-guard": IMG.c,
  "hospital-wise": IMG.d,
  "hospital-indemnity-gi": IMG.d,
  "hospital-guard": IMG.e,
  "hospital-safeguard": IMG.f,
  "critical-guard": IMG.g,
  "term-life": IMG.h,
  "dental-wise": IMG.i,
  "dental-discount": IMG.i,
  "vision-wise": IMG.j,
  "accident-wise": IMG.k,
  "accident-pro": IMG.a,
  "healthiest-you": IMG.b,
  "mental-health": IMG.c,
};

const HERO_TRANSFORM =
  "f_auto,q_auto,w_1600,h_1200,c_fill,g_auto" as const;

export function getUhoneProductHeroSrc(slug: UhoneProductPageSlug): string {
  const base = HERO_BY_SLUG[slug];
  return base.replace("/upload/", `/upload/${HERO_TRANSFORM}/`);
}

/** Open Graph / Twitter (1200×630). */
export function getUhoneProductOgImageSrc(slug: UhoneProductPageSlug): string {
  const base = HERO_BY_SLUG[slug];
  return base.replace("/upload/", "/upload/w_1200,h_630,c_fill,f_auto,q_auto/");
}

export type UhoneLearnMoreHref =
  | "/carriers/uhone/shortterm"
  | {
      pathname: "/carriers/uhone/[product]";
      params: { product: UhoneProductPageSlug };
    };

export function getUhoneLearnMoreHref(
  productId: UhoneHubProductId
): UhoneLearnMoreHref {
  if (productId === "shortTerm") return "/carriers/uhone/shortterm";
  const slug = productIdToSlug(productId);
  if (!slug) return "/carriers/uhone/shortterm";
  return { pathname: "/carriers/uhone/[product]", params: { product: slug } };
}
