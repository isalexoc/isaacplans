import cloudinary from "@/config/cloudinary";
import type { SocialLocale } from "./types";

// ─── Decoupled voiceover (ElevenLabs direct) ──────────────────────────────────────
// Render-engine-independent narration so the video pipeline isn't tied to any one render
// vendor's bundled TTS. One ElevenLabs call synthesizes the whole narration, re-hosted on
// Cloudinary. Captions are NOT produced here — the render engine (Shotstack rich-caption)
// auto-transcribes this audio so subtitles always match the spoken language.

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── ElevenLabs TTS → mp3 bytes ──
// Retries on 429 (incl. concurrent_limit_exceeded) and transient 5xx with backoff + jitter.
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

/** Synthesize a full narration in one call → hosted audio + measured duration. */
export async function synthesizeNarration(
  text: string,
  locale: SocialLocale,
  category: string
): Promise<{ audioUrl: string; durationSec: number }> {
  const bytes = await synthesizeBytes(text, locale);
  const { url, durationSec } = await uploadAudio(bytes, category);
  // Fall back to a word-rate estimate (~2.5 words/sec) if Cloudinary returns no duration.
  const dur = durationSec || Math.max(1, text.trim().split(/\s+/).filter(Boolean).length / 2.5);
  return { audioUrl: url, durationSec: dur };
}
