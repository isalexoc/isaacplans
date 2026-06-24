import cloudinary from "@/config/cloudinary";
import type { SocialLocale } from "./types";

// ─── Decoupled voiceover + captions ──────────────────────────────────────────────
// Render-engine-independent media prep so the video pipeline isn't tied to any one
// render vendor's bundled TTS/captions:
//   • Voiceover  → ElevenLabs Text-to-Speech (direct, pay-per-character), re-hosted on Cloudinary.
//   • Captions   → OpenAI Whisper word-level timestamps grouped into short karaoke-style lines.
// Both run on OUR keys (ELEVENLABS_API_KEY, OPENAI_API_KEY) with no per-render quota.

const ELEVENLABS_TTS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// Direct ElevenLabs TTS requires a VOICE ID (not a name like "Rachel"). Defaults to the
// public "Rachel" voice id; override per-locale with ELEVENLABS_TTS_VOICE_ID_EN / _ES.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

function ttsVoiceId(locale: SocialLocale): string {
  if (locale === "es") {
    return process.env.ELEVENLABS_TTS_VOICE_ID_ES || process.env.ELEVENLABS_TTS_VOICE_ID_EN || DEFAULT_VOICE_ID;
  }
  return process.env.ELEVENLABS_TTS_VOICE_ID_EN || DEFAULT_VOICE_ID;
}

/** A caption line, timed relative to the START of its scene's audio (seconds). */
export interface CaptionCue {
  text:  string;
  start: number;
  end:   number;
}

/** A scene's synthesized narration: hosted audio + its exact length + word-timed captions. */
export interface SceneVoiceover {
  audioUrl:    string;
  durationSec: number;
  captions:    CaptionCue[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── ElevenLabs TTS → mp3 bytes ──
// Retries on 429 (incl. concurrent_limit_exceeded — most plans allow only 2–3 parallel
// requests) and transient 5xx, with backoff + jitter, so the per-scene batch self-heals.
async function synthesizeBytes(text: string, locale: SocialLocale): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not configured — direct voiceover needs an ElevenLabs key.");

  const voiceId = ttsVoiceId(locale);
  const modelId = process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2";
  const url     = `${ELEVENLABS_TTS_BASE}/${voiceId}?output_format=mp3_44100_128`;
  const body    = JSON.stringify({
    text,
    model_id:       modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
  });

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      method:  "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());

    const detail = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS - 1) {
      // 429 concurrency clears in well under a second; back off with a little jitter.
      await sleep(1200 * (attempt + 1) + Math.floor(Math.random() * 400));
      continue;
    }
    throw new Error(`ElevenLabs TTS failed (HTTP ${res.status}): ${detail.slice(0, 300) || "unknown error"}`);
  }
  throw new Error("ElevenLabs TTS failed after retries");
}

// ── Cloudinary upload (audio stored as a video resource) → url + duration ──
async function uploadAudio(bytes: Buffer, category: string): Promise<{ url: string; durationSec: number }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `social-media/${category}/voiceover`, resource_type: "video" },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary audio upload failed"));
        const durationSec = (result as unknown as { duration?: number }).duration ?? 0;
        resolve({ url: result.secure_url, durationSec });
      }
    );
    stream.end(bytes);
  });
}

// ── Whisper word-level timestamps (whisper-1 is required for word granularity) ──
interface WhisperWord { word: string; start: number; end: number }

async function transcribeWords(bytes: Buffer, locale: SocialLocale): Promise<WhisperWord[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "scene.mp3");
  form.append("model", "whisper-1"); // word timestamps require whisper-1, not gpt-4o-transcribe
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("language", locale);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method:  "POST",
    headers: { Authorization: `Bearer ${key}` },
    body:    form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Whisper failed (HTTP ${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { words?: WhisperWord[] };
  return Array.isArray(json.words) ? json.words : [];
}

// Group words into short caption lines (≈ maxWords each), timed to the spoken words.
function wordsToCaptions(words: WhisperWord[], maxWords = 4): CaptionCue[] {
  const cues: CaptionCue[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords);
    const text  = chunk.map((w) => w.word).join(" ").replace(/\s+([,.!?])/g, "$1").trim();
    if (!text) continue;
    cues.push({ text, start: chunk[0].start, end: chunk[chunk.length - 1].end });
  }
  return cues;
}

/** Synthesize one scene's narration → hosted audio + word-timed captions. */
export async function synthesizeSceneVoiceover(
  narration: string,
  locale: SocialLocale,
  category: string
): Promise<SceneVoiceover> {
  const bytes = await synthesizeBytes(narration, locale);

  // Caption transcription is best-effort — a failure here must not block the render.
  const [{ url, durationSec }, words] = await Promise.all([
    uploadAudio(bytes, category),
    transcribeWords(bytes, locale).catch((e) => {
      console.warn("[voiceover] caption transcription failed:", (e as Error).message);
      return [] as WhisperWord[];
    }),
  ]);

  // Prefer Cloudinary's measured duration; fall back to the last word end, then a word-rate estimate.
  const dur =
    durationSec ||
    (words.length ? words[words.length - 1].end : Math.max(1, narration.trim().split(/\s+/).length / 2.5));

  const captions = wordsToCaptions(words).map((c) => ({
    text:  c.text,
    start: Math.min(c.start, dur),
    end:   Math.min(c.end, dur),
  }));

  return { audioUrl: url, durationSec: dur, captions };
}

/** Transcribe an already-hosted audio/video URL (e.g. a HeyGen presenter clip) → captions. Best-effort. */
export async function captionsFromUrl(url: string, locale: SocialLocale): Promise<CaptionCue[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    return wordsToCaptions(await transcribeWords(bytes, locale));
  } catch (e) {
    console.warn("[voiceover] URL caption transcription failed:", (e as Error).message);
    return [];
  }
}
