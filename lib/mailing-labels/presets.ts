/**
 * Physical geometry for every supported label sheet, in PostScript points (72 pt = 1 inch)
 * because that is the unit @react-pdf/renderer lays out in. Getting these numbers exactly right
 * IS the feature: a label that is 2 pt off tiles wrong and every sticker on the sheet is ruined.
 *
 * Each sticker preset's arithmetic is spelled out in its comment — the columns must sum to the
 * page width and the rows to the page height, otherwise the grid drifts down the sheet.
 */

export const PT_PER_INCH = 72;
export const LETTER_WIDTH = 8.5 * PT_PER_INCH; // 612
export const LETTER_HEIGHT = 11 * PT_PER_INCH; // 792

export type LabelPresetKind = "sticker" | "shipping";

export type LabelPresetId =
  | "avery_5163"
  | "avery_5164"
  | "avery_5160"
  | "usps_4x6"
  | "usps_half_5126";

/** Which sticker body layout to draw — they differ by how much room there is. */
export type StickerVariant = "standard" | "folder" | "compact";

type BasePreset = {
  id: LabelPresetId;
  label: string;
  description: string;
  pageWidth: number;
  pageHeight: number;
  /** Labels per printed page. */
  perPage: number;
};

export type StickerPreset = BasePreset & {
  kind: "sticker";
  labelWidth: number;
  labelHeight: number;
  cols: number;
  rows: number;
  marginTop: number;
  marginLeft: number;
  gutterX: number;
  gutterY: number;
  variant: StickerVariant;
  /** False for the 1" sheet: a logo/footer is illegible at that size, so those flags are ignored. */
  supportsBranding: boolean;
};

export type ShippingPreset = BasePreset & {
  kind: "shipping";
  /** Height of one label area on the page (equals pageHeight when it's one per page). */
  labelHeight: number;
};

export type LabelPreset = StickerPreset | ShippingPreset;

export const LABEL_PRESETS: Record<LabelPresetId, LabelPreset> = {
  // 11.25 + 288 + 13.5 + 288 + 11.25 = 612 across · 36 + (5 × 144) + 36 = 792 down
  avery_5163: {
    id: "avery_5163",
    kind: "sticker",
    label: '4" × 2" — 10 per sheet',
    description: "Avery 5163 / 8163 shipping labels. The everyday choice.",
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    labelWidth: 4 * PT_PER_INCH,
    labelHeight: 2 * PT_PER_INCH,
    cols: 2,
    rows: 5,
    marginTop: 0.5 * PT_PER_INCH,
    marginLeft: 11.25,
    gutterX: 13.5,
    gutterY: 0,
    perPage: 10,
    variant: "standard",
    supportsBranding: true,
  },
  // 11.25 + 288 + 13.5 + 288 + 11.25 = 612 across · 36 + (3 × 240) + 36 = 792 down
  avery_5164: {
    id: "avery_5164",
    kind: "sticker",
    label: '4" × 3⅓" — 6 per sheet',
    description: "Avery 5164 / 8164. Biggest sticker; reads like a folder cover.",
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    labelWidth: 4 * PT_PER_INCH,
    labelHeight: (10 / 3) * PT_PER_INCH, // 240 pt = 3.333"
    cols: 2,
    rows: 3,
    marginTop: 0.5 * PT_PER_INCH,
    marginLeft: 11.25,
    gutterX: 13.5,
    gutterY: 0,
    perPage: 6,
    variant: "folder",
    supportsBranding: true,
  },
  // 13.5 + 189 + 9 + 189 + 9 + 189 + 13.5 = 612 across · 36 + (10 × 72) + 36 = 792 down
  avery_5160: {
    id: "avery_5160",
    kind: "sticker",
    label: '2⅝" × 1" — 30 per sheet',
    description: "Avery 5160 / 8160 address labels. Text only — no room for a logo.",
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    labelWidth: 2.625 * PT_PER_INCH, // 189
    labelHeight: 1 * PT_PER_INCH, // 72
    cols: 3,
    rows: 10,
    marginTop: 0.5 * PT_PER_INCH,
    marginLeft: 13.5,
    gutterX: 9,
    gutterY: 0,
    perPage: 30,
    variant: "compact",
    supportsBranding: false,
  },
  usps_4x6: {
    id: "usps_4x6",
    kind: "shipping",
    label: '4" × 6" — 1 per page',
    description: "Thermal label printers and 4×6 shipping sheets. The Priority Mail default.",
    pageWidth: 4 * PT_PER_INCH, // 288
    pageHeight: 6 * PT_PER_INCH, // 432
    labelHeight: 6 * PT_PER_INCH,
    perPage: 1,
  },
  usps_half_5126: {
    id: "usps_half_5126",
    kind: "shipping",
    label: '5½" × 8½" — 2 per sheet',
    description: "Avery 5126 half-sheet labels, or plain Letter paper you cut in half.",
    pageWidth: LETTER_WIDTH,
    pageHeight: LETTER_HEIGHT,
    labelHeight: LETTER_HEIGHT / 2, // 396
    perPage: 2,
  },
};

export const STICKER_PRESET_IDS = (
  Object.values(LABEL_PRESETS).filter((p) => p.kind === "sticker") as StickerPreset[]
).map((p) => p.id);

export const SHIPPING_PRESET_IDS = (
  Object.values(LABEL_PRESETS).filter((p) => p.kind === "shipping") as ShippingPreset[]
).map((p) => p.id);

export const DEFAULT_STICKER_PRESET: LabelPresetId = "avery_5163";
export const DEFAULT_SHIPPING_PRESET: LabelPresetId = "usps_4x6";

export function isLabelPresetId(value: unknown): value is LabelPresetId {
  return typeof value === "string" && value in LABEL_PRESETS;
}

export function getLabelPreset(id: LabelPresetId): LabelPreset {
  return LABEL_PRESETS[id];
}

/** Narrowing helpers so the renderers and UI can branch on kind without casting everywhere. */
export function isStickerPreset(preset: LabelPreset): preset is StickerPreset {
  return preset.kind === "sticker";
}

export function isShippingPreset(preset: LabelPreset): preset is ShippingPreset {
  return preset.kind === "shipping";
}

/**
 * Top-left corner of the Nth label position on a sticker sheet (0-indexed, row-major),
 * relative to the page. Shared by the PDF renderer and the on-screen preview so the two
 * layouts can never drift apart.
 */
export function stickerSlotOrigin(
  preset: StickerPreset,
  slot: number
): { x: number; y: number } {
  const col = slot % preset.cols;
  const row = Math.floor(slot / preset.cols);
  return {
    x: preset.marginLeft + col * (preset.labelWidth + preset.gutterX),
    y: preset.marginTop + row * (preset.labelHeight + preset.gutterY),
  };
}

/** Guard for the "start at position N" control: 0-indexed, must leave at least one slot. */
export function clampStartOffset(preset: LabelPreset, startOffset: number): number {
  if (!isStickerPreset(preset)) return 0;
  const n = Number.isFinite(startOffset) ? Math.floor(startOffset) : 0;
  return Math.min(Math.max(n, 0), preset.perPage - 1);
}
