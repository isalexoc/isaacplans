/**
 * UHOne hub: product order, shop segments, and optional banner assets.
 * Copy lives in messages (`uhone.hub.products.*`).
 */

export type UhoneHubProductId =
  | "shortTerm"
  | "triTerm"
  | "healthProtector"
  | "advantageGuard"
  | "hospitalWise"
  | "hospitalIndemnityGi"
  | "hospitalGuard"
  | "hospitalSafeGuard"
  | "criticalGuard"
  | "termLife"
  | "dentalWise"
  | "dentalDiscount"
  | "visionWise"
  | "accidentWise"
  | "accidentPro"
  | "healthiestYou"
  | "mentalHealth";

export type UhoneHubSectionId =
  | "medical"
  | "hospital"
  | "criticalLife"
  | "dentalVision"
  | "accident"
  | "wellness";

export const UHONE_HUB_SECTIONS: { id: UhoneHubSectionId; productIds: UhoneHubProductId[] }[] =
  [
    {
      id: "medical",
      productIds: ["shortTerm", "triTerm", "healthProtector"],
    },
    {
      id: "hospital",
      productIds: [
        "advantageGuard",
        "hospitalWise",
        "hospitalIndemnityGi",
        "hospitalGuard",
        "hospitalSafeGuard",
      ],
    },
    {
      id: "criticalLife",
      productIds: ["criticalGuard", "termLife"],
    },
    {
      id: "dentalVision",
      productIds: ["dentalWise", "dentalDiscount", "visionWise"],
    },
    {
      id: "accident",
      productIds: ["accidentWise", "accidentPro"],
    },
    {
      id: "wellness",
      productIds: ["healthiestYou", "mentalHealth"],
    },
  ];

export type UhoneHubProductConfig = {
  /** shop.uhone.com census segment (omit = “all plans” root). */
  shopSegment?: string;
  /** If set, show secondary link to Isaac’s STM education page. */
  internalShortTermPage?: true;
  /** Optional banner under `/FileAttachment.ashx?FilePath=` */
  bannerFile?: string;
};

export const UHONE_HUB_PRODUCT_CONFIG: Record<UhoneHubProductId, UhoneHubProductConfig> = {
  shortTerm: {
    shopSegment: "shortterm",
    internalShortTermPage: true,
    bannerFile: "/Short_Term_Banner_Btn.jpg",
  },
  triTerm: {
    shopSegment: "tritermmedical",
  },
  healthProtector: {
    shopSegment: "protectorguard",
  },
  advantageGuard: {
    shopSegment: "advantageguard",
  },
  hospitalWise: {
    shopSegment: "hospitalindemnity",
    bannerFile: "/Quoting_Link_Banner_HospitalIndemnity.jpg",
  },
  hospitalIndemnityGi: {
    shopSegment: "hospitalindemnitygi",
  },
  hospitalGuard: {
    shopSegment: "hospitalguard",
  },
  hospitalSafeGuard: {
    shopSegment: "supplementalindemnity",
    bannerFile: "/Quoting_Link_Banner_Hospital_Safeguard.jpg",
  },
  criticalGuard: {
    shopSegment: "criticalillness",
    bannerFile: "/criticalIllness_btn.jpg",
  },
  termLife: {
    shopSegment: "termlife",
    bannerFile: "/termLife_btn.jpg",
  },
  dentalWise: {
    shopSegment: "dental",
    bannerFile: "/dental_btn.jpg",
  },
  dentalDiscount: {
    shopSegment: "dentaldiscount",
    bannerFile: "/allPlans_btn.jpg",
  },
  visionWise: {
    shopSegment: "vision",
    bannerFile: "/vision_btn.jpg",
  },
  accidentWise: {
    shopSegment: "accident",
    bannerFile: "/accident_btn.jpg",
  },
  accidentPro: {
    shopSegment: "accidentpro",
    bannerFile: "/accident_btn.jpg",
  },
  healthiestYou: {
    shopSegment: "healthiestyou",
    bannerFile: "/telehealth_btn.jpg",
  },
  mentalHealth: {
    shopSegment: "mentalhealth",
    bannerFile: "/mentalhealth_btn.jpg",
  },
};
