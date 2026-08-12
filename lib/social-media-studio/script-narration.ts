import type { SocialLocale } from "./types";

/**
 * THE SCRIPT IS THE VIDEO.
 *
 * This module turns the `fullScript` the user typed (or edited on the history page) into
 * (a) the exact words that will be spoken and (b) the scene segments that time the visuals.
 * It is deliberately 100% deterministic — no AI anywhere — because the whole point is that
 * nothing may invent, drop, translate away or reorder the user's words.
 *
 * The load-bearing invariant, relied on by the whole pipeline:
 *
 *     segmentNarration(spokenText, n).join(" ") === spokenText
 *
 * Only the FULL script feeds narration. `hookScript` is a duplicate of the script's opening
 * lines (see the script-generator prompt: "fullScript … Include all spoken words"), so
 * feeding it in as well is what used to make the hook get spoken twice.
 *
 * Cleaning removes ONLY things that are unambiguously production formatting — timestamps,
 * beat labels, bracketed stage directions, bullets, emoji, hashtags, URLs. Anything that
 * could plausibly be a spoken word is left alone.
 */

// ElevenLabs multilingual v2 at our default voice settings ≈ 2.5 spoken words/second.
export const WORDS_PER_SECOND = 2.5;

// A scene shorter than this reads as a flicker, so it bounds how many scenes a script gets.
export const MIN_SCENE_SECONDS = 1.5;

// Hard floor for how long one background may be on screen. Scene clips carry a fade
// transition, so anything much shorter never reaches full opacity.
const MIN_SCENE_DISPLAY_SECONDS = 1.0;

// Scene pacing target — one image roughly every 3 seconds of narration.
const SECONDS_PER_SCENE = 3;
const MIN_SCENES = 6;
const MAX_SCENES = 12;

// ─── Cleaning ───────────────────────────────────────────────────────────────────

// [0:00–0:03] / [00:00 - 00:05] / (0:15) timing marks.
const TIMESTAMP = /[[(]\s*\d{1,2}\s*[:：]\s*\d{2}\s*(?:[–—\-−~]\s*\d{1,2}\s*[:：]\s*\d{2}\s*)?[\])]/g;
// A bare "0:00–0:05" range opening a line (unambiguous on its own), and a single "0:05 —"
// that is followed by a separator. The separator is required for the single form so a real
// line like "8:30 in the morning she gets the call" keeps its words.
const BARE_TIMESTAMP_RANGE = /^[ \t]*\d{1,2}[:：]\d{2}\s*[–—\-−~]\s*\d{1,2}[:：]\d{2}\s*[-–—:.]?[ \t]*/gm;
const BARE_TIMESTAMP_SINGLE = /^[ \t]*\d{1,2}[:：]\d{2}\s*[-–—:][ \t]*/gm;
// Bracketed stage direction: [b-roll: hands on a mug], [pause], [text on screen].
const BRACKETED = /\[[^\]\n]*\]/g;
// Markdown emphasis / bullets / numbered list markers at a line start.
const LIST_MARKER = /^[ \t]*(?:[-*•·–—]|\d{1,2}[.)])[ \t]+/gm;
const EMPHASIS = /(\*{1,3}|_{1,3})(?=\S)([\s\S]*?\S)\1/g;
// Emoji + pictographs (TTS reads these as noise, and they are never "words" in a script).
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{200D}]/gu;
// #Hashtags (must start with a letter so "#1" survives as real text).
const HASHTAG = /(^|\s)#(?=\p{L})[\p{L}\p{N}_]+/gu;
const URL = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

/**
 * Parentheticals are stripped ONLY when they read as a stage direction. A blanket
 * `\([^)]*\)` strip would eat real spoken asides like "(as low as $0 a month)".
 *
 * This vocabulary is deliberately narrow — it holds only phrases that cannot plausibly be
 * part of a spoken sentence. Everyday words (point, shot, sound, wide, camera, music, nods)
 * were removed: they deleted genuine asides like "(that's the whole point)".
 */
const DIRECTION_WORDS =
  /\b(pause|pausa|beat\b|b-?roll|cut to|cutaway|corte a|on screen|onscreen|en pantalla|text overlay|lower third|voice ?over|v\.o\.|sfx|zoom in|zoom out|close-?up|to camera|off camera|chroma|green screen|music cue|smiling to camera)\b/i;
const PARENTHETICAL = /\(([^()\n]{0,120})\)/g;

/**
 * Line labels. Three kinds, all biased HARD toward keeping the user's words — deleting a
 * sentence the user typed is a worse failure than speaking a stray label.
 *
 *  - ALWAYS_DIRECTION: unmistakable production cues that are never sentence openers
 *    ("B-ROLL:", "SFX:") → the whole line is dropped, in any casing.
 *  - SHOUTED_DIRECTION: production cues that ARE ordinary English words ("MUSIC:",
 *    "VISUAL:") → the line is dropped ONLY when written in caps. A Title-case "Note:" or
 *    "Tip:" is ordinary prose and is left completely alone.
 *  - BEAT_LABELS / SPEAKER_LABELS: structural scaffolding ("HOOK:", "CTA:", "ISAAC:") →
 *    the label is removed, the words after it are kept and spoken.
 *
 * An UNKNOWN label is never touched, even in caps — "ACA:", "IMPORTANT:" and "PRO TIP:"
 * are the user's words and get spoken.
 */
const ALWAYS_DIRECTION = new Set([
  "broll", "b roll", "sfx", "vo tip", "voiceover tip", "voiceover tips",
  "on screen text", "onscreen text", "text overlay", "lower third", "texto en pantalla",
]);

const SHOUTED_DIRECTION = new Set([
  "visual", "visuals", "overlay", "graphic", "graphics", "music", "sound", "camera",
  "shot", "shots", "note", "notes", "tip", "tips", "caption", "captions", "delivery",
  "pace", "pacing", "hashtag", "hashtags", "edit", "editing", "transition",
  "imagen", "imagenes", "grafico", "graficos", "musica", "nota", "notas", "camara",
  "transicion", "sonido", "consejo",
]);

const BEAT_LABELS = new Set([
  "hook", "problem", "agitate", "agitation", "solution", "value", "insight", "teach",
  "proof", "credibility", "story", "cta", "call to action", "close", "closing", "intro",
  "outro", "opening", "ending", "end", "scene", "beat", "part", "section",
  "gancho", "problema", "solucion", "valor", "prueba", "credibilidad", "historia",
  "llamado", "llamada", "llamada a la accion", "cierre", "final", "escena", "parte",
  "seccion", "apertura",
]);

// Speaker cues that prefix a line of dialogue in a script.
const SPEAKER_LABELS = new Set([
  "isaac", "vo", "v o", "voiceover", "voice over", "narrator", "narracion", "narrador",
  "host", "presenter", "presentador", "locutor", "talent", "speaker",
]);

/** Normalize a candidate label for set lookup: lowercase, de-accent, drop digits/punctuation. */
function normalizeLabel(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when the raw label text is written in caps (SCENE 3, CTA, HOOK — but not "Note"). */
function looksLikeCapsLabel(raw: string): boolean {
  const letters = raw.replace(/[^\p{L}]/gu, "");
  return letters.length > 0 && letters === letters.toUpperCase();
}

/** Is this label a production cue whose entire line should be dropped? */
function isDirectionLabel(key: string, raw: string): boolean {
  if (ALWAYS_DIRECTION.has(key)) return true;
  return SHOUTED_DIRECTION.has(key) && looksLikeCapsLabel(raw);
}

/**
 * Strip a leading label from one line.
 * Returns `null` when the whole line is production direction and must be dropped.
 */
function stripLineLabel(line: string): string | null {
  // A bare label on its own line ("HOOK", "SCENE 2", "B-ROLL") with no colon — the script
  // generator's structure sometimes lands this way, and without this the TTS reads it out.
  // Requires a KNOWN label in caps, so a real one-word line like "Stop." is untouched.
  const bare = /^[ \t]*([\p{L}][\p{L}\p{N} /&'’-]{0,28})[ \t]*$/u.exec(line);
  if (bare) {
    const bareKey = normalizeLabel(bare[1]);
    const knownBare = ALWAYS_DIRECTION.has(bareKey) || SHOUTED_DIRECTION.has(bareKey) || BEAT_LABELS.has(bareKey);
    if (bareKey && knownBare && looksLikeCapsLabel(bare[1])) return null;
  }

  // "HOOK (0:00–0:03): words" → capture "HOOK", optional "(…)", then ":".
  const m = /^[ \t]*([\p{L}][\p{L}\p{N} /&'’-]{0,28}?)[ \t]*(?:\([^)\n]*\))?[ \t]*[:：][ \t]*/u.exec(line);
  if (!m) return line;

  const raw = m[1];
  const key = normalizeLabel(raw);
  if (!key) return line;

  if (isDirectionLabel(key, raw)) return null;                 // whole line is direction
  if (BEAT_LABELS.has(key) || SPEAKER_LABELS.has(key)) {
    return line.slice(m[0].length);                            // keep the words after the label
  }
  // Unknown label — ordinary prose with a colon ("Here's the thing:", "ACA:", "IMPORTANT:").
  // Never removed: those are the user's words.
  return line;
}

/** Remove parentheticals that read as stage direction; keep genuine spoken asides. */
function stripDirectionParentheticals(text: string): string {
  return text.replace(PARENTHETICAL, (whole, inner: string) => {
    const body = inner.trim();
    if (!body) return "";
    // A direction is short and contains a direction verb/noun, or is a lone lowercase cue.
    const wordCount = body.split(/\s+/).length;
    if (wordCount <= 6 && DIRECTION_WORDS.test(body)) return "";
    return whole;
  });
}

/**
 * Clean a raw `fullScript` down to exactly the words that should be spoken.
 * Every removal here is production formatting, never content.
 */
export function cleanScriptForNarration(fullScript: string): string {
  if (!fullScript) return "";

  let text = fullScript.replace(/\r\n?/g, "\n");

  text = text.replace(TIMESTAMP, " ");
  text = text.replace(BARE_TIMESTAMP_RANGE, "");
  text = text.replace(BARE_TIMESTAMP_SINGLE, "");
  text = text.replace(BRACKETED, " ");
  text = text.replace(LIST_MARKER, "");
  text = text.replace(EMPHASIS, "$2");
  text = stripDirectionParentheticals(text);
  text = text.replace(URL, " ");
  text = text.replace(HASHTAG, "$1");
  text = text.replace(EMOJI, "");

  const lines = text
    .split("\n")
    .map(stripLineLabel)
    .filter((l): l is string => l !== null)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  return lines
    .join(" ")
    .replace(/\s+([,.;:!?…])/g, "$1")   // no space before punctuation
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s"'“”‘’\-–—]+/, "")
    .trim();
}

// ─── Measurement ────────────────────────────────────────────────────────────────

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function estimateSpokenSeconds(text: string): number {
  return countWords(text) / WORDS_PER_SECOND;
}

/** What the video will actually say, plus how long that takes. */
export interface NarrationPlan {
  spokenText:       string;
  wordCount:        number;
  estimatedSeconds: number;
}

export function planNarration(fullScript: string): NarrationPlan {
  const spokenText = cleanScriptForNarration(fullScript);
  const wordCount = countWords(spokenText);
  return { spokenText, wordCount, estimatedSeconds: wordCount / WORDS_PER_SECOND };
}

/**
 * How many scenes (= images) a script of this length should get: one image roughly every
 * 3 seconds, never so many that a scene would flash by in under MIN_SCENE_SECONDS.
 */
export function recommendedSceneCount(estimatedSeconds: number): number {
  const byPacing = Math.round(estimatedSeconds / SECONDS_PER_SCENE);
  const byFloor = Math.floor(estimatedSeconds / MIN_SCENE_SECONDS);
  return Math.max(1, Math.min(MAX_SCENES, Math.max(MIN_SCENES, byPacing), Math.max(1, byFloor)));
}

// ─── Segmentation ───────────────────────────────────────────────────────────────

/**
 * Split into sentences. A break needs a terminator, whitespace, and a next character that
 * opens a sentence (capital, digit, quote or Spanish opener) — so "$1,200. Then" splits
 * while "3.5%" and "Dr. Ruiz" do not. Written as a scan rather than a lookbehind regex so
 * the invariant (`join(" ")` restores the input) is easy to see, and so it stays safe in
 * the client bundle.
 */
const TERMINATORS = ".!?…";
const CLOSERS = "\"'”’)]";
const OPENERS = "¿¡\"'“‘(";

// Titles/abbreviations whose trailing period does NOT end a sentence.
const ABBREVIATIONS = new Set([
  "dr", "mr", "mrs", "ms", "jr", "sr", "st", "vs", "etc", "inc", "ltd", "co", "no",
  "sra", "srta", "ud", "uds", "ej", "aprox", "num", "ave", "dept", "est", "approx",
]);

/** The word immediately before this period, lowercased and stripped of punctuation. */
function tokenBefore(text: string, periodIdx: number): string {
  let s = periodIdx - 1;
  while (s >= 0 && /[\p{L}\p{N}]/u.test(text[s])) s--;
  return text.slice(s + 1, periodIdx).toLowerCase();
}

function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    if (!TERMINATORS.includes(text[i])) continue;

    // "Dr. Ruiz", "U.S. Department", "Inc. plans" — the period is part of the word.
    if (text[i] === ".") {
      const tok = tokenBefore(text, i);
      if (ABBREVIATIONS.has(tok) || tok.length === 1) continue;
    }

    // Absorb a run of trailing terminators and closing quotes/brackets ("…!"  → one break).
    let end = i;
    while (end + 1 < text.length && (TERMINATORS + CLOSERS).includes(text[end + 1])) end++;

    let k = end + 1;
    if (k >= text.length) break;
    if (!/\s/.test(text[k])) continue;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (k >= text.length) break;
    if (!OPENERS.includes(text[k]) && !/[\p{Lu}\p{N}]/u.test(text[k])) continue;

    const piece = text.slice(start, end + 1).trim();
    if (piece) out.push(piece);
    start = k;
    i = k - 1;
  }

  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out;
}

/**
 * Split one unit at the clause boundary nearest its middle. Punctuation stays with the
 * left half so re-joining with a single space reproduces the original exactly.
 */
function splitAtClause(unit: string): [string, string] | null {
  const matches: number[] = [];
  const re = /[,;:](?=\s)|\s[–—-](?=\s)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(unit)) !== null) matches.push(m.index + m[0].length);
  if (matches.length === 0) return null;

  const mid = unit.length / 2;
  const cut = matches.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), matches[0]);
  const left = unit.slice(0, cut).trim();
  const right = unit.slice(cut).trim();
  if (!left || !right) return null;
  return [left, right];
}

/**
 * Split one unit at the word boundary nearest its middle. Used only when a unit has no
 * clause punctuation at all — long unpunctuated sentences are common in typed scripts, and
 * without this the scene count would stall well under target. Splitting mid-sentence is
 * safe: segments are re-joined into a single TTS call, so boundaries move images, not audio.
 */
function splitAtWord(unit: string, minWords = 4): [string, string] | null {
  const words = unit.split(/\s+/).filter(Boolean);
  if (words.length < minWords) return null;
  const at = Math.round(words.length / 2);
  const left = words.slice(0, at).join(" ");
  const right = words.slice(at).join(" ");
  if (!left || !right) return null;
  return [left, right];
}

/**
 * Grow the unit list toward `target` by repeatedly splitting the longest unit. Every split
 * preserves order and every word, so the join invariant is unaffected.
 *
 * Clause splits run all the way to `target`; WORD splits only run until `wordSplitFloor`,
 * because they cut mid-sentence. That is harmless on the default Shotstack path (segments
 * are re-joined into a single TTS call, so boundaries move images, not audio) but the legacy
 * JSON2Video renderer speaks each segment as its OWN voice element, where a mid-sentence cut
 * would be audible. So we only break a sentence when the alternative is too few scenes.
 */
function expandUnits(units: string[], target: number, wordSplitFloor: number): string[] {
  const out = [...units];

  const grow = (limit: number, allowWordSplit: boolean) => {
    while (out.length < limit) {
      let bestIdx = -1;
      let bestWords = 0;
      let bestParts: [string, string] | null = null;

      for (let i = 0; i < out.length; i++) {
        const w = countWords(out[i]);
        if (w <= bestWords) continue;
        const parts = splitAtClause(out[i]) ?? (allowWordSplit ? splitAtWord(out[i]) : null);
        if (!parts) continue;
        bestWords = w;
        bestIdx = i;
        bestParts = parts;
      }

      if (bestIdx === -1 || !bestParts) break;       // nothing left that can be split
      out.splice(bestIdx, 1, bestParts[0], bestParts[1]);
    }
  };

  grow(target, false);                                // punctuation-respecting splits first
  grow(Math.min(target, wordSplitFloor), true);       // then, only if still too few, mid-sentence
  return out;
}

/**
 * Group units into exactly `count` word-balanced, in-order segments.
 * Every unit lands in exactly one segment — nothing is dropped or duplicated.
 */
function groupUnits(units: string[], count: number): string[] {
  if (units.length <= count) return units;

  const weights = units.map(countWords);
  const total = weights.reduce((a, b) => a + b, 0) || units.length;

  const segments: string[] = [];
  let bucket: string[] = [];
  let acc = 0;

  for (let i = 0; i < units.length; i++) {
    bucket.push(units[i]);
    acc += weights[i] || 1;

    const closed = segments.length;
    const unitsLeft = units.length - 1 - i;
    const bucketsLeft = count - closed - 1;

    // Close early when this bucket already covers its proportional share of the words…
    const wantClose =
      bucketsLeft > 0 && unitsLeft > bucketsLeft && acc >= (total * (closed + 1)) / count;
    // …and close unconditionally once only one unit is left per remaining bucket, otherwise
    // a script that back-loads its words (short openers, one long closer) would never reach
    // its share in time and would collapse into a single segment.
    const mustClose = bucketsLeft > 0 && unitsLeft <= bucketsLeft;

    if (wantClose || mustClose) {
      segments.push(bucket.join(" "));
      bucket = [];
    }
  }
  if (bucket.length) segments.push(bucket.join(" "));
  return segments;
}

/**
 * Split already-cleaned narration into `count` scene segments, verbatim and in order.
 * Guarantees `segmentNarration(t, n).join(" ") === t`.
 *
 * `allowMidSentence` controls how hard we try to reach `count` when the script has few
 * sentence/clause boundaries. It is safe (and gives better visual pacing) whenever the
 * renderer speaks the segments as ONE joined TTS call — true for Shotstack, false for the
 * legacy JSON2Video path, which speaks each segment separately.
 */
export function segmentNarration(
  spokenText: string,
  count: number,
  opts?: { allowMidSentence?: boolean },
): string[] {
  const text = spokenText.trim();
  if (!text) return [];
  const target = Math.max(1, count);

  let units = splitSentences(text);
  if (units.length === 0) units = [text];
  if (units.length < target) {
    units = expandUnits(units, target, opts?.allowMidSentence ? target : MIN_SCENES);
  }

  return groupUnits(units, Math.min(target, units.length));
}

/** One-shot: raw script → the exact spoken segments + the plan they came from. */
export function buildNarrationSegments(
  fullScript: string,
  sceneCount?: number,
  opts?: { allowMidSentence?: boolean },
): { segments: string[]; plan: NarrationPlan } {
  const plan = planNarration(fullScript);
  const count = sceneCount ?? recommendedSceneCount(plan.estimatedSeconds);
  return { segments: segmentNarration(plan.spokenText, count, opts), plan };
}

// ─── Language detection ─────────────────────────────────────────────────────────

// Markers deliberately exclude tokens the two languages SHARE as ordinary words — "no",
// "son", "la", "el", "si", "un", "hay", "mes" all appear in English text and used to push a
// punchy English script over the line into "Spanish".
const ES_MARKERS =
  /\b(que|de|los|las|una|para|con|por|pero|más|está|están|tus|sus|del|al|se|te|lo|como|cuando|puedes|tienes|tiene|nadie|porque|esto|esta|eso|muy|ya|aquí|ahora|familia|salud|cobertura|beneficios|protección|dinero|año|años|gastos|ahorra|calificas|califica)\b/gi;
const EN_MARKERS =
  /\b(the|and|you|your|is|are|to|of|for|with|that|this|but|not|it|have|has|can|will|what|when|they|their|from|about|a|in|on|we|i|me|my|now|at|one|all|so|just|get|got|know|don't|it's|you're|here|there|because|most|every|family|health|coverage|benefits|month|year|years)\b/gi;
const ES_DIACRITICS = /[áéíóúñ¿¡]/gi;

/**
 * Which language the script is actually written in. Used to decide whether the selected
 * voiceover language needs a faithful translation, or whether the script can be spoken
 * exactly as typed (the overwhelmingly common case).
 *
 * Biased HARD toward `fallback` (the selected voiceover language): a false positive here
 * routes the user's script through the GPT translator, which is precisely the "something
 * rewrote my script" failure this whole change exists to eliminate. A different language is
 * only reported when the evidence is decisive.
 */
export function detectScriptLocale(text: string, fallback: SocialLocale = "en"): SocialLocale {
  if (!text.trim()) return fallback;

  const es = (text.match(ES_MARKERS)?.length ?? 0) + (text.match(ES_DIACRITICS)?.length ?? 0) * 2;
  const en = text.match(EN_MARKERS)?.length ?? 0;

  const winner: SocialLocale = es > en ? "es" : "en";
  if (winner === fallback) return fallback;

  // Overturning the expected language needs real evidence, not a one-marker edge: a decisive
  // margin over the other language AND enough absolute signal to trust the sample.
  const high = Math.max(es, en);
  const low = Math.min(es, en);
  const decisive = high >= 5 && low <= high * 0.5;
  return decisive ? winner : fallback;
}

// ─── Scene timing ───────────────────────────────────────────────────────────────

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Distribute `totalSec` of audio across scenes, weighted by each scene's word count.
 *
 * The returned lengths sum to EXACTLY `totalSec` — the old version rounded each scene to a
 * whole second and clamped with `Math.max(1, …)`, which could total more than the audio and
 * leave the video running after the voice had stopped. Boundaries are computed on a
 * cumulative fraction so rounding cannot accumulate, and the final boundary IS `totalSec`.
 */
export function distributeSceneDurations(weights: number[], totalSec: number): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (n === 1) return [round3(totalSec)];

  // Raise only the scenes that would flash by, by lifting their WEIGHT to the minimum share
  // and letting the rest stay proportional. Lifting a weight raises the total, so iterate to a
  // fixed point; the floor share is capped at 1/n, which guarantees convergence (and degrades
  // to an even split only in the impossible case where every scene is under the minimum).
  //
  // A previous version bailed to an even split for the WHOLE video the moment any single
  // scene fell under the floor. One short line like "Stop." was enough to throw away
  // word-weighted timing everywhere and drift the images seconds out of step with the words.
  const minShare = Math.min(1 / n, MIN_SCENE_DISPLAY_SECONDS / totalSec);
  let w = weights.map((x) => Math.max(1, x));

  for (let pass = 0; pass < 12; pass++) {
    const sum = w.reduce((a, b) => a + b, 0);
    const floor = minShare * sum;
    let changed = false;
    w = w.map((x) => {
      if (x < floor - 1e-9) { changed = true; return floor; }
      return x;
    });
    if (!changed) break;
  }

  // Cumulative fractional boundaries → the lengths sum to EXACTLY totalSec, with no
  // accumulating rounding error, and the last boundary IS totalSec.
  const total = w.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let prevEnd = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += w[i];
    const end = i === n - 1 ? totalSec : round3((totalSec * acc) / total);
    out.push(round3(end - prevEnd));
    prevEnd = end;
  }
  return out;
}
