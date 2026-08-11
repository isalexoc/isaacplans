/**
 * Accent-color math for partner landing pages.
 *
 * A partner picks one brand hex and we tint the whole page with it. That works on a white
 * background and falls apart on a dark one: Sin Fronteras' #1D4E89 is a dark navy, so small
 * accent-colored text (the hero badge, the uppercase section labels) sits at roughly 1.5:1
 * against a slate-950 page and is effectively invisible.
 *
 * So we derive a per-background variant instead of using the raw hex everywhere: lighten toward
 * white until the text clears WCAG AA (4.5:1), and leave it alone when it already passes. A
 * partner whose brand color is already light gets the reverse treatment on white.
 */

/** Page background we compose against in each mode — Tailwind slate-950 and white. */
export const DARK_PAGE_BG = "#020617";
export const LIGHT_PAGE_BG = "#ffffff";

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validate a hex string before it reaches a `<style>` block.
 * `accentColor` is free text in the admin form, and it gets interpolated into CSS — without this,
 * a malformed value breaks the stylesheet and a hostile one could inject rules.
 */
export function safeHex(value: string, fallback = "#0077B6"): string {
  const trimmed = value.trim();
  return HEX_RE.test(trimmed) ? trimmed : fallback;
}

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb {
  let h = safeHex(hex).slice(1);
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(h, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function toHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** WCAG relative luminance. */
function luminance(rgb: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two colors, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseHex(a));
  const lb = luminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mix a color toward white (`amount` 0..1). */
function lighten(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex({
    r: r + (255 - r) * amount,
    g: g + (255 - g) * amount,
    b: b + (255 - b) * amount,
  });
}

/** Mix a color toward black (`amount` 0..1). */
function darken(hex: string, amount: number): string {
  const { r, g, b } = parseHex(hex);
  return toHex({ r: r * (1 - amount), g: g * (1 - amount), b: b * (1 - amount) });
}

/**
 * The accent adjusted until it is readable as TEXT on `background`.
 *
 * Steps toward white on a dark background and toward black on a light one, 5% at a time, and
 * stops as soon as it clears `minRatio`. Returns the original when it already passes, so a
 * partner whose brand already contrasts well keeps their exact color.
 */
export function readableAccent(
  accent: string,
  background: string,
  minRatio = 4.5
): string {
  const base = safeHex(accent);
  if (contrastRatio(base, background) >= minRatio) return base;

  const backgroundIsDark = luminance(parseHex(background)) < 0.5;
  let candidate = base;
  for (let step = 1; step <= 20; step += 1) {
    candidate = backgroundIsDark ? lighten(base, step * 0.05) : darken(base, step * 0.05);
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  // Nothing hit the target (only possible for a mid-grey against a mid-grey): take the extreme.
  return backgroundIsDark ? "#ffffff" : "#000000";
}

export type PartnerAccentTheme = {
  /** The partner's real brand hex — solid fills where we also control the text color. */
  base: string;
  /** Readable as text on white. */
  textOnLight: string;
  /** Readable as text on a slate-950 page. */
  textOnDark: string;
};

export function buildAccentTheme(accent: string): PartnerAccentTheme {
  const base = safeHex(accent);
  return {
    base,
    textOnLight: readableAccent(base, LIGHT_PAGE_BG),
    textOnDark: readableAccent(base, DARK_PAGE_BG),
  };
}
