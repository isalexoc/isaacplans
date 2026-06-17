import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import type {
  SocialPostSource,
  SocialCreativeImages,
  VideoScript,
  VideoScene,
  VideoStoryboard,
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
- Output ONLY valid JSON: { "scenes": [ { "narration": string, "onScreenText": string } ] }.
- "narration" is the exact words the voiceover will SPEAK for that scene — natural spoken sentences only. NO timestamps, NO stage directions, NO brackets, NO emojis, NO hashtags.
- "onScreenText" is a SHORT punchy caption/headline (max ~6 words) burned on screen for that scene. Title Case. No ending period.
- The FIRST scene must be a scroll-stopping hook.
- Keep total narration tight so the whole video fits the target duration when spoken at a natural pace (~2.5 words/second).
- Write narration in the SAME language as the source script (English or Spanish).
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
  images: SocialCreativeImages,
  locale?: SocialLocale
): Promise<VideoStoryboard> {
  const voiceLanguage: SocialLocale = locale ?? source.locale ?? "en";
  const sceneCount = videoScript.duration === 60 ? 6 : 4;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model:           process.env.OPENAI_MODEL ?? "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STORYBOARD_SYSTEM_PROMPT },
      { role: "user",   content: buildStoryboardUserPrompt(source, videoScript, sceneCount) },
    ],
    max_tokens:  1500,
    temperature: 0.7,
  });

  const raw = JSON.parse(completion.choices[0].message.content ?? "{}");
  const rawScenes: unknown[] = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (rawScenes.length === 0) throw new Error("AI returned no storyboard scenes");

  // The branded card images already have text burned in, which would clash with the
  // subtitles/headline. Prefer the raw (overlay-free) source image as the background for
  // every scene, varying Ken Burns motion per scene for visual movement.
  const baseImage = images.sourceImageUrl || images.vertical || images.square;
  if (!baseImage) throw new Error("No image available to build the video. Generate images first.");

  const scenes: VideoScene[] = rawScenes.map((s) => {
    const o = s as Record<string, unknown>;
    return {
      narration:    String(o.narration ?? "").trim(),
      onScreenText: String(o.onScreenText ?? "").trim(),
      imageUrl:     baseImage,
    };
  }).filter((s) => s.narration.length > 0);

  if (scenes.length === 0) throw new Error("Storyboard produced no usable narration");

  return { scenes, voiceLanguage, durationSeconds: videoScript.duration };
}

// ─── Step 2: Build JSON2Video movie + submit render ──────────────────────────────

// Ken Burns motion directions cycled per scene so a single background image still feels alive.
const PAN_DIRECTIONS = ["top-left", "bottom-right", "top-right", "bottom-left", "left", "right"] as const;

function buildMovieJson(storyboard: VideoStoryboard) {
  const voice       = elevenLabsVoiceFor(storyboard.voiceLanguage);
  const connection  = process.env.JSON2VIDEO_ELEVENLABS_CONNECTION;
  const bgMusicUrl  = process.env.JSON2VIDEO_BG_MUSIC_URL;

  const scenes = storyboard.scenes.map((scene, i) => ({
    elements: [
      // Background image with Ken Burns motion, filling the 9:16 frame for the scene length.
      {
        type:           "image",
        src:            scene.imageUrl,
        duration:       -2, // match the scene length (driven by the voice element)
        resize:         "cover",
        pan:            PAN_DIRECTIONS[i % PAN_DIRECTIONS.length],
        zoom:           2,
        "pan-distance": 0.12,
        "fade-in":      0.4,
        "fade-out":     0.4,
      },
      // ElevenLabs voiceover — its natural length defines the scene duration.
      {
        type:    "voice",
        text:    scene.narration,
        model:   "elevenlabs",
        voice,
        ...(connection ? { connection } : {}),
      },
      // On-screen headline (distinct from the bottom karaoke subtitles).
      // JSON2Video requires text styling to live inside a `settings` object.
      ...(scene.onScreenText
        ? [{
            type:     "text",
            text:     scene.onScreenText,
            duration: -2,
            settings: {
              "font-family":         "Oswald",
              "font-size":           "64px",
              "font-color":          "#FFFFFF",
              "vertical-position":   "top",
              "horizontal-position": "center",
              "text-align":          "center",
            },
          }]
        : []),
    ],
  }));

  const movie: Record<string, unknown> = {
    resolution: "custom",
    width:      1080,
    height:     1920,
    quality:    "high",
    scenes,
    elements: [
      // Auto-transcribed karaoke captions (Shorts are watched on mute).
      {
        type:     "subtitles",
        language: storyboard.voiceLanguage,
        model:    "default",
        settings: {
          style:                "classic-progressive",
          "font-family":        "Oswald",
          "font-size":          90,
          position:             "bottom-center",
          "word-color":         "#00B4D8",
          "line-color":         "#FFFFFF",
          "outline-color":      "#000000",
          "outline-width":      4,
          "max-words-per-line": 4,
        },
      },
      // Optional background music bed (low volume) if configured.
      ...(bgMusicUrl
        ? [{ type: "audio", src: bgMusicUrl, volume: 0.12, "fade-out": 1.5 }]
        : []),
    ],
  };

  return movie;
}

export async function submitVideoRender(
  storyboard: VideoStoryboard
): Promise<{ projectId: string }> {
  const apiKey = process.env.JSON2VIDEO_API_KEY;
  if (!apiKey) throw new Error("JSON2VIDEO_API_KEY is not configured");

  const movie = buildMovieJson(storyboard);

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
