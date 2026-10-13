/**
 * The carriers the Illustration Studio knows how to brand, and how to recognise each one in an
 * illustration's text.
 *
 * Each theme maps NLG's three-pillar layout (Die Too Soon / Live Too Long / Become Ill) onto the
 * carrier's own palette, so the pages read as if that carrier designed them. Brand colors were
 * sampled from the official logos (Cloudinary's color analysis on upload) and each carrier's own
 * illustration. Opaque hex only: react-pdf prints translucency unpredictably.
 *
 * Shared by the editor (swatches, carrier picker) and the PDF — no server-only imports.
 */

import type { CarrierKey } from "./types";

const CLOUDINARY = "https://res.cloudinary.com/isaacdev/image/upload";

export interface PillarColors {
  dieTooSoon: string;
  liveTooLong: string;
  becomeIll: string;
}

export interface CarrierTheme {
  /** Cover triangle, page title, rules. */
  primary: string;
  /** Product band, premium box, headings. */
  dark: string;
  /** Puzzle pieces, the death-benefit box and the cash-value bars. */
  pillars: PillarColors;
  /** Text drawn on a pillar color (white, except on light brand colors such as F&G gold). */
  onPillars: PillarColors;
  /** Panel backgrounds behind each pillar. */
  tints: PillarColors;
}

export interface CarrierLogo {
  /** Cloudinary public id, delivered as PNG (react-pdf decodes PNG and JPEG only). */
  publicId: string;
  /** Width ÷ height, so layouts can size the box before the image loads. */
  aspect: number;
  /** The artwork carries its own background (NLG's white-on-green), so no white badge behind it. */
  hasBackground?: boolean;
}

export interface CarrierProfile {
  key: CarrierKey;
  displayName: string;
  defaultIssuer: string;
  defaultIssuerLocation: string;
  /** Wide lockup, used in the offers-page header and the editor. */
  logo: CarrierLogo | null;
  /** Optional more compact mark for the cover badge. */
  coverLogo?: CarrierLogo;
  theme: CarrierTheme;
  /** Each match scores one point toward this carrier. */
  patterns: RegExp[];
}

const WHITE: PillarColors = { dieTooSoon: "#FFFFFF", liveTooLong: "#FFFFFF", becomeIll: "#FFFFFF" };

export const CARRIERS: Record<CarrierKey, CarrierProfile> = {
  national_life: {
    key: "national_life",
    displayName: "National Life Group",
    defaultIssuer: "Life Insurance Company of the Southwest",
    defaultIssuerLocation: "Addison, TX",
    logo: { publicId: "v1762909967/NLG_White_Logo_2x_Green_v1f7j5", aspect: 500 / 220, hasBackground: true },
    theme: {
      // The logo's own green, so the cover triangle and the logo artwork read as one shape.
      primary: "#338D28",
      dark: "#1F3864",
      pillars: { dieTooSoon: "#7A4892", liveTooLong: "#4CAF50", becomeIll: "#10A49F" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#EFE7F3", liveTooLong: "#DCF0D9", becomeIll: "#D2F0F9" },
    },
    patterns: [/Life Insurance Company of the Southwest/gi, /National Life (Group|Insurance Company)/gi],
  },
  americo: {
    key: "americo",
    displayName: "Americo",
    defaultIssuer: "Americo Financial Life and Annuity Insurance Company",
    defaultIssuerLocation: "Kansas City, MO",
    logo: { publicId: "isaacplans/illustration-studio/carriers/americo", aspect: 562 / 110 },
    theme: {
      primary: "#0B233F",
      dark: "#0B233F",
      pillars: { dieTooSoon: "#0B233F", liveTooLong: "#0077C8", becomeIll: "#D6232A" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#E2E7EE", liveTooLong: "#DCEDF9", becomeIll: "#FBE3E4" },
    },
    patterns: [/\bAmerico\b/gi],
  },
  american_amicable: {
    key: "american_amicable",
    displayName: "American Amicable",
    defaultIssuer: "American-Amicable Life Insurance Company of Texas",
    defaultIssuerLocation: "Waco, TX",
    logo: { publicId: "isaacplans/illustration-studio/carriers/american-amicable", aspect: 4102 / 1251 },
    theme: {
      primary: "#002440",
      dark: "#002440",
      pillars: { dieTooSoon: "#002440", liveTooLong: "#2F6CA8", becomeIll: "#2A8C9C" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#E0E6EC", liveTooLong: "#DEE9F4", becomeIll: "#DCEFF2" },
    },
    patterns: [/American[- ]Amicable/gi],
  },
  fg: {
    key: "fg",
    displayName: "F&G",
    defaultIssuer: "F&G Annuities & Life",
    defaultIssuerLocation: "Des Moines, IA",
    logo: { publicId: "isaacplans/illustration-studio/carriers/fg", aspect: 310 / 237 },
    theme: {
      primary: "#5A2A83",
      dark: "#3B1C57",
      pillars: { dieTooSoon: "#5A2A83", liveTooLong: "#FFC810", becomeIll: "#003B71" },
      onPillars: { dieTooSoon: "#FFFFFF", liveTooLong: "#3B1C57", becomeIll: "#FFFFFF" },
      tints: { dieTooSoon: "#ECE4F3", liveTooLong: "#FFF5D1", becomeIll: "#DFE7F0" },
    },
    patterns: [/F&G Annuities/gi, /Fidelity (&|and) Guaranty/gi, /\bF&G\b/g],
  },
  mutual_of_omaha: {
    key: "mutual_of_omaha",
    displayName: "Mutual of Omaha",
    defaultIssuer: "United of Omaha Life Insurance Company",
    defaultIssuerLocation: "Omaha, NE",
    logo: { publicId: "isaacplans/illustration-studio/carriers/mutual-of-omaha", aspect: 837 / 150 },
    coverLogo: { publicId: "isaacplans/illustration-studio/carriers/mutual-of-omaha-mark", aspect: 400 / 299 },
    theme: {
      primary: "#1A3D6D",
      dark: "#1A3D6D",
      pillars: { dieTooSoon: "#1A3D6D", liveTooLong: "#4F8FD6", becomeIll: "#0E7C86" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#E1E7EF", liveTooLong: "#DFEBF9", becomeIll: "#D8EFF0" },
    },
    patterns: [/United of Omaha/gi, /Mutual of Omaha/gi],
  },
  transamerica: {
    key: "transamerica",
    displayName: "Transamerica",
    defaultIssuer: "Transamerica Life Insurance Company",
    defaultIssuerLocation: "Cedar Rapids, IA",
    logo: { publicId: "isaacplans/illustration-studio/carriers/transamerica", aspect: 1318 / 318 },
    theme: {
      primary: "#6E2063",
      dark: "#2D2F36",
      pillars: { dieTooSoon: "#6E2063", liveTooLong: "#0072BC", becomeIll: "#00788A" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#F1E5EF", liveTooLong: "#DDEBF7", becomeIll: "#D9EEF1" },
    },
    patterns: [/Transamerica/gi],
  },
  other: {
    key: "other",
    displayName: "",
    defaultIssuer: "",
    defaultIssuerLocation: "",
    logo: null,
    theme: {
      primary: "#0077B6",
      dark: "#12355B",
      pillars: { dieTooSoon: "#12355B", liveTooLong: "#0077B6", becomeIll: "#2A9D8F" },
      onPillars: WHITE,
      tints: { dieTooSoon: "#E1E7EE", liveTooLong: "#DCEEF8", becomeIll: "#DDF1EE" },
    },
    patterns: [],
  },
};

export const CARRIER_OPTIONS = Object.values(CARRIERS).map(({ key, displayName }) => ({
  key,
  label: displayName || "Other carrier",
}));

export function getCarrier(key: CarrierKey): CarrierProfile {
  return CARRIERS[key] ?? CARRIERS.other;
}

/**
 * The carrier whose names appear most often in the text. Counting beats first-match: an
 * illustration can mention another company in passing (Mutual of Omaha's IRR pages are produced by
 * a third-party tool and name it), but its own name appears on every page footer.
 */
export function detectCarrier(text: string): CarrierKey {
  let best: { key: CarrierKey; score: number } = { key: "other", score: 0 };
  for (const carrier of Object.values(CARRIERS)) {
    const score = carrier.patterns.reduce((sum, pattern) => sum + (text.match(pattern)?.length ?? 0), 0);
    if (score > best.score) best = { key: carrier.key, score };
  }
  return best.key;
}

/** PNG delivery at a fixed pixel height; react-pdf can't decode Cloudinary's f_auto WebP/AVIF. */
export function carrierLogoUrl(logo: CarrierLogo, heightPx: number): string {
  return `${CLOUDINARY}/f_png,h_${heightPx},c_limit/${logo.publicId}`;
}
