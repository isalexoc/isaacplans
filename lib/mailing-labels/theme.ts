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

/**
 * Print-resolution Senior Life logo. The leave-behind constant delivers `w_560`, which is fine on
 * screen but soft once it's 40 pt tall on paper at 300+ DPI — same Cloudinary asset as
 * LEAVE_BEHIND_SENIOR_LIFE_LOGO_SINGLE in lib/leave-behind-assets.ts, just a larger derivative.
 */
export const SENIOR_LIFE_LOGO_PRINT =
  "https://res.cloudinary.com/isaacdev/image/upload/w_1200,f_png/v1773060314/Full-Logo-Gold.144f1298_iluidv.png";

export type LabelTypeScale = {
  padX: number;
  padY: number;
  /** Blue brand strip across the top; 0 means the variant has no strip. */
  headerHeight: number;
  /** Gold rule under the blue strip. Small, but it's what makes the band read as designed. */
  accentHeight: number;
  logoHeight: number;
  eyebrowSize: number;
  nameSize: number;
  addressSize: number;
  footerSize: number;
  lineGap: number;
};

/**
 * Per-variant type scale, sized for the audience: these labels are read by seniors, so the
 * address is set far larger than a typical mailing label and the logo is big enough to actually
 * register as Senior Life rather than a smudge.
 *
 * Each variant is checked against its label height. Worst case is a four-line block (name, street,
 * apt, city/state/ZIP) plus the footer:
 *   standard 4x2   → body 112 pt available, block needs ~105 pt
 *   folder   4x3.33 → body 180 pt available, block needs ~152 pt
 *   compact  2.625x1 → 72 pt total, block needs ~57 pt
 * Raising any size means re-checking those sums.
 */
export const LABEL_TYPE_SCALE: Record<StickerVariant, LabelTypeScale> = {
  standard: {
    padX: 16,
    padY: 8,
    headerHeight: 29,
    accentHeight: 2,
    logoHeight: 19,
    eyebrowSize: 0,
    nameSize: 17,
    addressSize: 14.5,
    footerSize: 8.5,
    lineGap: 2,
  },
  folder: {
    padX: 24,
    padY: 14,
    headerHeight: 60,
    accentHeight: 3,
    logoHeight: 40,
    eyebrowSize: 9.5,
    nameSize: 23,
    addressSize: 17.5,
    footerSize: 10,
    lineGap: 3,
  },
  // 2⅝" × 1" leaves no room for branding — text only, tuned to fit four lines in 72 pt.
  compact: {
    padX: 8,
    padY: 5,
    headerHeight: 0,
    accentHeight: 0,
    logoHeight: 0,
    eyebrowSize: 0,
    nameSize: 10,
    addressSize: 9.5,
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
    logoHeight: 26,
    fromLabelSize: 7.5,
    fromSize: 9.5,
    toLabelSize: 9,
    toNameSize: 19,
    toAddressSize: 17,
    toIndent: 44,
    toTopGap: 38,
    lineGap: 3,
  },
  usps_half_5126: {
    pad: 30,
    logoHeight: 36,
    fromLabelSize: 8.5,
    fromSize: 11,
    toLabelSize: 11,
    toNameSize: 25,
    toAddressSize: 21,
    toIndent: 84,
    toTopGap: 52,
    lineGap: 4,
  },
};

export const EYEBROW_TEXT: Record<"en" | "es", string> = {
  en: "PREPARED FOR",
  es: "PREPARADO PARA",
};
