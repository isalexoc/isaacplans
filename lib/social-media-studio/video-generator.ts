import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { getDemographicHint, pickVariationMood } from "./image-generator";
import { musicUrlForCategory } from "./video-music";
import { HEYGEN_CHROMA_COLOR } from "./heygen-presenter";
import type {
  SocialPostSource,
  VideoScript,
  VideoScene,
  VideoStoryboard,
  VideoImage,
  VideoRenderStatus,
  SocialLocale,
} from "./types";

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

// ─── Step 1: Storyboard (GPT "video director") ───────────────────────────────────
// Converts the timed video script (with [MM:SS] markers + stage directions) into a
// clean, render-ready scene list: spoken narration + a short on-screen headline per
// scene. Mirrors the JSON-mode pattern in script-generator.ts.

const STORYBOARD_SYSTEM_PROMPT = `You are a short-form video director for an insurance brand. You convert a talking-head video script into a clean storyboard for a vertical (9:16) YouTube Short built from still images + AI voiceover + on-screen captions.

Rules:
- Output ONLY valid JSON: { "scenes": [ { "narration": string, "onScreenText": string, "imageConcept": string } ] }.
- "narration" is the exact words the voiceover will SPEAK for that scene — natural spoken sentences only. NO timestamps, NO stage directions, NO brackets, NO emojis, NO hashtags.
- "onScreenText" is a SHORT punchy caption/headline (max ~6 words) burned on screen for that scene. Title Case. No ending period.
- "imageConcept" is a SPECIFIC 1-2 sentence photographic scene description for a vertical background image that visually matches THIS scene's narration (subjects, emotion, setting, key visual detail). Each scene's imageConcept MUST be visually DISTINCT from the others. Do NOT use the word "insurance". No text or graphics in the scene.
- CRITICAL IMAGE SAFETY: imageConcept must always be WHOLESOME, POSITIVE and HOPEFUL — happy, healthy, dignified people in warm everyday settings (family at home, outdoors, a friendly advisor meeting, a person smiling). NEVER describe death, dying, funerals, coffins, caskets, graves, cemeteries, grief, crying, illness, disease, hospital beds, medical procedures, blood, injury, frailty, or anything somber, morbid or distressing — even if the narration mentions them. For sensitive topics, show the POSITIVE outcome (a protected, joyful family; peace of mind; a loving moment) instead.
- The FIRST scene must be a scroll-stopping hook.
- Keep total narration tight so the whole video fits the target duration when spoken at a natural pace (~2.5 words/second).
- Write narration AND onScreenText in the SAME language as the source script (English or Spanish). imageConcept is always in English (it prompts an image model).
- Do not mention you are an AI. Do not add a disclaimer.`;

function buildStoryboardUserPrompt(
  source: SocialPostSource,
  videoScript: VideoScript,
  sceneCount: number
): string {
  return [
    `Target duration: ${videoScript.duration} seconds → produce exactly ${sceneCount} scenes.`,
    `Topic: ${source.title}`,
    source.subtitle ? `Subtitle: ${source.subtitle}` : "",
    `Hook: ${videoScript.hookScript}`,
    `Full script:\n${videoScript.fullScript}`,
    videoScript.onScreenTextSuggestions.length
      ? `On-screen text ideas: ${videoScript.onScreenTextSuggestions.join(" | ")}`
      : "",
    `\nReturn the JSON storyboard now.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function buildVideoStoryboard(
  source: SocialPostSource,
  videoScript: VideoScript,
  locale?: SocialLocale
): Promise<VideoStoryboard> {
  const voiceLanguage: SocialLocale = locale ?? source.locale ?? "en";
  // One distinct portrait image per scene → guarantee at least 10 images per video.
  const sceneCount = videoScript.duration === 60 ? 12 : 10;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model:           process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORYBOARD_SYSTEM_PROMPT },
      { role: "user",   content: buildStoryboardUserPrompt(source, videoScript, sceneCount) },
    ],
    max_tokens:  2500,
    temperature: 0.7,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const rawScenes: unknown[] = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (rawScenes.length === 0) throw new Error("AI returned no storyboard scenes");

  const scenes: VideoScene[] = rawScenes.map((s) => {
    const o = s as Record<string, unknown>;
    return {
      narration:    String(o.narration ?? "").trim(),
      onScreenText: String(o.onScreenText ?? "").trim(),
      imageConcept: String(o.imageConcept ?? "").trim(),
      imageUrl:     "", // filled by generateVideoSceneImages (Phase A)
    };
  }).filter((s) => s.narration.length > 0);

  if (scenes.length === 0) throw new Error("Storyboard produced no usable narration");

  return { scenes, voiceLanguage, durationSeconds: videoScript.duration, category: source.category };
}

// ─── Step 1b: Generate one portrait image per scene (Phase A) ─────────────────────

// Portrait, full-frame cinematic prompt — NO card-overlay composition rules, NO text.
function buildVideoImagePrompt(concept: string, locale?: string): string {
  const mood = pickVariationMood();
  const demographic = getDemographicHint(locale);
  return [
    `Cinematic vertical (9:16) professional photograph: ${concept}.`,
    `Lighting: ${mood}.`,
    `Camera: Canon EOS R5, 35mm f/1.8, natural depth of field, full-frame composition that fills a tall vertical portrait frame top to bottom.`,
    `Mood: warm, positive, hopeful, emotionally authentic, hyper-realistic. Healthy, happy, dignified people in a bright, wholesome everyday setting.`,
    demographic,
    `PROHIBITED CONTENT: nothing morbid or distressing — no death, funerals, coffins, graves, illness, hospitals, injury, blood, or grief.`,
    `PROHIBITED: No text, words, numbers, signs, logos, watermarks, captions, or graphic overlays anywhere in the image.`,
    `STYLE: Hyper-realistic professional photograph. Absolutely NOT an illustration, NOT vector art, NOT a painting, NOT a CGI render, NOT digital art. Real photography only.`,
  ].join(" ");
}

// A guaranteed-safe, wholesome fallback used when a concept is rejected by moderation.
const SAFE_FALLBACK_CONCEPT =
  "a happy, healthy multigenerational family smiling together in a bright, warm living room at home, genuine joyful expressions, cozy and hopeful atmosphere";

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
    quality: "high",
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
      return await generateImageOnce(openai, currentConcept, category, locale);
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

// Presenter corner inset geometry on the 1080×1920 canvas (9:16 source kept by height:-1).
const PRESENTER_INSET_WIDTH = 330;
const PRESENTER_MARGIN_X    = 30;
const PRESENTER_MARGIN_Y    = 40;

// Distribute the presenter clip's total length across scenes, weighted by narration word
// count so background images roughly track the spoken narration. The last scene absorbs any
// rounding remainder so the scene durations sum exactly to the presenter length.
function presenterSceneDurations(scenes: VideoScene[], totalSec: number): number[] {
  const words = scenes.map((s) => Math.max(1, s.narration.trim().split(/\s+/).filter(Boolean).length));
  const totalWords = words.reduce((a, b) => a + b, 0);
  const durations = words.map((w) => Math.max(1, Math.round((totalSec * w) / totalWords)));
  const drift = totalSec - durations.reduce((a, b) => a + b, 0);
  durations[durations.length - 1] = Math.max(1, durations[durations.length - 1] + drift);
  return durations;
}

function buildMovieJson(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number }
) {
  const voice        = elevenLabsVoiceFor(storyboard.voiceLanguage);
  const connection   = process.env.JSON2VIDEO_ELEVENLABS_CONNECTION;
  const bgMusicUrl   = musicUrlForCategory(storyboard.category);
  const usePresenter = Boolean(storyboard.presenter && presenter);
  const sceneDurations = usePresenter
    ? presenterSceneDurations(storyboard.scenes, presenter!.durationSec)
    : [];

  const scenes = storyboard.scenes.map((scene, i) => ({
    elements: [
      // Background image with Ken Burns motion, filling the 9:16 frame for the scene length.
      {
        type:           "image",
        src:            scene.imageUrl,
        // Presenter on → explicit word-weighted duration (no voice element to size the scene);
        // off → -2 matches the scene length driven by the voice element.
        duration:       usePresenter ? sceneDurations[i] : -2,
        resize:         "cover",
        pan:            PAN_DIRECTIONS[i % PAN_DIRECTIONS.length],
        zoom:           2,
        "pan-distance": 0.12,
        "fade-in":      0.4,
        "fade-out":     0.4,
      },
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
  }));

  // Corner placement on the 1080×1920 canvas (9:16 inset → displayed height ≈ width × 16/9).
  const placement  = storyboard.presenterPlacement ?? "bottom-right";
  const presenterX = placement === "bottom-left"
    ? PRESENTER_MARGIN_X
    : 1080 - PRESENTER_INSET_WIDTH - PRESENTER_MARGIN_X;
  const presenterY = 1920 - Math.round((PRESENTER_INSET_WIDTH * 16) / 9) - PRESENTER_MARGIN_Y;

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
            width:       PRESENTER_INSET_WIDTH,
            height:      -1,
            start:       0,
            duration:    presenter!.durationSec,
            "chroma-key": { color: HEYGEN_CHROMA_COLOR, tolerance: 25 },
            "fade-in":   0.4,
            "fade-out":  0.4,
          }]
        : []),
      // Auto-transcribed karaoke captions (Shorts are watched on mute).
      {
        type:     "subtitles",
        language: storyboard.voiceLanguage,
        model:    "default",
        settings: {
          style:                "classic-progressive",
          "font-family":        "Oswald",
          "font-size":          90,
          // mid-bottom-center keeps captions horizontally CENTERED while sitting in the
          // lower-third — raised clear of the platform's bottom UI, not pinned to the edge.
          position:             "mid-bottom-center",
          "word-color":         "#00B4D8",
          "line-color":         "#FFFFFF",
          "outline-color":      "#000000",
          "outline-width":      4,
          "max-words-per-line": 4,
        },
      },
      // Subtle category-matched background music bed (low volume) if configured.
      ...(bgMusicUrl
        ? [{ type: "audio", src: bgMusicUrl, volume: 0.12, "fade-in": 1.0, "fade-out": 1.5 }]
        : []),
    ],
  };

  return movie;
}

export async function submitVideoRender(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number }
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

export async function getVideoRenderStatus(
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
