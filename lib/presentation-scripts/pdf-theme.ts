/**
 * Visual tokens for the printed sales script, in points — the same split as
 * lib/mailing-labels/theme.ts, so the PDF's look lives in one file instead of being scattered
 * through the renderer.
 *
 * The palette is the on-screen one from components/presentation-scripts/script-portable-text.tsx
 * flattened onto white: @react-pdf can render rgba(), but a translucent fill over a white page
 * prints unpredictably on office lasers, so every value here is an opaque hex. The three
 * highlighter colours are lifted verbatim from the Studio decorators in
 * sanity/schemaTypes/scriptPortableText.tsx, which is what Isaac sees while writing.
 */

export const BRAND = "#0077B6";
export const ACCENT = "#00B4D8";

export const PDF_COLOR = {
  ink: "#0F172A",
  body: "#1E293B",
  muted: "#64748B",
  hairline: "#E2E8F0",
  page: "#FFFFFF",
  link: "#1D4ED8",
} as const;

/** Letter, portrait. Margins are wide enough to hole-punch and land in a binder. */
export const PAGE = {
  width: 612,
  height: 792,
  marginX: 54,
  /** Leaves room under the fixed running header. */
  marginTop: 64,
  marginBottom: 52,
  headerTop: 26,
  footerBottom: 24,
} as const;

export const CONTENT_WIDTH = PAGE.width - PAGE.marginX * 2;

/**
 * Type scale. Body is 11.5 pt on 1.5 leading — larger than a business document, because this page
 * is read out loud, at a glance, while someone is on the line.
 */
export const TYPE = {
  body: 11.5,
  bodyLeading: 1.5,
  verbatim: 11.5,
  askPause: 13,
  agentNote: 10,
  quote: 11,
  pill: 7,
  h1: 19,
  h2: 14.5,
  h3: 12.5,
  h4: 11.5,
  small: 9,
  micro: 8,
  masthead: 26,
} as const;

export type CalloutTone = "verbatim" | "askPause" | "agentNote" | "clientSays" | "blockquote";

export type CalloutStyle = {
  bg: string | undefined;
  border: string;
  /** All four sides (askPause) instead of a left rule. */
  boxed: boolean;
  dashed: boolean;
  pill: string | undefined;
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

export const CALLOUT: Record<CalloutTone, CalloutStyle> = {
  // Read exactly as written — compliance and disclosure wording.
  verbatim: {
    bg: "#EDF6FB",
    border: BRAND,
    boxed: false,
    dashed: false,
    pill: BRAND,
    text: PDF_COLOR.ink,
    fontSize: TYPE.verbatim,
    bold: false,
    italic: false,
  },
  // The question you ask before going silent — the loudest thing on the page.
  askPause: {
    bg: "#E7F8FD",
    border: ACCENT,
    boxed: true,
    dashed: true,
    pill: "#0E7490",
    text: PDF_COLOR.ink,
    fontSize: TYPE.askPause,
    bold: true,
    italic: false,
  },
  // Never spoken. Deliberately the quietest thing on the page so the eye skips it mid-call.
  agentNote: {
    bg: "#F1F5F9",
    border: "#94A3B8",
    boxed: false,
    dashed: false,
    pill: "#64748B",
    text: "#475569",
    fontSize: TYPE.agentNote,
    bold: false,
    italic: true,
  },
  // An objection in the client's own words.
  clientSays: {
    bg: "#FFF1F2",
    border: "#FB7185",
    boxed: false,
    dashed: false,
    pill: "#E11D48",
    text: "#4C0519",
    fontSize: TYPE.body,
    bold: false,
    italic: false,
  },
  // The built-in quote style, left neutral: the only blockquote in live content is an agent stage
  // direction, so giving it the "Client says" treatment would attribute it to the client.
  blockquote: {
    bg: undefined,
    border: "#CBD5E1",
    boxed: false,
    dashed: false,
    pill: undefined,
    text: PDF_COLOR.muted,
    fontSize: TYPE.quote,
    bold: false,
    italic: true,
  },
};

/** Same wording as the on-screen pills. Kept in sync with `pillLabels` in script-portable-text.tsx. */
export const CALLOUT_PILL: Record<
  Exclude<CalloutTone, "blockquote">,
  { en: string; es: string }
> = {
  verbatim: { en: "WORD FOR WORD", es: "PALABRA POR PALABRA" },
  askPause: { en: "ASK — THEN STOP", es: "PREGUNTA — LUEGO CALLA" },
  agentNote: { en: "DON'T READ", es: "NO LEER" },
  clientSays: { en: "CLIENT SAYS", es: "EL CLIENTE DICE" },
};

/** Inline highlighters. Background + text colour only — see the note in ./pdf-blocks.tsx. */
export const MARK_HIGHLIGHT: Record<string, { bg: string; color: string }> = {
  highlight: { bg: "#FDE68A", color: "#422006" },
  highlightGood: { bg: "#BBF7D0", color: "#052E16" },
  highlightCareful: { bg: "#FECACA", color: "#450A0A" },
};

/** Fill-in-the-blank placeholder: client name, state, premium. */
export const MARK_FILL = { bg: "#DCEEF8", color: BRAND } as const;

export const UNDERLINE_COLOR = "#4DA3CE";

/** The blue tips panel under each section, mirroring the on-screen blue-50 / blue-200 box. */
export const TIPS = { bg: "#EFF6FF", border: "#BFDBFE", pill: "#1D4ED8" } as const;

/** Objection appendix cards. */
export const OBJECTION_CARD = { bg: "#FFFFFF", border: "#E2E8F0", quote: PDF_COLOR.ink } as const;

/** Indent per nesting level for bullet and numbered lists. */
export const LIST_INDENT = 15;
export const LIST_MARKER_WIDTH = 15;

/** Widest an inline script image is drawn, in points (the screen caps the same art at 500 px). */
export const IMAGE_MAX_WIDTH = 380;
export const IMAGE_MAX_HEIGHT = 420;
/** Pixel width requested from the Sanity CDN — ~2.9x the printed size, so ~210 DPI. */
export const IMAGE_PIXEL_WIDTH = 1100;
