import OpenAI from "openai";
import { createHash } from "crypto";
import cloudinary from "@/config/cloudinary";
import { getDemographicHint, pickVariationMood } from "./image-generator";
import { musicUrlForCategory } from "./video-music";
import { generateCategoryMusic } from "./music-generator";
import { registerImageAsset } from "./video-asset-library";
import { HEYGEN_CHROMA_COLOR } from "./heygen-presenter";
import { synthesizeNarration } from "./voiceover";
import {
  planNarration,
  segmentNarration,
  recommendedSceneCount,
  detectScriptLocale,
  distributeSceneDurations,
  countWords,
} from "./script-narration";
import { shotstackProvider } from "./render/shotstack";
import type { RenderPlan, RenderPlanScene, RenderPlanPresenter } from "./render/types";
import type {
  SocialPostSource,
  VideoScript,
  VideoScene,
  VideoStoryboard,
  VideoImage,
  VideoRenderStatus,
  SocialLocale,
} from "./types";

// Render engine selection. Default "shotstack" (pay-as-you-go, decoupled TTS+captions);
// set VIDEO_RENDER_PROVIDER=json2video to fall back to the legacy bundled renderer.
function renderProvider(): "shotstack" | "json2video" {
  return (process.env.VIDEO_RENDER_PROVIDER || "shotstack").toLowerCase() === "json2video"
    ? "json2video"
    : "shotstack";
}

// ─── Config ─────────────────────────────────────────────────────────────────────
// JSON2Video assembles the Short (images + Ken Burns motion + ElevenLabs voiceover +
// karaoke subtitles). Voiceover uses ElevenLabs; supply your own ElevenLabs key via a
// JSON2Video "connection" (JSON2VIDEO_ELEVENLABS_CONNECTION) to bill it pay-per-use on
// your own account. Without a connection, JSON2Video bills ElevenLabs via its credits.

const JSON2VIDEO_BASE = "https://api.json2video.com/v2/movies";

// Default ElevenLabs voices. IMPORTANT: JSON2Video's managed ElevenLabs (no connection)
// requires a voice NAME (e.g. "Rachel"), NOT a raw voice id. Raw ids only work when you
// supply your own ElevenLabs key via JSON2VIDEO_ELEVENLABS_CONNECTION. The multilingual
// model speaks Spanish in any voice, so the same name works for EN and ES text.
const DEFAULT_VOICE_EN = "Rachel";
const DEFAULT_VOICE_ES = "Rachel";

function elevenLabsVoiceFor(locale: SocialLocale): string {
  return locale === "es"
    ? process.env.ELEVENLABS_VOICE_ID_ES || DEFAULT_VOICE_ES
    : process.env.ELEVENLABS_VOICE_ID_EN || DEFAULT_VOICE_EN;
}

// ─── Step 1: Storyboard ──────────────────────────────────────────────────────────
//
// THE SCRIPT IS THE ONLY SOURCE OF TRUTH FOR WHAT IS SPOKEN.
//
// Narration is derived from `videoScript.fullScript` by the deterministic segmenter in
// script-narration.ts — word for word, in order, nothing added and nothing dropped. GPT is
// no longer allowed anywhere near the words; it only chooses the IMAGE for each segment.
//
// (This module used to hand the script to a GPT "video director" that WROTE the narration.
// It paraphrased, and — fed the hook separately plus the on-screen-text ideas, and told to
// hit a fixed scene count for a target duration — it reliably tacked an extra closing beat
// onto the end of the video that was never in the script. That is why the rendered Short
// said things the script did not.)

const VISUAL_DIRECTOR_SYSTEM_PROMPT = `You are a short-form video director for an insurance brand. You are given the FINAL, LOCKED narration of a vertical (9:16) Short, already split into numbered segments. Your ONLY job is to choose the image for each segment.

THE NARRATION IS NOT YOURS TO TOUCH. Do not write, rewrite, translate, shorten, extend, merge, split, reorder or comment on it. Do not return it. You return one visual per segment, nothing else.

DIRECT LIKE A FILMMAKER, NOT A STOCK-PHOTO SEARCH. The images must add up to ONE continuous visual story that carries the script's emotional arc — never a slideshow of unrelated smiling strangers.

Before choosing any image, silently decide these three things and hold them consistent the whole way through:
1. THE PERSON — one specific human this script is really for, who is a believable customer for THIS exact topic (e.g. a 67-year-old grandmother for final expense; a 34-year-old self-employed carpenter for ACA; a young couple with a new baby for life insurance). Fix their age, build, hair, skin tone and clothing.
2. THE ARC — where they begin emotionally (a quiet question, an unspoken worry, an ordinary morning), what shifts in the middle, and where they land (relief, control, a protected family). Spread that arc across the segments IN ORDER, matching each image to the words spoken over it.
3. THE WORLD — one home/neighborhood, one time of day, one color palette that recurs, so the whole video reads as a single film rather than a folder of stock shots.

Rules:
- Output ONLY valid JSON: { "scenes": [ { "index": number, "onScreenText": string, "imageConcept": string } ] }.
- Return EXACTLY one entry per narration segment, in order, with "index" matching the segment number you were given.
- "imageConcept" is a 1-2 sentence photographic description of THIS story beat — the specific moment in your story, not a generic illustration of the topic. Do NOT use the word "insurance". No text, signage or graphics in the scene. ALWAYS written in English (it prompts an image model), whatever language the narration is in.
- "onScreenText" is a SHORT punchy caption/headline (max ~6 words) for that beat, written in the SAME LANGUAGE as the narration. Title Case. No ending period.
- CONTINUITY: whenever your person appears, restate the SAME physical details (age, build, hair, skin tone, clothing) so every scene renders recognisably the same human in the same world.
- SHOT VARIETY — cut like a real edit; do NOT put a face in every frame. AT MOST HALF the scenes should show a person's face. Mix in:
  - wide establishing shots (the house from the street, a kitchen in morning light, an empty porch)
  - close detail shots with NO people at all (two mugs on a table, keys by the door, a handwritten note, a child's drawing on the fridge, folded laundry, a framed photo on a shelf, sun moving across a windowsill)
  - hands only (hands around a warm mug, one hand resting on another, a pen over paper)
  - from behind or over the shoulder, the person looking out at something
  - the person alone in a quiet, unguarded moment
- NEVER a crowd. Never more than 3 people in a frame, and most frames should contain zero or one person.
- EMOTION: match the beat honestly. Early "problem" beats may be still, quiet and contemplative — that is not sadness, it is truth, and it is what makes the resolution land. Later beats warm and open up. Never a grinning stock-photo reaction, no gasping mouths, no wide-eyed shock, no theatrical surprise.
- IMAGE SAFETY (hard rule): NEVER describe death, dying, funerals, coffins, caskets, graves, cemeteries, grief, crying, illness, disease, hospital beds, medical procedures, blood, injury or frailty — even if the narration mentions them. For sensitive topics show the life being protected, or a quiet dignified hopeful moment, instead. Quiet and contemplative is welcome; morbid or distressing is forbidden.
- The FIRST image must be a scroll-stopping hook — an intriguing, specific image, not a talking head.
- Do not mention you are an AI. Do not add a disclaimer.`;

function buildVisualDirectorPrompt(
  source: SocialPostSource,
  segments: string[],
  voiceLanguage: SocialLocale
): string {
  const langName = voiceLanguage === "es" ? "Spanish (Español)" : "English";
  return [
    `The narration below is FINAL and LOCKED. It is spoken in ${langName}. Choose one image per segment.`,
    `Topic: ${source.title}`,
    source.category
      ? `Product / line of business: ${source.category} — cast a protagonist who is a believable real customer for THIS product.`
      : "",
    source.subtitle ? `Subtitle: ${source.subtitle}` : "",
    "",
    `NARRATION SEGMENTS (${segments.length}):`,
    segments.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    "",
    `Return exactly ${segments.length} scene objects with "index" 1…${segments.length}. JSON only.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Fingerprint of the words the video will actually SAY. Derived from the cleaned spoken
 * text rather than the raw script, so re-typing a timestamp or a beat label doesn't force a
 * paid re-render, while changing a single spoken word does. Drives both "skip the rebuild"
 * and "the saved HeyGen avatar clip still speaks the right words".
 */
export function hashScript(script: Pick<VideoScript, "fullScript">): string {
  return createHash("sha256").update(planNarration(script.fullScript).spokenText).digest("hex");
}

// Varied, people-free stand-ins used when the visual director is unavailable or returns
// short. Cycled so a fallback run still produces a watchable cut instead of ten copies of
// the same frame.
const FALLBACK_CONCEPTS = [
  "a warm, lived-in family kitchen in soft morning light — two mugs on a wooden table, a folded newspaper, sunlight falling across the counter, no people in the frame",
  "a modest suburban house seen from the street in golden late-afternoon light, no people in the frame",
  "a set of keys and a worn leather wallet resting on a hallway table beside a small potted plant",
  "sunlight moving across a windowsill above a kitchen sink, a single glass drying on a cloth",
  "a framed family photograph on a bookshelf, softly out of focus behind it a living room in warm lamplight",
  "hands resting around a warm ceramic mug on a wooden table, steam rising, no face visible",
  "a child's crayon drawing held to a refrigerator door by two magnets, kitchen softly blurred behind",
  "an empty front porch with two chairs and a folded blanket, early evening light, no people in the frame",
];

interface SceneVisual {
  onScreenText: string;
  imageConcept: string;
}

/**
 * Ask GPT for one image concept per (already final) narration segment. Never throws — the
 * script must be able to become a video even if the visual director is down, so failures
 * degrade to cycled fallback concepts rather than blocking the render.
 */
async function directSceneVisuals(
  source: SocialPostSource,
  segments: string[],
  voiceLanguage: SocialLocale
): Promise<SceneVisual[]> {
  const visuals: SceneVisual[] = segments.map(() => ({ onScreenText: "", imageConcept: "" }));

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model:           process.env.OPENAI_MODEL ?? "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: VISUAL_DIRECTOR_SYSTEM_PROMPT },
        { role: "user",   content: buildVisualDirectorPrompt(source, segments, voiceLanguage) },
      ],
      max_tokens:  2500,
      temperature: 0.7,
    });

    const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
    const rawScenes: unknown[] = Array.isArray(raw.scenes) ? raw.scenes : [];

    rawScenes.forEach((s, order) => {
      const o = s as Record<string, unknown>;
      // Trust "index" when it's a sane 1-based pointer, else fall back to arrival order.
      const parsed = Number(o.index);
      const idx = Number.isFinite(parsed) && parsed >= 1 && parsed <= segments.length
        ? Math.floor(parsed) - 1
        : order;
      if (idx < 0 || idx >= visuals.length) return;
      visuals[idx] = {
        onScreenText: String(o.onScreenText ?? "").trim(),
        imageConcept: String(o.imageConcept ?? "").trim(),
      };
    });
  } catch (err) {
    console.warn(`[video-generator] visual director failed, using fallback concepts: ${(err as Error).message}`);
  }

  return visuals.map((v, i) => ({
    onScreenText: v.onScreenText,
    imageConcept: v.imageConcept || FALLBACK_CONCEPTS[i % FALLBACK_CONCEPTS.length],
  }));
}

// ─── Faithful translation (only when the voice language differs from the script) ───

const TRANSLATOR_SYSTEM_PROMPT = `You are a faithful subtitle translator. You translate a numbered list of narration segments and nothing else.

HARD RULES:
- Return EXACTLY as many segments as you were given, in the same order, one translation per input segment.
- Translate meaning-for-meaning into natural, warm, spoken Latin American Spanish or natural spoken English (whichever the target language is) — never a stiff word-for-word rendering.
- Do NOT add, remove, summarize, embellish, explain, or "improve" anything. No new sentences. No call to action that was not there. No commentary.
- Preserve names, numbers, amounts and the word INFO exactly.
- NEVER use the word "insurance" / "seguro" — use plan, coverage, benefits, protection / plan, cobertura, beneficios, protección.
- Output ONLY valid JSON: { "segments": [string, ...] }.`;

/** Translate segments 1:1. Returns the originals unchanged on any failure or count mismatch. */
async function translateSegments(segments: string[], target: SocialLocale): Promise<string[]> {
  const langName = target === "es" ? "Spanish (Latin American, spoken)" : "English (spoken)";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model:           process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: TRANSLATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `TARGET LANGUAGE: ${langName}.`,
          `Translate these ${segments.length} segments. Return exactly ${segments.length}.`,
          segments.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        ].join("\n"),
      },
    ],
    max_tokens:  2500,
    temperature: 0.2,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const out: unknown[] = Array.isArray(raw.segments) ? raw.segments : [];
  const cleaned = out.map((s) => String(s ?? "").trim());
  if (cleaned.length !== segments.length || cleaned.some((s) => !s)) {
    throw new Error(`translator returned ${cleaned.length} segments, expected ${segments.length}`);
  }
  return cleaned;
}

/**
 * Speak the script exactly as written when its language already matches the selected
 * voiceover language (the normal case). Only when they genuinely differ do we translate —
 * segment for segment, adding nothing — so "the script is the source of truth" still holds
 * for a Spanish voiceover on an English script. Any failure falls back to the script itself.
 */
async function localizeSegments(segments: string[], voiceLanguage: SocialLocale): Promise<string[]> {
  if (segments.length === 0) return segments;
  if (detectScriptLocale(segments.join(" "), voiceLanguage) === voiceLanguage) return segments;

  try {
    return await translateSegments(segments, voiceLanguage);
  } catch (err) {
    console.warn(`[video-generator] segment translation failed, speaking the script as written: ${(err as Error).message}`);
    return segments;
  }
}

/** Derive the final spoken segments for a script, in the requested voiceover language. */
async function narrationSegmentsFor(
  videoScript: VideoScript,
  voiceLanguage: SocialLocale
): Promise<string[]> {
  const plan = planNarration(videoScript.fullScript);
  if (plan.wordCount === 0) return [];
  // Shotstack speaks the whole narration as ONE track, so a segment boundary only moves an
  // image and may fall mid-sentence for better pacing. JSON2Video gives each segment its own
  // voice element, where that would be an audible mid-sentence stop — so there we only split
  // on real sentence/clause boundaries.
  const raw = segmentNarration(plan.spokenText, recommendedSceneCount(plan.estimatedSeconds), {
    allowMidSentence: renderProvider() !== "json2video",
  });
  return localizeSegments(raw, voiceLanguage);
}

export async function buildVideoStoryboard(
  source: SocialPostSource,
  videoScript: VideoScript,
  locale?: SocialLocale
): Promise<VideoStoryboard> {
  const voiceLanguage: SocialLocale = locale ?? source.locale ?? "en";

  const segments = await narrationSegmentsFor(videoScript, voiceLanguage);
  if (segments.length === 0) {
    throw new Error("The video script has no spoken words. Add a full script before generating a video.");
  }

  const visuals = await directSceneVisuals(source, segments, voiceLanguage);

  const scenes: VideoScene[] = segments.map((narration, i) => ({
    narration,                                   // VERBATIM from the script — never rewritten
    onScreenText: visuals[i]?.onScreenText ?? "",
    imageConcept: visuals[i]?.imageConcept ?? FALLBACK_CONCEPTS[i % FALLBACK_CONCEPTS.length],
    imageUrl:     "", // filled by generateVideoSceneImages (Phase A)
  }));

  return {
    scenes,
    voiceLanguage,
    durationSeconds: videoScript.duration,
    category:        source.category,
    scriptHash:      hashScript(videoScript),
  };
}

/**
 * Re-derive narration from the latest saved script while KEEPING the curated images, clips
 * and settings. Deterministic and GPT-free (except an optional translation), so re-syncing
 * before a render is instant, free, and cannot introduce words the script doesn't contain.
 */
export async function resyncStoryboardNarration(
  current: VideoStoryboard,
  videoScript: VideoScript
): Promise<VideoStoryboard> {
  const segments = await narrationSegmentsFor(videoScript, current.voiceLanguage);
  if (segments.length === 0 || current.scenes.length === 0) return current;

  // Only scenes that actually have a background can donate one — a longer script produces
  // more segments than there are existing scenes, and every scene must still end up with an
  // image or the render is rejected.
  const withImages = current.scenes.filter((s) => s.imageUrl);

  // Re-point each new segment at an existing scene's visuals (cycling if the segment count
  // changed) so nothing already generated or hand-picked is thrown away.
  const scenes: VideoScene[] = segments.map((narration, i) => {
    const donor = current.scenes[i] ?? current.scenes[i % current.scenes.length];
    const imageDonor = donor?.imageUrl
      ? donor
      : (withImages[i % withImages.length] ?? donor);
    return {
      narration,
      onScreenText: donor?.onScreenText ?? "",
      imageConcept: donor?.imageConcept ?? "",
      imageUrl:     imageDonor?.imageUrl ?? "",
      videoClipUrl: donor?.imageUrl ? donor.videoClipUrl : imageDonor?.videoClipUrl,
    };
  });

  return {
    ...current,
    scenes,
    durationSeconds: videoScript.duration,
    scriptHash:      hashScript(videoScript),
  };
}

// ─── Step 1b: Generate one portrait image per scene (Phase A) ─────────────────────

// Portrait, full-frame cinematic prompt — NO card-overlay composition rules, NO text.
function buildVideoImagePrompt(concept: string, locale?: string): string {
  const mood = pickVariationMood();
  const demographic = getDemographicHint(locale);
  return [
    `A single frame from a documentary-style short film, vertical 9:16: ${concept}.`,
    `Lighting: ${mood}.`,
    `Camera: Canon EOS R5, 35mm f/1.8, natural depth of field, full-frame composition that fills a tall vertical portrait frame top to bottom.`,
    `Mood: emotionally authentic and quietly cinematic — a real, observed moment from someone's life. Warm and hopeful in feeling even when the moment is still or contemplative.`,
    // The storyboard deliberately calls for people-free detail/establishing shots, so the
    // people-specific direction has to be conditional or the model inserts figures anyway.
    `IF PEOPLE APPEAR IN THIS SCENE: ${demographic} Their expressions must be natural, subtle and unposed — a soft genuine smile, quiet relief, or calm presence, as if caught mid-moment and unaware of the camera. NEVER exaggerated or theatrical: no gasping or wide-open mouths, no wide-eyed shock, no jazz-hands excitement, no forced ear-to-ear grins, no posing for the camera. One or two people at most — never a crowd.`,
    `IF THE SCENE DESCRIBES NO PEOPLE (an object, a detail, an empty room, a landscape): render it completely empty of people — do NOT add any figures, hands or faces.`,
    `REALISM: Natural skin with visible texture and pores, slight natural asymmetry in faces, realistic imperfect lighting and catchlights in the eyes. Avoid airbrushed, plastic, waxy, or overly-symmetrical "AI face" skin. This should read as an authentic photograph, not a generated or overly-polished stock image.`,
    `PROHIBITED CONTENT: nothing morbid or distressing — no death, funerals, coffins, graves, illness, hospitals, injury, blood, or grief.`,
    `PROHIBITED: No text, words, numbers, signs, logos, watermarks, captions, or graphic overlays anywhere in the image.`,
    `STYLE: Hyper-realistic photograph, candid and editorial rather than staged/glossy stock photography. Absolutely NOT an illustration, NOT vector art, NOT a painting, NOT a CGI render, NOT digital art. Real photography only.`,
  ].join(" ");
}

// A guaranteed-safe fallback used when a concept is rejected by moderation. Deliberately
// people-free: figures are what trip the safety filters, and an empty lived-in interior still
// fits the documentary storytelling look far better than a grinning stock family did.
const SAFE_FALLBACK_CONCEPT =
  "a warm, lived-in family kitchen in soft morning light — two mugs on a wooden table, a folded newspaper, sunlight falling across the counter, no people in the frame";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeError(err: any): { status?: number; message: string; safety: boolean } {
  const status = err?.status ?? err?.statusCode ?? err?.http_code;
  const message =
    err?.error?.message ??
    err?.message ??
    err?.response?.data?.error?.message ??
    (typeof err === "string" ? err : (() => { try { return JSON.stringify(err); } catch { return "unknown error"; } })());
  const safety = /safety|moderation|rejected|content[_ ]policy/i.test(String(message));
  return { status, message: String(message), safety };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function generateImageOnce(openai: OpenAI, concept: string, category: string, locale?: string): Promise<string> {
  const response = await openai.images.generate({
    model:   (process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1") as "gpt-image-1",
    prompt:  buildVideoImagePrompt(concept, locale),
    // "medium" (not "high") — high-quality gpt-image-1 takes ~60s/image, so a ~10-scene batch
    // blows past the 300s serverless limit. Medium roughly halves it; these are panned,
    // caption-overlaid backgrounds where the quality drop is negligible.
    quality: "medium",
    size:    "1024x1536", // portrait (2:3) — lightly cover-cropped to 9:16 by JSON2Video
    n:       1,
  } as Parameters<typeof openai.images.generate>[0]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b64 = (response as any).data?.[0]?.b64_json;
  if (!b64) throw new Error("Image model returned no image data");

  const upload = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    folder:        `social-media/${category}/video-images`,
    resource_type: "image",
  });
  return upload.secure_url;
}

// Resilient single-image generation: retries transient/rate-limit errors with backoff,
// and falls back to a wholesome safe concept if moderation rejects the prompt.
async function generateOneSceneImage(
  openai: OpenAI,
  concept: string,
  category: string,
  locale?: string
): Promise<string> {
  const MAX_ATTEMPTS = 3;
  let currentConcept = concept;
  let lastError = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const url = await generateImageOnce(openai, currentConcept, category, locale);
      await registerImageAsset({ imageUrl: url, concept: currentConcept, category, locale });
      return url;
    } catch (err) {
      const { status, message, safety } = describeError(err);
      lastError = `(${status ?? "?"}) ${message}`;
      console.warn(`[video-image] attempt ${attempt + 1} failed: ${lastError}`);

      if (safety) {
        // Prompt was moderated → swap to the guaranteed-safe concept and retry.
        currentConcept = SAFE_FALLBACK_CONCEPT;
        continue;
      }
      // Rate limit (429) or transient 5xx/network → backoff and retry.
      if (attempt < MAX_ATTEMPTS - 1 && (status === 429 || status === undefined || (status ?? 0) >= 500)) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw new Error(lastError || "Image generation failed");
}

// Regenerate a single portrait image from a concept (quick re-roll or an edited prompt).
export async function regenerateSceneImage(
  concept: string,
  category?: string,
  locale?: string
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return generateOneSceneImage(openai, concept, category ?? "general", locale);
}

// Generate scene images in parallel with a small concurrency cap, tolerating partial
// failures. Mutates storyboard scenes (sets imageUrl) and returns the persisted batch.
export async function generateVideoSceneImages(
  storyboard: VideoStoryboard,
  source: SocialPostSource
): Promise<VideoImage[]> {
  const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const category = source.category ?? storyboard.category ?? "general";
  const locale   = storyboard.voiceLanguage;
  const now      = new Date().toISOString();

  // Keep concurrency low — gpt-image-1 has tight rate limits at high quality.
  const CONCURRENCY = 2;
  const results: (string | null)[] = new Array(storyboard.scenes.length).fill(null);

  for (let start = 0; start < storyboard.scenes.length; start += CONCURRENCY) {
    const batch = storyboard.scenes.slice(start, start + CONCURRENCY);
    await Promise.all(
      batch.map(async (scene, j) => {
        const idx = start + j;
        const concept = scene.imageConcept || source.title;
        try {
          results[idx] = await generateOneSceneImage(openai, concept, category, locale);
        } catch (err) {
          console.warn(`[generateVideoSceneImages] scene ${idx} failed: ${(err as Error).message}`);
          results[idx] = null;
        }
      })
    );
  }

  const succeeded = results.filter((u): u is string => Boolean(u));
  if (succeeded.length < Math.min(6, storyboard.scenes.length)) {
    throw new Error("Too many image generations failed. Please try again.");
  }

  // Fill any gaps by reusing a succeeded image so every scene has a portrait background.
  let fillCursor = 0;
  storyboard.scenes.forEach((scene, idx) => {
    scene.imageUrl = results[idx] ?? succeeded[fillCursor++ % succeeded.length];
  });

  // The stacked library only records the genuinely generated images (not the fills).
  return storyboard.scenes
    .map((scene, idx) => ({ scene, url: results[idx] }))
    .filter((x): x is { scene: VideoScene; url: string } => Boolean(x.url))
    .map(({ scene, url }) => ({ url, concept: scene.imageConcept, createdAt: now }));
}

// ─── Step 2: Build JSON2Video movie + submit render ──────────────────────────────

// Ken Burns motion directions cycled per scene so a single background image still feels alive.
const PAN_DIRECTIONS = ["top-left", "bottom-right", "top-right", "bottom-left", "left", "right"] as const;

// Presenter geometry on the 1080×1920 canvas (9:16 source scaled by width; height:-1 keeps
// the aspect). The figure is LARGE and anchored low so its lower body runs off the bottom of
// the frame — it reads like a person standing in the corner, not a small floating cut-out box.
const PRESENTER_WIDTH_PX   = 600;  // displayed width (≈ 1067 tall at 9:16) — prominent
const PRESENTER_TOP_Y      = 980;  // clip top → head lands in the lower third; bottom is cropped
const PRESENTER_EDGE_BLEED = 120;  // pull the figure toward the screen edge so it hugs the side

// Distribute the audio's total length across scenes, weighted by narration word count, so
// each background image is on screen for as long as its own words take to speak — and so
// the LAST scene ends exactly when the narration does.
//
// The old version rounded every scene to a whole second and clamped each with
// `Math.max(1, …)`, which could total MORE than the audio and leave the video running on
// after the voice had stopped. `distributeSceneDurations` works on cumulative fractions,
// so rounding cannot accumulate and the final boundary is exactly `totalSec`.
function sceneDurations(scenes: VideoScene[], totalSec: number): number[] {
  return distributeSceneDurations(scenes.map((s) => countWords(s.narration)), totalSec);
}

/** Karaoke subtitles are on unless the post explicitly turned them off. */
function subtitlesEnabled(storyboard: VideoStoryboard): boolean {
  return storyboard.subtitles !== false;
}

function buildMovieJson(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number; chromaColor?: string }
) {
  const voice        = elevenLabsVoiceFor(storyboard.voiceLanguage);
  const connection   = process.env.JSON2VIDEO_ELEVENLABS_CONNECTION;
  const bgMusicUrl   = storyboard.musicUrl || musicUrlForCategory(storyboard.category);
  const usePresenter = Boolean(storyboard.presenter && presenter);
  const durations = usePresenter
    ? sceneDurations(storyboard.scenes, presenter!.durationSec)
    : [];

  const cinematic = Boolean(storyboard.cinematic);

  const scenes = storyboard.scenes.map((scene, i) => {
    // Presenter on → explicit word-weighted duration; off → -2 matches the voice-driven scene.
    const sceneDuration = usePresenter ? durations[i] : -2;

    // Cinematic scene → Veo clip (muted; its motion replaces Ken Burns). Otherwise the still.
    const background =
      cinematic && scene.videoClipUrl
        ? {
            type:       "video",
            src:        scene.videoClipUrl,
            duration:   sceneDuration,
            resize:     "cover",
            muted:      true,            // keep our ElevenLabs/HeyGen track as the only audio
            "fade-in":  0.4,
            "fade-out": 0.4,
          }
        : {
            type:           "image",
            src:            scene.imageUrl,
            duration:       sceneDuration,
            resize:         "cover",
            pan:            PAN_DIRECTIONS[i % PAN_DIRECTIONS.length],
            zoom:           2,
            "pan-distance": 0.12,
            "fade-in":      0.4,
            "fade-out":     0.4,
          };

    return {
      elements: [
        background,
        // ElevenLabs voiceover — its natural length defines the scene duration. Omitted when a
        // presenter is used: the HeyGen clip is the master audio (avoids overlapping voices).
        ...(usePresenter
          ? []
          : [{
              type:    "voice",
              text:    scene.narration,
              model:   "elevenlabs",
              voice,
              ...(connection ? { connection } : {}),
            }]),
      ],
    };
  });

  // Bottom-left by default (matches the "presenter rising from the lower-left" look). The clip
  // is pulled toward the edge and pushed down so its lower body is cropped by the frame bottom.
  const placement  = storyboard.presenterPlacement ?? "bottom-left";
  const presenterX = placement === "bottom-right"
    ? 1080 - PRESENTER_WIDTH_PX + PRESENTER_EDGE_BLEED
    : -PRESENTER_EDGE_BLEED;
  const presenterY = PRESENTER_TOP_Y;

  const movie: Record<string, unknown> = {
    resolution: "custom",
    width:      1080,
    height:     1920,
    quality:    "high",
    scenes,
    elements: [
      // HeyGen presenter inset (green background chroma-keyed out) — master audio for the Short.
      ...(usePresenter
        ? [{
            type:        "video",
            src:         presenter!.url,
            position:    "custom",
            x:           presenterX,
            y:           presenterY,
            width:       PRESENTER_WIDTH_PX,
            height:      -1,
            start:       0,
            duration:    presenter!.durationSec,
            "chroma-key": { color: presenter!.chromaColor || HEYGEN_CHROMA_COLOR, tolerance: 25 },
            "fade-in":   0.4,
            "fade-out":  0.4,
          }]
        : []),
      // Auto-transcribed karaoke captions (Shorts are watched on mute) — optional per post.
      ...(subtitlesEnabled(storyboard)
        ? [{
            type:     "subtitles",
            language: storyboard.voiceLanguage,
            model:    "default",
            settings: {
              style:                "classic-progressive",
              "font-family":        "Oswald",
              "font-size":          90,
              // Faceless: mid-bottom-center keeps captions CENTERED in the lower-third, clear of the
              // platform's bottom UI. Presenter on: the large avatar's face sits in the vertical
              // middle, so move captions to the top — the clear zone above the avatar's head.
              position:             usePresenter ? "top-center" : "mid-bottom-center",
              "word-color":         "#00B4D8",
              "line-color":         "#FFFFFF",
              "outline-color":      "#000000",
              "outline-width":      4,
              "max-words-per-line": 4,
            },
          }]
        : []),
      // Subtle category-matched background music bed (low volume) if configured. Loop it and
      // stretch to the movie length (loop:-1 + duration:-2) so the bed always covers the whole
      // Short — the generated/real video length (voice-driven) varies and the track may be shorter.
      ...(bgMusicUrl
        ? [{ type: "audio", src: bgMusicUrl, volume: 0.12, loop: -1, duration: -2, "fade-in": 1.0, "fade-out": 1.5 }]
        : []),
    ],
  };

  return movie;
}

async function submitJson2VideoRender(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number; chromaColor?: string }
): Promise<{ projectId: string }> {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) throw new Error("JSON2VIDEO_API_KEY is not configured");

  const movie = buildMovieJson(storyboard, presenter);

  const res = await fetch(JSON2VIDEO_BASE, {
    method:  "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body:    JSON.stringify(movie),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.project) {
    throw new Error(
      `JSON2Video render submit failed (HTTP ${res.status}): ${data?.message ?? "unknown error"}`
    );
  }

  return { projectId: String(data.project) };
}

// ─── Step 3: Poll status + host final mp4 on Cloudinary ──────────────────────────

async function getJson2VideoStatus(
  projectId: string,
  category?: string
): Promise<{ status: VideoRenderStatus; videoUrl?: string; progress?: number; message?: string }> {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) throw new Error("JSON2VIDEO_API_KEY is not configured");

  const res = await fetch(`${JSON2VIDEO_BASE}?project=${encodeURIComponent(projectId)}`, {
    headers: { "x-api-key": apiKey },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.success) {
    throw new Error(`JSON2Video status check failed (HTTP ${res.status}): ${data?.message ?? "unknown error"}`);
  }

  const movie  = (data.movie ?? {}) as Record<string, unknown>;
  const status = String(movie.status ?? "running");
  const message = movie.message ? String(movie.message) : undefined;
  const progress = typeof movie.progress === "number" ? movie.progress : undefined;

  if (status === "error" || status === "timeout") {
    throw new Error(`Video render ${status}: ${message ?? "no detail"}`);
  }

  if (status !== "done") {
    return { status: "running", progress, message };
  }

  // Done — upload the rendered mp4 to Cloudinary for a stable, canonical URL.
  const renderedUrl = String(movie.url ?? "");
  if (!renderedUrl) throw new Error("Render reported done but returned no video URL");

  const upload = await cloudinary.uploader.upload(renderedUrl, {
    folder:        `social-media/${category ?? "general"}/videos`,
    resource_type: "video",
  });

  return { status: "done", videoUrl: upload.secure_url };
}

// ─── Shotstack path (default) — decoupled TTS + captions, pay-as-you-go render ─────

const VIDEO_WIDTH  = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS    = 30;
// Presenter clip size as a fraction of the frame — large, like a person standing in the corner.
const PRESENTER_SCALE = Number(process.env.SHOTSTACK_PRESENTER_SCALE) || 0.62;

// Shotstack's soundtrack has no loop — it just stops when the file ends, leaving silence for
// the rest of the video. Our AI music is generated up front (before the real narration/avatar
// length is known) at a nominal 30/60s, so it's often short. Re-fit it to the ACTUAL audio
// length right before submitting, so the render never has a music track shorter than the video.
// A tail buffer covers the closing fade-out; a fallback (env) loop track is left alone since we
// don't control its length.
const MUSIC_TAIL_BUFFER_SEC = 3;

async function musicUrlFittingDuration(
  storyboard: VideoStoryboard,
  totalAudioSec: number,
  category: string,
): Promise<string | undefined> {
  if (!storyboard.musicUrl || !process.env.ELEVENLABS_API_KEY) return storyboard.musicUrl;
  try {
    const { musicUrl } = await generateCategoryMusic({
      category,
      durationSeconds: Math.ceil(totalAudioSec + MUSIC_TAIL_BUFFER_SEC),
    });
    return musicUrl;
  } catch (err) {
    console.warn(`[video-generator] music re-fit failed, keeping the existing track: ${(err as Error).message}`);
    return storyboard.musicUrl;
  }
}

async function submitShotstackRender(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number; chromaColor?: string }
): Promise<{ projectId: string }> {
  const category     = storyboard.category ?? "general";
  const locale       = storyboard.voiceLanguage;
  const cinematic    = Boolean(storyboard.cinematic);
  const usePresenter = Boolean(storyboard.presenter && presenter);

  // Cinematic scenes use their Veo clip as the background; otherwise the still image.
  const sceneBg = (s: VideoScene): { backgroundUrl: string; isVideo: boolean } =>
    cinematic && s.videoClipUrl
      ? { backgroundUrl: s.videoClipUrl, isVideo: true }
      : { backgroundUrl: s.imageUrl, isVideo: false };

  const scenes: RenderPlanScene[] = [];
  let narrationAudio: RenderPlan["narrationAudio"];

  // Scene image durations are word-weighted to fill the audio length (precise enough for a
  // Ken Burns slideshow), so a single audio source backs the whole video — required for the
  // rich-caption auto-transcription and far simpler than per-scene clips.
  const totalAudioSec = usePresenter
    ? presenter!.durationSec
    : (await synthesizeNarrationTrack(storyboard, locale, category, (a) => { narrationAudio = a; }));

  const durations = sceneDurations(storyboard.scenes, totalAudioSec);
  let t = 0;
  storyboard.scenes.forEach((s, i) => {
    scenes.push({ ...sceneBg(s), start: t, length: durations[i] });
    t += durations[i];
  });

  const presenterPlan: RenderPlanPresenter | undefined = usePresenter
    ? {
        src:         presenter!.url,
        start:       0,
        length:      presenter!.durationSec,
        // Detected off the clip when available — a custom photo avatar's baked-in green is
        // far from the #00FF00 that stock avatars render against.
        chromaColor: presenter!.chromaColor || HEYGEN_CHROMA_COLOR,
        placement:   storyboard.presenterPlacement === "bottom-right" ? "bottom-right" : "bottom-left",
        scale:       PRESENTER_SCALE,
      }
    : undefined;

  const musicUrl = await musicUrlFittingDuration(storyboard, totalAudioSec, category);

  const plan: RenderPlan = {
    width:          VIDEO_WIDTH,
    height:         VIDEO_HEIGHT,
    fps:            VIDEO_FPS,
    // The script's spoken length IS the video's length — nothing may run past it.
    durationSec:    totalAudioSec,
    scenes,
    narrationAudio,
    presenter:      presenterPlan,
    musicUrl:       musicUrl || musicUrlForCategory(category),
    captions:       subtitlesEnabled(storyboard),
  };

  const { jobId } = await shotstackProvider.submit(plan);
  return { projectId: jobId };
}

// Synthesize the whole narration in one ElevenLabs call; reports the hosted track back via
// `setAudio` and returns its duration (used to time the scene slideshow).
async function synthesizeNarrationTrack(
  storyboard: VideoStoryboard,
  locale: SocialLocale,
  category: string,
  setAudio: (a: RenderPlan["narrationAudio"]) => void
): Promise<number> {
  const fullNarration = storyboard.scenes.map((s) => s.narration.trim()).filter(Boolean).join(" ");
  const { audioUrl, durationSec } = await synthesizeNarration(fullNarration, locale, category);
  setAudio({ src: audioUrl, start: 0, length: durationSec });
  return durationSec;
}

async function getShotstackStatus(
  projectId: string,
  category?: string
): Promise<{ status: VideoRenderStatus; videoUrl?: string; progress?: number; message?: string }> {
  const r = await shotstackProvider.status(projectId);
  if (r.status === "failed") throw new Error(`Video render failed: ${r.message ?? "no detail"}`);
  if (r.status !== "done") return { status: "running", progress: r.progress, message: r.message };

  // Done — re-host the rendered mp4 on Cloudinary for a stable, canonical URL.
  if (!r.videoUrl) throw new Error("Render reported done but returned no video URL");
  const upload = await cloudinary.uploader.upload(r.videoUrl, {
    folder:        `social-media/${category ?? "general"}/videos`,
    resource_type: "video",
  });
  return { status: "done", videoUrl: upload.secure_url };
}

// ─── Public render API (provider-switched; default Shotstack) ──────────────────────

export async function submitVideoRender(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number; chromaColor?: string }
): Promise<{ projectId: string }> {
  return renderProvider() === "json2video"
    ? submitJson2VideoRender(storyboard, presenter)
    : submitShotstackRender(storyboard, presenter);
}

export async function getVideoRenderStatus(
  projectId: string,
  category?: string
): Promise<{ status: VideoRenderStatus; videoUrl?: string; progress?: number; message?: string }> {
  return renderProvider() === "json2video"
    ? getJson2VideoStatus(projectId, category)
    : getShotstackStatus(projectId, category);
}
