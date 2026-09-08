import OpenAI from "openai";
import { VISUAL_DIRECTOR_SYSTEM_PROMPT } from "./prompts";
import { FALLBACK_CONCEPTS } from "./video-generator";
import { timedWords, wordsInWindow } from "./aroll-words";
import {
  HOOK_HOLD_SEC,
  CTA_HOLD_SEC,
  MIN_CUTAWAY_SEC,
  MAX_CUTAWAY_SEC,
  MIN_GAP_SEC,
  MAX_COVERAGE,
} from "./aroll";
import type { ScribeWord } from "@/lib/call-study/types";
import type { SocialLocale } from "./types";

// ─── The cutaway director ─────────────────────────────────────────────────────────
// Isaac is already talking. This decides WHICH stretches of his delivery to cover with an
// illustrating shot, and what those shots are — one story, told in the gaps of his own.
//
// Presenter is the default state: any second not claimed by a beat below is his face, full
// frame. That inversion is what makes the whole thing safe — a director that returns nothing
// still yields a perfectly good captioned talking-head.

/** How far a boundary may move to land on a breath. */
const SNAP_WINDOW_SEC = 0.45;
/** A pause this long between words is a real gap, not just articulation. */
const MIN_SILENCE_SEC = 0.1;

export interface ArollBeat {
  startSec:     number;
  endSec:       number;
  narration:    string;   // the words he speaks under this cutaway — verbatim, re-sliced by us
  imageConcept: string;   // ALWAYS English; it prompts an image model
  onScreenText: string;   // in the SPOKEN language
  includesCast: boolean;  // false for detail shots (hands, keys, a windowsill) — no face to match
}

export interface ArollDirection {
  cast:     string;       // the recurring person, restated in every cast beat's concept
  world:    string;       // one home, one time of day, one palette
  hookText: string;
  ctaText:  string;
  beats:    ArollBeat[];
}

type TimedWord = { text: string; start: number; end: number };

const CUTAWAY_DIRECTOR_SYSTEM_PROMPT = [
  VISUAL_DIRECTOR_SYSTEM_PROMPT,
  "",
  "=== THIS JOB IS DIFFERENT IN ONE IMPORTANT WAY ===",
  "",
  "You are NOT choosing an image for every line. A real person — the agent himself — is on camera",
  "speaking these words, and the viewer can see him. Your shots are CUTAWAYS: they cover him for a",
  "few seconds to show what he is talking about, then the edit returns to his face.",
  "",
  "That changes three of the rules above:",
  "- The first shot does NOT have to be the hook. HE is the hook. Your first cutaway comes only",
  "  after he has spoken and the viewer has met him.",
  "- Faces are allowed in most of your shots. His face carries the ad; yours carry the story, and a",
  "  story about a family needs to show that family. Still mix in detail and establishing shots —",
  '  mark those "includesCast": false.',
  "- You choose WHEN to cut away. Cut on what he is describing, at the moment he describes it. Never",
  "  at a fixed interval — a cutaway that lands on the wrong sentence is worse than no cutaway.",
  "",
  "=== OUTPUT ===",
  "",
  "Return ONLY valid JSON:",
  "{",
  '  "cast":     "one sentence fixing the recurring person: age, build, hair, skin tone, clothing",',
  '  "world":    "one sentence fixing the home, the time of day and the colour palette",',
  '  "hookText": "a 3-7 word headline card shown over the opening seconds, in the SPOKEN language",',
  '  "ctaText":  "a 2-5 word closing call to action, in the SPOKEN language",',
  '  "beats": [',
  "    {",
  '      "startSec": 5.1,',
  '      "endSec": 9.4,',
  '      "imageConcept": "English, 1-2 sentences, this exact story beat",',
  '      "onScreenText": "Short Punchy Caption",',
  '      "includesCast": true',
  "    }",
  "  ]",
  "}",
  "",
  "Hard timing rules — a beat that breaks one is discarded, so respect them:",
  "- No beat may start before {{HOOK_HOLD}}s or end after {{CTA_START}}s.",
  "- Every beat is between {{MIN_LEN}}s and {{MAX_LEN}}s long.",
  "- Leave at least {{MIN_GAP}}s of him between consecutive beats.",
  "- Beats never overlap and are listed in time order.",
  "- Together they cover no more than {{MAX_COVERAGE}}% of the video.",
  "- Aim for about {{TARGET}} beats.",
  "",
  '"cast" and "world" are the bible for this ad: restate the cast\'s physical details inside every',
  'imageConcept where "includesCast" is true, and place every shot in that same world. Do not return',
  "the transcript, do not comment, and never describe the man on camera — you cannot see him.",
].join("\n");

function fillRules(prompt: string, durationSec: number, target: number): string {
  return prompt
    .replace("{{HOOK_HOLD}}", String(HOOK_HOLD_SEC))
    .replace("{{CTA_START}}", Math.max(0, durationSec - CTA_HOLD_SEC).toFixed(1))
    .replace("{{MIN_LEN}}", String(MIN_CUTAWAY_SEC))
    .replace("{{MAX_LEN}}", String(MAX_CUTAWAY_SEC))
    .replace("{{MIN_GAP}}", String(MIN_GAP_SEC))
    .replace("{{MAX_COVERAGE}}", String(Math.round(MAX_COVERAGE * 100)))
    .replace("{{TARGET}}", String(target));
}

function buildCutawayPrompt(opts: {
  segments:    { text: string; start: number; end: number }[];
  durationSec: number;
  language:    SocialLocale;
  category?:   string;
  title?:      string;
  brief?:      string;
  target:      number;
}): string {
  const langName = opts.language === "es" ? "Spanish (Español)" : "English";
  return [
    `He is speaking ${langName}, straight to camera, for ${opts.durationSec.toFixed(1)} seconds.`,
    opts.title ? `Ad topic: ${opts.title}` : "",
    opts.category
      ? `Product / line of business: ${opts.category} — the story's protagonist must be a believable real customer for THIS product.`
      : "",
    opts.brief ? `What he wants this ad to do: ${opts.brief}` : "",
    "",
    "THIS IS WHAT HE SAYS, with the second each line begins and ends:",
    opts.segments.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`).join("\n"),
    "",
    `Choose about ${opts.target} cutaways. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Roughly one cutaway per 8s of runtime, never fewer than 2 or more than 8. */
export function targetCutawayCount(durationSec: number): number {
  return Math.max(2, Math.min(8, Math.round(durationSec / 8)));
}

/**
 * Ask GPT to direct the cutaways.
 *
 * Never throws. A director that is down, rate-limited or returns nonsense degrades to evenly
 * spaced beats rather than failing the job — the same choice `directSceneVisuals` makes, and for
 * the same reason: the expensive, unrepeatable part (his performance) is already recorded.
 */
export async function directCutaways(opts: {
  words:       readonly ScribeWord[];
  segments:    { text: string; start: number; end: number }[];
  durationSec: number;
  language:    SocialLocale;
  category?:   string;
  title?:      string;
  brief?:      string;
}): Promise<{ direction: ArollDirection; notice?: string }> {
  const target = targetCutawayCount(opts.durationSec);
  const words = timedWords(opts.words);

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      messages: [
        { role: "system", content: fillRules(CUTAWAY_DIRECTOR_SYSTEM_PROMPT, opts.durationSec, target) },
        { role: "user", content: buildCutawayPrompt({ ...opts, target }) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
    });

    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Partial<ArollDirection>;
    const beats = planCutaways((raw.beats ?? []) as RawBeat[], words, opts.durationSec);

    if (!beats.length) {
      return {
        direction: { ...textsFrom(raw), beats: evenlySpacedBeats(opts.durationSec, words) },
        notice:
          "The story director didn't return any usable cutaways, so the beats are evenly spaced instead. Edit them below.",
      };
    }
    return { direction: { ...textsFrom(raw), beats } };
  } catch (err) {
    console.warn(`[aroll-director] falling back to evenly spaced beats: ${(err as Error).message}`);
    return {
      direction: { ...textsFrom({}), beats: evenlySpacedBeats(opts.durationSec, words) },
      notice: `The story director could not be reached (${(err as Error).message}), so the beats are evenly spaced instead.`,
    };
  }
}

function textsFrom(raw: Partial<ArollDirection>): Omit<ArollDirection, "beats"> {
  return {
    cast:     (raw.cast ?? "").trim(),
    world:    (raw.world ?? "").trim(),
    hookText: (raw.hookText ?? "").trim(),
    ctaText:  (raw.ctaText ?? "").trim(),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────────
// The model proposes; this disposes. Same division of labour as script-narration.ts: anything
// that can be computed is never left to the AI, because a plausible-looking wrong timestamp is
// far more expensive here than a missing one.

type RawBeat = Partial<ArollBeat> & Record<string, unknown>;

export function planCutaways(
  raw: RawBeat[],
  words: readonly TimedWord[],
  durationSec: number
): ArollBeat[] {
  const floor = HOOK_HOLD_SEC;
  const ceiling = Math.max(floor, durationSec - CTA_HOLD_SEC);
  if (ceiling - floor < MIN_CUTAWAY_SEC) return []; // too short to cut away from at all

  const candidates = (Array.isArray(raw) ? raw : [])
    // A model returning JSON can put a null or a bare string in an array it was told to fill
    // with objects. Dropping those here keeps every rule below able to assume a shape.
    .filter((b): b is RawBeat => Boolean(b) && typeof b === "object")
    .map((b, i) => ({
      startSec:     Number(b.startSec),
      endSec:       Number(b.endSec),
      imageConcept: String(b.imageConcept ?? "").trim() || FALLBACK_CONCEPTS[i % FALLBACK_CONCEPTS.length],
      onScreenText: String(b.onScreenText ?? "").trim(),
      includesCast: b.includesCast !== false,
      narration:    "",
    }))
    .filter((b) => Number.isFinite(b.startSec) && Number.isFinite(b.endSec) && b.endSec > b.startSec)
    .sort((a, b) => a.startSec - b.startSec);

  const kept: ArollBeat[] = [];
  let coverage = 0;

  for (const beat of candidates) {
    // Snap to a breath BEFORE clamping, so snapping can never push a beat back out of bounds.
    let start = snapToGap(beat.startSec, words);
    let end   = snapToGap(beat.endSec, words);

    // Never before the hook hold, never into the CTA, never behind the previous beat plus its gap.
    const previousEnd = kept.length ? kept[kept.length - 1].endSec : -Infinity;
    start = Math.max(start, floor, previousEnd + MIN_GAP_SEC);
    end   = Math.min(end, ceiling);

    if (end - start < MIN_CUTAWAY_SEC) {
      // Try to earn the minimum by extending forward. A beat that still cannot fit is dropped
      // rather than shortened into a flicker.
      end = Math.min(start + MIN_CUTAWAY_SEC, ceiling);
      if (end - start < MIN_CUTAWAY_SEC) continue;
    }
    if (end - start > MAX_CUTAWAY_SEC) end = start + MAX_CUTAWAY_SEC;

    if (coverage + (end - start) > durationSec * MAX_COVERAGE) continue;

    coverage += end - start;
    kept.push({
      ...beat,
      startSec: round2(start),
      endSec:   round2(end),
      // Re-sliced from the words actually inside the final window, so the quote shown in the
      // studio is what he really says under that shot — not what the model thought it was.
      narration: wordsInWindow(words, start, end),
    });
  }

  return kept;
}

/**
 * Move a cut to the nearest silence.
 *
 * A cut that lands mid-word is audible even though the audio never stops, because the picture
 * changes on a syllable. The gaps between words are where an editor would put it. This is purely
 * cosmetic — with one continuous audio track there is nothing to fall out of sync — so when there
 * is no gap nearby the original time is kept rather than forced somewhere worse.
 */
export function snapToGap(t: number, words: readonly TimedWord[]): number {
  let best = t;
  let bestDistance = SNAP_WINDOW_SEC;

  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].end;
    const gapEnd = words[i + 1].start;
    if (gapEnd - gapStart < MIN_SILENCE_SEC) continue;

    const middle = (gapStart + gapEnd) / 2;
    const distance = Math.abs(middle - t);
    if (distance < bestDistance) {
      best = middle;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Evenly spaced beats, for when the director is unavailable.
 *
 * Deliberately still honours every timing rule, so the fallback is a real edit rather than an
 * obviously broken one. The concepts come from the same library the faceless pipeline falls back
 * to — quiet, safe, people-free shots that sit under almost any script.
 */
export function evenlySpacedBeats(durationSec: number, words: readonly TimedWord[]): ArollBeat[] {
  const floor = HOOK_HOLD_SEC;
  const ceiling = Math.max(floor, durationSec - CTA_HOLD_SEC);
  const usable = ceiling - floor;
  if (usable < MIN_CUTAWAY_SEC) return [];

  const count = Math.max(
    1,
    Math.min(targetCutawayCount(durationSec), Math.floor(usable / (MIN_CUTAWAY_SEC + MIN_GAP_SEC)))
  );
  const slot = usable / count;
  const length = Math.min(MAX_CUTAWAY_SEC, Math.max(MIN_CUTAWAY_SEC, slot - MIN_GAP_SEC));

  const beats: ArollBeat[] = [];
  for (let i = 0; i < count; i++) {
    // Snapping moves a cut in either direction, so it can drag the first beat back over the
    // opening hold or a later one into the beat before it. Clamp AFTER snapping, never before.
    const previousEnd = beats.length ? beats[beats.length - 1].endSec : -Infinity;
    const start = Math.max(snapToGap(floor + i * slot, words), floor, previousEnd + MIN_GAP_SEC);
    const end = Math.min(start + length, ceiling);
    if (end - start < MIN_CUTAWAY_SEC) continue;
    beats.push({
      startSec:     round2(start),
      endSec:       round2(end),
      narration:    wordsInWindow(words, start, end),
      imageConcept: FALLBACK_CONCEPTS[i % FALLBACK_CONCEPTS.length],
      onScreenText: "",
      includesCast: false,
    });
  }
  return beats;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
