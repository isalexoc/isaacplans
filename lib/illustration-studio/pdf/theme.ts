/**
 * Page geometry and neutral colors for the two summary pages.
 *
 * Measured from NLG FlexLife's own pages 1–2 (which are A4) and refit to US Letter, the size every
 * other carrier's illustration uses. Units are PDF points (72 per inch).
 *
 * The react-pdf import is type-only, so the editor can read the layout limits from here without
 * pulling the renderer into the browser bundle.
 */

import type { Styles } from "@react-pdf/renderer";

/** @react-pdf doesn't re-export its style type at the top level under pnpm. */
export type Style = Styles[string];

/** Pre-fetched images (see ../pdf-render.ts). Null when a fetch failed: the pages still render. */
export interface SummaryAssets {
  coverPhoto: Buffer | null;
  /** Wide lockup for the offers-page footer. */
  logo: Buffer | null;
  /** The cover badge (the compact mark when the carrier has one). */
  coverLogo: Buffer | null;
}

export const PAGE = { width: 612, height: 792 } as const;

/** Name plus three lines fill the cover's 84 pt "Presented By" card; more would print past its border. */
export const MAX_PRESENTED_BY_LINES = 3;

/** Six living-benefit rows fill the "If I Become Ill" panel; a seventh would cross its bottom edge. */
export const MAX_BENEFIT_ROWS = 6;

export const FONT = "Helvetica";
export const FONT_BOLD = "Helvetica-Bold";

export const NEUTRAL = {
  ink: "#231F20",
  body: "#333333",
  muted: "#5B6673",
  hairline: "#D0D5DD",
  banner: "#E6E7E8",
  /** The slanted premium box: NLG prints it in mid-gray on every illustration. */
  premiumBox: "#7F7F7F",
  tableLabel: "#F0F1F2",
  white: "#FFFFFF",
} as const;

/** Every summary carries the same short legend NLG prints — it's part of the look, and true. */
export const COVER_DISCLAIMERS = [
  "This is a summary of the carrier's illustration, not an illustration in itself. An illustration is not intended to predict actual performance. Please refer to the policy and the complete illustration for details. In the event of any conflict, the policy shall control.",
  "This information is not intended as tax or legal advice. For advice concerning your own situation, please consult with your appropriate professional advisor.",
];

export const BANK_DISCLOSURE = [
  "No bank or credit union guarantee | Not a deposit | Not FDIC/NCUA insured | May lose value",
  "Not insured by any federal or state government agency",
];
