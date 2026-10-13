/**
 * Turns an illustration PDF into one plain-text block per page, with table rows rebuilt.
 *
 * Runs in the browser (the uploader) so the PDF itself never travels: Vercel caps request bodies
 * at 4.5 MB and an illustration with photos can pass that. Only this text goes to the server.
 *
 * Why not unpdf's `extractText`: a PDF's content stream is in drawing order, not reading order.
 * Americo's ledger draws every year/age/premium first and every value column after, so plain
 * extraction hands the model 30 years, then 90 numbers it has to re-align by counting. Grouping
 * the positioned text runs by baseline puts each ledger row back on one line, with ` | ` between
 * columns, which is how a person reads the table.
 *
 * `reconstructLines` is pure and takes plain objects, so tests exercise it without loading PDF.js.
 */

/** The subset of a PDF.js `TextItem` this module reads. */
export interface PdfTextItem {
  str: string;
  /** PDF.js text-space matrix [a, b, c, d, e, f]. */
  transform: number[];
  /** Advance width of the run, in the same units as the transform's translation. */
  width: number;
}

type Matrix = [number, number, number, number, number, number];

interface Run {
  text: string;
  /** Position along the text direction (x for upright text). */
  along: number;
  /** Position across the text direction (baseline y, growing downward). */
  across: number;
  length: number;
  size: number;
}

interface Line {
  across: number;
  size: number;
  runs: Run[];
}

/** Same composition PDF.js uses (`Util.transform`): apply `inner`, then `outer`. */
function multiply(outer: Matrix, inner: number[]): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

/**
 * Projects a run onto its own reading axes, so text set at 90° (a sideways ledger) groups into
 * lines the same way upright text does. Angles snap to the nearest quarter turn.
 */
function toRun(item: PdfTextItem, viewport: Matrix): Run | null {
  const text = item.str.replace(/\s+/g, " ");
  if (!text.trim()) return null;
  const m = multiply(viewport, item.transform);
  const size = Math.hypot(m[2], m[3]) || Math.hypot(m[0], m[1]) || 1;
  const angle = Math.round(Math.atan2(m[1], m[0]) / (Math.PI / 2)) * (Math.PI / 2);
  const cos = Math.round(Math.cos(angle));
  const sin = Math.round(Math.sin(angle));
  return {
    text,
    along: m[4] * cos + m[5] * sin,
    across: -m[4] * sin + m[5] * cos,
    length: Math.abs(item.width),
    size,
  };
}

/**
 * Same line when the baselines sit within ~45% of the SMALLER font size. Ledger rows 11–12 pt apart
 * at 8–9 pt type stay separate, and so does a big heading over small text. A raised superscript
 * (®, a footnote "2") usually lands on a line of its own — deliberately: joined, NLG's
 * "$47,223" + footnote "2" read as "$47,2232", a different number.
 */
function groupLines(runs: Run[]): Line[] {
  const sorted = [...runs].sort((a, b) => a.across - b.across || a.along - b.along);
  const lines: Line[] = [];
  for (const run of sorted) {
    const current = lines[lines.length - 1];
    const tolerance = 0.45 * Math.min(run.size, current?.size ?? run.size);
    if (current && Math.abs(run.across - current.across) <= tolerance) {
      current.runs.push(run);
      current.across = (current.across * (current.runs.length - 1) + run.across) / current.runs.length;
      current.size = Math.max(current.size, run.size);
    } else {
      lines.push({ across: run.across, size: run.size, runs: [run] });
    }
  }
  return lines;
}

/**
 * Some illustration software fakes bold by drawing the same string several times, nudged a fraction
 * of a point each time (Transamerica's 5-year rows). Joined naively that reads "5555 | 44444444".
 * A run that repeats an already-kept run's text at almost the same position is that overdraw.
 */
function dropOverdraw(ordered: Run[]): Run[] {
  const kept: Run[] = [];
  for (const run of ordered) {
    const isOverdraw = kept.some(
      (prev) => prev.text === run.text && Math.abs(prev.along - run.along) < 0.3 * run.size
    );
    if (!isOverdraw) kept.push(run);
  }
  return kept;
}

/**
 * Joins a line's runs left to right. A gap of ~zero means one token split across runs (PDF.js
 * often splits "$391,871" into "$" and "391,871"), so it joins with nothing: a space inside a
 * number would break the grounding check downstream. A gap of a word space joins with " "; a gap
 * wider than 1.5 em is a column break.
 */
function joinRuns(runs: Run[]): string {
  const ordered = dropOverdraw([...runs].sort((a, b) => a.along - b.along));
  let out = "";
  let prevEnd: number | null = null;
  for (const run of ordered) {
    if (prevEnd !== null) {
      const gap = run.along - prevEnd;
      if (gap >= 1.5 * run.size) out += " | ";
      else if (gap >= 0.12 * run.size && !out.endsWith(" ") && !run.text.startsWith(" ")) out += " ";
    }
    out += run.text;
    prevEnd = Math.max(prevEnd ?? -Infinity, run.along + run.length);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Rebuilds one page's text, top to bottom, one visual line per output line. */
export function reconstructLines(items: PdfTextItem[], viewportTransform: number[]): string {
  const viewport = viewportTransform as Matrix;
  const runs = items.map((item) => toRun(item, viewport)).filter((run): run is Run => run !== null);
  return groupLines(runs)
    .map((line) => joinRuns(line.runs))
    .filter(Boolean)
    .join("\n");
}

export class PdfTextError extends Error {}

/** Under this many letters/digits across the whole file, it's a scan with no text layer. */
const MIN_TEXT_CHARS = 200;

/**
 * Reads every page of a PDF into reconstructed text. PDF.js is loaded on demand (≈1.7 MB), so the
 * admin page doesn't pay for it until a file is dropped.
 */
export async function extractPdfPages(data: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  let doc: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // PDF.js takes ownership of (detaches) the buffer it is given, so it gets a copy: the caller's
    // bytes stay usable, e.g. for a retry.
    doc = await getDocumentProxy(data.slice());
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "PasswordException") {
      throw new PdfTextError("This PDF is password-protected. Save an unlocked copy and try again.");
    }
    console.warn("[illustration-studio] PDF.js could not open the file:", error);
    throw new PdfTextError("This file couldn't be read as a PDF.");
  }

  try {
    const pages: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      // Marked-content entries carry no text; everything with `str` is a positioned run.
      const items: PdfTextItem[] = [];
      for (const item of content.items) if ("str" in item) items.push(item);
      pages.push(reconstructLines(items, viewport.transform));
      page.cleanup();
    }
    const textChars = pages.join("").replace(/[^A-Za-z0-9]/g, "").length;
    if (textChars < MIN_TEXT_CHARS) {
      throw new PdfTextError(
        "This PDF has no readable text (it looks like a scan). Download the illustration from the carrier's quoting software instead."
      );
    }
    return pages;
  } finally {
    await doc.loadingTask.destroy();
  }
}
