/**
 * Text width estimation for Helvetica, so a label can size its own type to the space it has.
 *
 * Why this exists: addresses vary wildly in length. "125 WOODSTREAM BOULEVARD" set at the
 * preferred 17.5 pt is wider than a 4" label's text column, and @react-pdf's answer was to
 * hyphenate mid-word — the first printed sheet read "125 WOODSTREAM BOULE-VARD". Rather than
 * shrink every label to survive the worst case, each line is measured and the address is stepped
 * down only as far as that particular address needs.
 *
 * The widths below are Helvetica's real advance widths (units per 1000 em) for the characters that
 * actually show up in an uppercased US address. Anything unlisted falls back to a safe average.
 */

const HELVETICA_WIDTHS: Record<string, number> = {
  " ": 278, "!": 278, '"': 355, "#": 556, "$": 556, "%": 889, "&": 667, "'": 191,
  "(": 333, ")": 333, "*": 389, "+": 584, ",": 278, "-": 333, ".": 278, "/": 278,
  "0": 556, "1": 556, "2": 556, "3": 556, "4": 556, "5": 556, "6": 556, "7": 556,
  "8": 556, "9": 556, ":": 278, ";": 278, "<": 584, "=": 584, ">": 584, "?": 556,
  "@": 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  "[": 278, "\\": 278, "]": 278, "^": 469, _: 556, "`": 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  "{": 334, "|": 260, "}": 334, "~": 584,
  // Accented capitals keep their base width in Helvetica.
  Á: 667, É: 667, Í: 278, Ó: 778, Ú: 722, Ñ: 722, Ü: 722,
  á: 556, é: 556, í: 278, ó: 556, ú: 556, ñ: 556, ü: 556, "·": 333,
};

/** Bold Helvetica runs a little wider; this factor is close enough for layout decisions. */
const BOLD_FACTOR = 1.055;
const FALLBACK_WIDTH = 600;

export function estimateHelveticaWidth(
  text: string,
  fontSize: number,
  options: { bold?: boolean; letterSpacing?: number } = {}
): number {
  let units = 0;
  for (const char of text) units += HELVETICA_WIDTHS[char] ?? FALLBACK_WIDTH;
  const base = (units / 1000) * fontSize * (options.bold ? BOLD_FACTOR : 1);
  return base + (options.letterSpacing ?? 0) * Math.max(0, text.length - 1);
}

/**
 * Largest size at or below `preferred` that keeps every line inside `maxWidth`, stepping down in
 * half points and never going below `min`. Returns `min` when even that doesn't fit — the caller
 * accepts a wrap at that point, which is far better than a hyphen in the middle of a street name.
 */
export function fitFontSize(
  lines: string[],
  maxWidth: number,
  preferred: number,
  min: number,
  options: { bold?: boolean; letterSpacing?: number } = {}
): number {
  const measurable = lines.filter((l) => l.trim().length > 0);
  if (measurable.length === 0 || maxWidth <= 0) return preferred;

  for (let size = preferred; size >= min; size -= 0.5) {
    const fits = measurable.every(
      (line) => estimateHelveticaWidth(line, size, options) <= maxWidth
    );
    if (fits) return size;
  }
  return min;
}
