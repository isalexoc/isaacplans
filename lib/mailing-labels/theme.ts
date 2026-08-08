/**
 * Visual tokens for printed labels, shared by the PDF renderer (lib/mailing-labels/pdf.tsx) and
 * the on-screen preview (components/admin/mailing-labels/label-preview.tsx) so the two layouts
 * can't drift apart. All sizes are in points, matching ./presets.ts.
 *
 * Colors mirror the Senior Life palette already used in components/final-expense-slide-content.tsx
 * and components/FinalExpensePresentationButton.tsx (there is no shared carrier-theme module yet).
 */

import type { StickerVariant } from "./presets";

export const SENIOR_LIFE = {
  blue: "#003366",
  gold: "#D4A84B",
  ink: "#101828",
  muted: "#5B6673",
  hairline: "#D0D5DD",
} as const;

export type LabelTypeScale = {
  padX: number;
  padY: number;
  /** Blue brand strip across the top; 0 means the variant has no strip. */
  headerHeight: number;
  logoHeight: number;
  eyebrowSize: number;
  nameSize: number;
  addressSize: number;
  footerSize: number;
  lineGap: number;
};

/**
 * Per-variant type scale. The numbers are chosen so the tallest realistic block (name + street +
 * apt + city/state/zip, plus footer) clears the label height with margin to spare — a 4×2 label
 * has ~94 pt of usable body height and the block needs ~74 pt.
 */
export const LABEL_TYPE_SCALE: Record<StickerVariant, LabelTypeScale> = {
  standard: {
    padX: 18,
    padY: 10,
    headerHeight: 30,
    logoHeight: 17,
    eyebrowSize: 0,
    nameSize: 13,
    addressSize: 12,
    footerSize: 7.5,
    lineGap: 2,
  },
  folder: {
    padX: 24,
    padY: 14,
    headerHeight: 46,
    logoHeight: 26,
    eyebrowSize: 8,
    nameSize: 16,
    addressSize: 13.5,
    footerSize: 8.5,
    lineGap: 3,
  },
  // 2⅝" × 1" leaves no room for branding — text only, tuned to fit four lines in 72 pt.
  compact: {
    padX: 9,
    padY: 6,
    headerHeight: 0,
    logoHeight: 0,
    eyebrowSize: 0,
    nameSize: 9,
    addressSize: 8.5,
    footerSize: 0,
    lineGap: 1,
  },
};

export type ShippingTypeScale = {
  pad: number;
  logoHeight: number;
  fromLabelSize: number;
  fromSize: number;
  toLabelSize: number;
  toNameSize: number;
  toAddressSize: number;
  /** How far the TO block is inset from the left edge — USPS convention, and it reads clearly. */
  toIndent: number;
  toTopGap: number;
  lineGap: number;
};

export const SHIPPING_TYPE_SCALE: Record<"usps_4x6" | "usps_half_5126", ShippingTypeScale> = {
  usps_4x6: {
    pad: 18,
    logoHeight: 20,
    fromLabelSize: 7,
    fromSize: 9,
    toLabelSize: 9,
    toNameSize: 16,
    toAddressSize: 15,
    toIndent: 46,
    toTopGap: 40,
    lineGap: 3,
  },
  usps_half_5126: {
    pad: 30,
    logoHeight: 28,
    fromLabelSize: 8.5,
    fromSize: 11,
    toLabelSize: 11,
    toNameSize: 21,
    toAddressSize: 19,
    toIndent: 84,
    toTopGap: 54,
    lineGap: 4,
  },
};

export const EYEBROW_TEXT: Record<"en" | "es", string> = {
  en: "PREPARED FOR",
  es: "PREPARADO PARA",
};
