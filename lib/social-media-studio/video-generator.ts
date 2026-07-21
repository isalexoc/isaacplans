import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { getDemographicHint, pickVariationMood } from "./image-generator";
import { musicUrlForCategory } from "./video-music";
import { HEYGEN_CHROMA_COLOR } from "./heygen-presenter";
import { synthesizeNarration } from "./voiceover";
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
- Write narration AND onScreenText in the TARGET LANGUAGE stated in the user message — if the source script is in a different language, TRANSLATE it into the target language. imageConcept is ALWAYS in English (it prompts an image model), regardless of the target language.
- Do not mention you are an AI. Do not add a disclaimer.`;

function buildStoryboardUserPrompt(
  source: SocialPostSource,
  videoScript: VideoScript,
  sceneCount: number,
  voiceLanguage: SocialLocale
): string {
  const langName = voiceLanguage === "es" ? "Spanish (Español)" : "English";
  return [
    `TARGET LANGUAGE: ${langName}. Write EVERY "narration" and "onScreenText" value in ${langName} — translate the script below if it is in another language. ("imageConcept" stays in English.)`,
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
      { role: "user",   content: buildStoryboardUserPrompt(source, videoScript, sceneCount, voiceLanguage) },
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

// Presenter geometry on the 1080×1920 canvas (9:16 source scaled by width; height:-1 keeps
// the aspect). The figure is LARGE and anchored low so its lower body runs off the bottom of
// the frame — it reads like a person standing in the corner, not a small floating cut-out box.
const PRESENTER_WIDTH_PX   = 600;  // displayed width (≈ 1067 tall at 9:16) — prominent
const PRESENTER_TOP_Y      = 980;  // clip top → head lands in the lower third; bottom is cropped
const PRESENTER_EDGE_BLEED = 120;  // pull the figure toward the screen edge so it hugs the side

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
  const bgMusicUrl   = storyboard.musicUrl || musicUrlForCategory(storyboard.category);
  const usePresenter = Boolean(storyboard.presenter && presenter);
  const sceneDurations = usePresenter
    ? presenterSceneDurations(storyboard.scenes, presenter!.durationSec)
    : [];

  const cinematic = Boolean(storyboard.cinematic);

  const scenes = storyboard.scenes.map((scene, i) => {
    // Presenter on → explicit word-weighted duration; off → -2 matches the voice-driven scene.
    const sceneDuration = usePresenter ? sceneDurations[i] : -2;

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
      },
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

async function submitShotstackRender(
  storyboard: VideoStoryboard,
  presenter?: { url: string; durationSec: number }
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

  const durations = presenterSceneDurations(storyboard.scenes, totalAudioSec);
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
        chromaColor: HEYGEN_CHROMA_COLOR,
        placement:   storyboard.presenterPlacement === "bottom-right" ? "bottom-right" : "bottom-left",
        scale:       PRESENTER_SCALE,
      }
    : undefined;

  const plan: RenderPlan = {
    width:          VIDEO_WIDTH,
    height:         VIDEO_HEIGHT,
    fps:            VIDEO_FPS,
    scenes,
    narrationAudio,
    presenter:      presenterPlan,
    musicUrl:       storyboard.musicUrl || musicUrlForCategory(category),
    captions:       true,
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
  presenter?: { url: string; durationSec: number }
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
