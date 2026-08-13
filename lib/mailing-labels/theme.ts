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

/**
 * Width ÷ height of that asset (it delivers 1200 × 675). Both renderers constrain the logo by
 * height, so this is how the layout math in ./layout.ts knows how much horizontal room it will
 * actually take beside the return address.
 */
export const SENIOR_LIFE_LOGO_ASPECT = 1200 / 675;

/**
 * Isaac's agent credential card, printed beside the signature on the letter. Seeing a face and a
 * credential does more for a senior's trust than anything the text can say.
 *
 * These are 450x716 originals — no upscaling transform, since that would only soften them. At the
 * printed width in letter-pdf.tsx they land near 300 DPI.
 */
export const AGENT_CREDENTIAL_IMAGE: Record<"en" | "es", string> = {
  en: "https://res.cloudinary.com/isaacdev/image/upload/v1786465121/id_en_1_kj5l89.jpg",
  es: "https://res.cloudinary.com/isaacdev/image/upload/v1786464995/id_es_1_a32eby.jpg",
};

/** Native pixel size of the credential art, used to hold its aspect ratio on the page. */
export const AGENT_CREDENTIAL_ASPECT = 450 / 716;

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
  /** Floor for the auto-fit in ./metrics.ts — long addresses step down to here before wrapping. */
  nameSizeMin: number;
  addressSizeMin: number;
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
    padY: 6,
    headerHeight: 29,
    accentHeight: 2,
    logoHeight: 19,
    eyebrowSize: 0,
    nameSize: 17,
    addressSize: 14,
    // Low floors so an unusually long name or street wraps at most once on this small label.
    nameSizeMin: 11,
    addressSizeMin: 9,
    footerSize: 7.5,
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
    nameSizeMin: 15,
    addressSizeMin: 12,
    footerSize: 9.5,
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
    nameSizeMin: 8,
    addressSizeMin: 7,
    footerSize: 0,
    lineGap: 1,
  },
};

/**
 * Type scale for the Priority Mail label.
 *
 * This label is not mailed on its own — it is printed, trimmed, and pasted into the white area of
 * a real USPS Label 228 tag, which already has "FROM:" and "TO:" printed on it. So this layout
 * prints neither word, and the type stays small enough that both blocks fit inside that white
 * area. The TO block is only a little larger than the FROM block (it's the delivery address, so it
 * should lead), never the poster-sized name the first version printed.
 */
export type ShippingTypeScale = {
  pad: number;
  logoHeight: number;
  /** Space between the FROM block and the logo sitting beside it. */
  logoGap: number;
  fromSize: number;
  fromSizeMin: number;
  toNameSize: number;
  toAddressSize: number;
  toSizeMin: number;
  /**
   * How far the TO block is inset from the left edge. Mirrors Label 228 itself, where the printed
   * "TO:" sits further right than "FROM:" — the inset is what lets the pasted block line up
   * beside the tag's own wording instead of covering it.
   */
  toIndent: number;
  toTopGap: number;
  lineGap: number;
};

export const SHIPPING_TYPE_SCALE: Record<"usps_4x6" | "usps_half_5126", ShippingTypeScale> = {
  usps_4x6: {
    pad: 18,
    logoHeight: 20,
    logoGap: 10,
    fromSize: 10,
    fromSizeMin: 8,
    toNameSize: 13,
    toAddressSize: 12,
    toSizeMin: 9.5,
    toIndent: 34,
    toTopGap: 32,
    lineGap: 3,
  },
  usps_half_5126: {
    pad: 30,
    logoHeight: 26,
    logoGap: 14,
    fromSize: 11.5,
    fromSizeMin: 9,
    toNameSize: 15,
    toAddressSize: 13.5,
    toSizeMin: 10.5,
    toIndent: 64,
    toTopGap: 44,
    lineGap: 4,
  },
};

export const EYEBROW_TEXT: Record<"en" | "es", string> = {
  en: "PREPARED FOR",
  es: "PREPARADO PARA",
};
