/**
 * Hero and OG images for Manhattan Life product landing pages.
 */

import { MANHATTAN_PRODUCT_SLUGS, type ManhattanProductSlug } from "./manhattan-product-routes";

const IMG = [
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840012/pexels-silverkblack-36763394_tzio8j.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840011/pexels-silverkblack-36729921_enccme.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840011/pexels-silverkblack-36713490_r4bk1n.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-silverkblack-23496711_xq1oxx.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-olly-3776833_h7cew9.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-8777831_vm3jn8.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-8636650_mrnxo7.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-kampus-7893813_v0ovth.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840006/pexels-ivan-s-9630189_usy7h5.jpg",
  "https://res.cloudinary.com/isaacdev/image/upload/v1774840005/pexels-fauxels-3184407_ydz0wi.jpg",
] as const;

const HERO_TRANSFORM = "f_auto,q_auto,w_1600,h_1200,c_fill,g_auto" as const;

const slugToSrc: Record<ManhattanProductSlug, string> = {} as Record<
  ManhattanProductSlug,
  string
>;
for (let i = 0; i < MANHATTAN_PRODUCT_SLUGS.length; i++) {
  slugToSrc[MANHATTAN_PRODUCT_SLUGS[i]] = IMG[i % IMG.length];
}

function transform(src: string): string {
  return src.replace("/upload/", `/upload/${HERO_TRANSFORM}/`);
}

export function getManhattanProductHeroSrc(slug: ManhattanProductSlug): string {
  return transform(slugToSrc[slug]);
}

export function getManhattanProductOgImageSrc(slug: ManhattanProductSlug): string {
  return slugToSrc[slug].replace("/upload/", "/upload/w_1200,h_630,c_fill,f_auto,q_auto/");
}
