import type { SocialLocale } from "./types";

// ─── HeyGen AI presenter ──────────────────────────────────────────────────────
// Renders a digital spokesperson (stock avatar now, a custom "Isaac twin" later via
// a single env swap) speaking the Short's narration, lip-synced + bilingual. The clip
// is rendered on a solid GREEN background so JSON2Video can chroma-key it into the
// corner of the Short (see buildMovieJson in video-generator.ts). This module only
// submits + polls the HeyGen render; the composition happens in JSON2Video.
//
// Docs: POST https://api.heygen.com/v2/video/generate  (auth header: x-api-key)
//       GET  https://api.heygen.com/v1/video_status.get?video_id=...

const HEYGEN_GENERATE_URL = "https://api.heygen.com/v2/video/generate";
const HEYGEN_STATUS_URL   = "https://api.heygen.com/v1/video_status.get";

// Solid green the avatar is rendered against; JSON2Video drops this exact color via
// chroma-key. Overridable in case a stock avatar's wardrobe clashes with pure green.
export const HEYGEN_CHROMA_COLOR = process.env.HEYGEN_BACKGROUND_COLOR || "#00FF00";

// Portrait 9:16 to match the Short. Kept modest so the corner inset stays light.
const PRESENTER_WIDTH  = 720;
const PRESENTER_HEIGHT = 1280;

function heygenAvatarFor(locale: SocialLocale): string | undefined {
  return locale === "es"
    ? process.env.HEYGEN_AVATAR_ID_ES || process.env.HEYGEN_AVATAR_ID
    : process.env.HEYGEN_AVATAR_ID;
}

function heygenVoiceFor(locale: SocialLocale): string | undefined {
  return locale === "es"
    ? process.env.HEYGEN_VOICE_ID_ES || process.env.HEYGEN_VOICE_ID_EN
    : process.env.HEYGEN_VOICE_ID_EN;
}

/**
 * Submit a presenter render for the full narration. Returns the HeyGen video id to poll.
 * Throws a clear error if HeyGen isn't configured so the caller can fall back to faceless.
 */
export async function submitPresenterVideo(
  narration: string,
  locale: SocialLocale
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured — disable the presenter toggle to render faceless.");

  const avatarId = heygenAvatarFor(locale);
  if (!avatarId) throw new Error("HEYGEN_AVATAR_ID is not configured — set a stock avatar id (or HEYGEN_AVATAR_ID_ES).");

  const voiceId = heygenVoiceFor(locale);
  if (!voiceId) throw new Error("HEYGEN_VOICE_ID_EN is not configured — set a HeyGen voice id (or HEYGEN_VOICE_ID_ES).");

  const text = narration.trim();
  if (!text) throw new Error("No narration text to send to the presenter.");

  const body = {
    video_inputs: [
      {
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice:     { type: "text", input_text: text, voice_id: voiceId },
        // Solid color background → chroma-keyed out by JSON2Video.
        background: { type: "color", value: HEYGEN_CHROMA_COLOR },
      },
    ],
    dimension: { width: PRESENTER_WIDTH, height: PRESENTER_HEIGHT },
    title: "Isaac Plans — Short presenter",
  };

  const res = await fetch(HEYGEN_GENERATE_URL, {
    method:  "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  const videoId: string | undefined = data?.data?.video_id ?? data?.video_id;
  if (!res.ok || data?.error || !videoId) {
    const detail = data?.error?.message ?? data?.message ?? data?.error ?? "unknown error";
    throw new Error(`HeyGen presenter submit failed (HTTP ${res.status}): ${detail}`);
  }

  return { videoId: String(videoId) };
}

export interface PresenterStatus {
  status: "running" | "done" | "error";
  url?: string;             // HeyGen mp4 URL (green background) when done
  durationSeconds?: number; // presenter clip length — drives the Short's scene timing
  message?: string;
}

/** Poll a HeyGen render. Maps HeyGen statuses onto our running/done/error model. */
export async function getPresenterStatus(videoId: string): Promise<PresenterStatus> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");

  const res = await fetch(`${HEYGEN_STATUS_URL}?video_id=${encodeURIComponent(videoId)}`, {
    headers: { "x-api-key": apiKey },
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`HeyGen status check failed (HTTP ${res.status}): ${data?.message ?? "unknown error"}`);
  }

  const d = (data?.data ?? {}) as Record<string, unknown>;
  const status = String(d.status ?? "processing");

  if (status === "failed") {
    const err = (d.error as Record<string, unknown> | undefined)?.message ?? d.error;
    throw new Error(`HeyGen presenter render failed: ${err ? String(err) : "no detail"}`);
  }

  if (status !== "completed") {
    // pending / waiting / processing
    return { status: "running" };
  }

  const url = d.video_url ? String(d.video_url) : undefined;
  if (!url) throw new Error("HeyGen reported completed but returned no video_url");

  const durationSeconds = typeof d.duration === "number" ? d.duration : undefined;
  return { status: "done", url, durationSeconds };
}
