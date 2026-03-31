import type { CarrierItem } from "@/components/shortterm-carriers-section";
import { stmCarrierHeroUrl } from "@/components/shortterm-carriers-section";
import { allstateQuickQuoteUrl } from "@/lib/allstate-quick-quote";
import { uhoneShopCensusUrl } from "@/lib/uhone-broker";
import { UHONE_HUB_PRODUCT_CONFIG } from "@/lib/uhone-hub-products";
import { manhattanQuoteUrlForSlug } from "@/lib/manhattan-product-routes";

/** Isaac broker Ameritas self-enroll portal (same as dental-vision page). */
export const AMERITAS_DENTAL_SELF_ENROLL_URL =
  "https://myplan.ameritas.com/id/010A1380";

/**
 * Distinct stock hero per card (UHOne slugs previously shared the same asset for dental-wise / dental-discount).
 * Cloudinary public ids — same pool style as STM / carriers pages.
 */
const DENTAL_ENROLLMENT_HERO_IDS = [
  "pexels-shvetsa-3845653_v1r87k",
  "pexels-august-de-richelieu-4260639_qgzqnk",
  "pexels-pixabay-356040_kzryk7",
  "pexels-gabby-k-7114420_ev9ryf",
  "pexels-shvetsa-4421496_ex5gi4",
  "pexels-emma-bauso-1183828-2253879_1_1_udmuz2",
] as const;

/**
 * Carriers for dental & vision self-enrollment — **direct** quote/enroll URLs (not internal product landings).
 * UHOne: `shop.uhone.com` census paths with broker id (same as hub “dedicated” buttons).
 * `t` resolves keys under `dentalVisionPage` (e.g. `carriersSection.cards.ameritas.name`).
 */
export function buildDentalEnrollmentCarriers(
  t: (key: string) => string
): CarrierItem[] {
  const { dentalWise, dentalDiscount, visionWise } = UHONE_HUB_PRODUCT_CONFIG;

  return [
    {
      id: "ameritas",
      name: t("carriersSection.cards.ameritas.name"),
      blurb: t("carriersSection.cards.ameritas.blurb"),
      href: AMERITAS_DENTAL_SELF_ENROLL_URL,
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[0]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/ameritas-transparent_1_bbjb2f.png",
    },
    {
      id: "uhone-dental-wise",
      name: t("carriersSection.cards.uhoneDentalWise.name"),
      blurb: t("carriersSection.cards.uhoneDentalWise.blurb"),
      href: uhoneShopCensusUrl(dentalWise.shopSegment),
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[1]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
    },
    {
      id: "uhone-dental-discount",
      name: t("carriersSection.cards.uhoneDentalDiscount.name"),
      blurb: t("carriersSection.cards.uhoneDentalDiscount.blurb"),
      href: uhoneShopCensusUrl(dentalDiscount.shopSegment),
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[2]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
    },
    {
      id: "uhone-vision-wise",
      name: t("carriersSection.cards.uhoneVisionWise.name"),
      blurb: t("carriersSection.cards.uhoneVisionWise.blurb"),
      href: uhoneShopCensusUrl(visionWise.shopSegment),
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[3]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
    },
    {
      id: "manhattan-dvh",
      name: t("carriersSection.cards.manhattanDvh.name"),
      blurb: t("carriersSection.cards.manhattanDvh.blurb"),
      href: manhattanQuoteUrlForSlug("dental-vision-hearing"),
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[4]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/manhatan_logo_g6cswk.jpg",
    },
    {
      id: "allstate-dental",
      name: t("carriersSection.cards.allstateDental.name"),
      blurb: t("carriersSection.cards.allstateDental.blurb"),
      href: allstateQuickQuoteUrl("dental"),
      heroSrc: stmCarrierHeroUrl(DENTAL_ENROLLMENT_HERO_IDS[5]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397414/allstate_logo_ungrkt.png",
    },
  ];
}
