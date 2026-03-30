/**
 * Hero and OG images for Allstate Health Solutions product landing pages.
 * Reuses Cloudinary-hosted stock imagery (same pool style as UHOne pages).
 */

import type {
  AllstateIndividualProductSlug,
  AllstateSeniorProductSlug,
} from "./allstate-product-routes";
import { ALLSTATE_CANCER_ONLY_SLUG } from "./allstate-product-routes";

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
} as const;

const HERO_TRANSFORM = "f_auto,q_auto,w_1600,h_1200,c_fill,g_auto" as const;

const SENIOR: Record<AllstateSeniorProductSlug, string> = {
  "all-products": IMG.a,
  "dental-vision-hearing": IMG.b,
  "senior-indemnity": IMG.c,
  "my-life-senior": IMG.d,
};

const INDIVIDUAL: Record<AllstateIndividualProductSlug, string> = {
  accident: IMG.e,
  dental: IMG.f,
  "life-cancer-critical-illness": IMG.g,
  "fixed-benefit-indemnity": IMG.h,
  "my-life-wellness": IMG.i,
};

const CANCER = IMG.j;

function transform(src: string): string {
  return src.replace("/upload/", `/upload/${HERO_TRANSFORM}/`);
}

export function getAllstateSeniorHeroSrc(slug: AllstateSeniorProductSlug): string {
  return transform(SENIOR[slug]);
}

export function getAllstateIndividualHeroSrc(
  slug: AllstateIndividualProductSlug
): string {
  return transform(INDIVIDUAL[slug]);
}

export function getAllstateCancerOnlyHeroSrc(): string {
  return transform(CANCER);
}

export function getAllstateProductOgImageSrc(
  kind: "seniors" | "individual" | "cancer",
  slug: AllstateSeniorProductSlug | AllstateIndividualProductSlug | typeof ALLSTATE_CANCER_ONLY_SLUG
): string {
  let base: string;
  if (kind === "cancer") {
    base = CANCER;
  } else if (kind === "seniors") {
    base = SENIOR[slug as AllstateSeniorProductSlug];
  } else {
    base = INDIVIDUAL[slug as AllstateIndividualProductSlug];
  }
  return base.replace("/upload/", "/upload/w_1200,h_630,c_fill,f_auto,q_auto/");
}
