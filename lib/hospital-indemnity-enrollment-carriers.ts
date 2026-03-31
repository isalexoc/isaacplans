import type { CarrierItem } from "@/components/shortterm-carriers-section";
import { stmCarrierHeroUrl } from "@/components/shortterm-carriers-section";
import { allstateQuickQuoteUrl } from "@/lib/allstate-quick-quote";
import { uhoneShopCensusUrl } from "@/lib/uhone-broker";
import { UHONE_HUB_PRODUCT_CONFIG } from "@/lib/uhone-hub-products";
import { manhattanQuoteUrlForSlug } from "@/lib/manhattan-product-routes";

/**
 * Distinct hero image per card (avoid STM carriers grid + dental self-enroll pool overlap).
 */
const HI_ENROLLMENT_HERO_IDS = [
  "pexels-rdne-6129237_vbgahf_1_gfwx1z",
  "pexels-jibarofoto-2014773_wxjikn",
  "moneyback_frolim",
  "tmpft70mt0j_1_hppsqh",
] as const;

/**
 * Hospital indemnity self-enrollment — direct quote/enroll URLs (UHOne census, Manhattan HIS, NatGen product param).
 * `t` resolves keys under `HIpage` (e.g. `carriersSection.cards.uhoneHi.name`).
 */
export function buildHospitalIndemnityEnrollmentCarriers(
  t: (key: string) => string
): CarrierItem[] {
  const { hospitalWise, hospitalIndemnityGi } = UHONE_HUB_PRODUCT_CONFIG;

  return [
    {
      id: "uhone-hospital-indemnity",
      name: t("carriersSection.cards.uhoneHi.name"),
      blurb: t("carriersSection.cards.uhoneHi.blurb"),
      href: uhoneShopCensusUrl(hospitalWise.shopSegment),
      heroSrc: stmCarrierHeroUrl(HI_ENROLLMENT_HERO_IDS[0]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
    },
    {
      id: "uhone-hospital-indemnity-gi",
      name: t("carriersSection.cards.uhoneHiGi.name"),
      blurb: t("carriersSection.cards.uhoneHiGi.blurb"),
      href: uhoneShopCensusUrl(hospitalIndemnityGi.shopSegment),
      heroSrc: stmCarrierHeroUrl(HI_ENROLLMENT_HERO_IDS[1]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
    },
    {
      id: "manhattan-hi",
      name: t("carriersSection.cards.manhattanHi.name"),
      blurb: t("carriersSection.cards.manhattanHi.blurb"),
      href: manhattanQuoteUrlForSlug("hospital-indemnity-select"),
      heroSrc: stmCarrierHeroUrl(HI_ENROLLMENT_HERO_IDS[2]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/manhatan_logo_g6cswk.jpg",
    },
    {
      id: "allstate-hi",
      name: t("carriersSection.cards.allstateHi.name"),
      blurb: t("carriersSection.cards.allstateHi.blurb"),
      href: allstateQuickQuoteUrl("fixed-benefit-indemnity"),
      heroSrc: stmCarrierHeroUrl(HI_ENROLLMENT_HERO_IDS[3]),
      logoSrc:
        "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397414/allstate_logo_ungrkt.png",
    },
  ];
}
