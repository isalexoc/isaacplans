import cloudinary from "@/config/cloudinary";
import { moodForCategory, MUSIC_MOOD_PROMPT } from "./video-music";

// ─── ElevenLabs Music background track (category-matched) ─────────────────────────
// Generates a subtle instrumental bed whose mood matches the post's insurance category,
// then re-hosts the mp3 on Cloudinary so JSON2Video can stream it as the audio bed.
// Synchronous: ElevenLabs returns the rendered audio bytes directly (no submit/poll).
//
// REST: POST https://api.elevenlabs.io/v1/music  (header: xi-api-key) → audio/mpeg bytes
//
// Needs a DIRECT key: the voiceover runs through JSON2Video's managed ElevenLabs
// connection, but the Music API is called from our server with ELEVENLABS_API_KEY.

const ELEVENLABS_MUSIC_URL = "https://api.elevenlabs.io/v1/music";

// ElevenLabs Music accepts 10s–5min; clamp our 30/60s targets into that window.
const MIN_MS = 10_000;
const MAX_MS = 300_000;

export async function generateCategoryMusic(opts: {
  category?: string;
  durationSeconds: number;
}): Promise<{ musicUrl: string }> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not configured — the Music API needs a direct ElevenLabs key.");
  }

  const prompt = MUSIC_MOOD_PROMPT[moodForCategory(opts.category)];
  const lengthMs = Math.min(MAX_MS, Math.max(MIN_MS, Math.round((opts.durationSeconds || 30) * 1000)));

  const res = await fetch(ELEVENLABS_MUSIC_URL, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      prompt,
      music_length_ms: lengthMs,
      model_id: "music_v1",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs Music failed (HTTP ${res.status}): ${detail.slice(0, 300) || "unknown error"}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());

  const musicUrl = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `social-media/${opts.category ?? "general"}/music`, resource_type: "video" },
      (err, result) => (err || !result ? reject(err ?? new Error("Cloudinary upload failed")) : resolve(result.secure_url))
    );
    stream.end(bytes);
  });

  return { musicUrl };
}
