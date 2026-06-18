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
  locale: SocialLocale,
  opts?: { avatarId?: string; voiceId?: string }
): Promise<{ videoId: string }> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured — disable the presenter toggle to render faceless.");

  // An explicit in-app pick wins; otherwise fall back to the env-configured default.
  const avatarId = opts?.avatarId || heygenAvatarFor(locale);
  if (!avatarId) throw new Error("No HeyGen avatar selected — pick one in the studio or set HEYGEN_AVATAR_ID.");

  const voiceId = opts?.voiceId || heygenVoiceFor(locale);
  if (!voiceId) throw new Error("No HeyGen voice selected — pick one in the studio or set HEYGEN_VOICE_ID_EN.");

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

// ─── Avatar & voice catalogs (for the in-app picker) ─────────────────────────────
// Lists are large and effectively static, so the raw HeyGen responses are cached
// module-level for an hour to avoid re-fetching on every keystroke.

const HEYGEN_AVATARS_URL = "https://api.heygen.com/v2/avatars";
const HEYGEN_VOICES_URL  = "https://api.heygen.com/v2/voices";
const CATALOG_TTL_MS = 60 * 60 * 1000;

export interface HeyGenAvatar {
  avatarId: string;
  name: string;
  gender?: string;
  previewImageUrl?: string;
  previewVideoUrl?: string;
}

export interface HeyGenVoice {
  voiceId: string;
  name: string;
  language?: string;
  gender?: string;
  previewAudio?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let avatarCache: { at: number; data: any[] } | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let voiceCache: { at: number; data: any[] } | null = null;

async function fetchHeyGen(url: string): Promise<unknown> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error("HEYGEN_API_KEY is not configured");
  const res = await fetch(url, { headers: { "x-api-key": apiKey } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(`HeyGen request failed (HTTP ${res.status}): ${(data as any)?.message ?? "unknown error"}`);
  }
  return data;
}

export async function listHeyGenAvatars(
  search?: string,
  gender?: string,
  offset = 0,
  limit = 40
): Promise<{ avatars: HeyGenAvatar[]; total: number }> {
  if (!avatarCache || Date.now() - avatarCache.at > CATALOG_TTL_MS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await fetchHeyGen(HEYGEN_AVATARS_URL)) as any;
    avatarCache = { at: Date.now(), data: Array.isArray(data?.data?.avatars) ? data.data.avatars : [] };
  }

  const q = (search ?? "").trim().toLowerCase();
  const g = (gender ?? "").trim().toLowerCase();

  // Filter the full (cached) list, then return only the requested page — the heavy list
  // never leaves the server, so the client only ever holds one page at a time.
  const filtered = avatarCache.data.filter((a: Record<string, unknown>) => {
    const name = String(a.avatar_name ?? "").toLowerCase();
    if (q && !name.includes(q) && !String(a.avatar_id ?? "").toLowerCase().includes(q)) return false;
    if (g && String(a.gender ?? "").toLowerCase() !== g) return false;
    return true;
  });

  const safeOffset = Math.max(0, offset);
  const avatars = filtered
    .slice(safeOffset, safeOffset + limit)
    .map((a: Record<string, unknown>): HeyGenAvatar => ({
      avatarId:        String(a.avatar_id),
      name:            String(a.avatar_name ?? a.avatar_id),
      gender:          a.gender ? String(a.gender) : undefined,
      previewImageUrl: a.preview_image_url ? String(a.preview_image_url) : undefined,
      previewVideoUrl: a.preview_video_url ? String(a.preview_video_url) : undefined,
    }));

  return { avatars, total: filtered.length };
}

export async function listHeyGenVoices(
  opts: { language?: string; gender?: string; search?: string; limit?: number } = {}
): Promise<{ voices: HeyGenVoice[]; languages: string[] }> {
  if (!voiceCache || Date.now() - voiceCache.at > CATALOG_TTL_MS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await fetchHeyGen(HEYGEN_VOICES_URL)) as any;
    voiceCache = { at: Date.now(), data: Array.isArray(data?.data?.voices) ? data.data.voices : [] };
  }

  const lang = (opts.language ?? "").trim().toLowerCase();
  const g    = (opts.gender ?? "").trim().toLowerCase();
  const q    = (opts.search ?? "").trim().toLowerCase();

  // Distinct languages across the whole catalog → powers the language dropdown.
  const languages = Array.from(
    new Set(voiceCache.data.map((v: Record<string, unknown>) => String(v.language ?? "").trim()).filter(Boolean))
  ).sort();

  const voices = voiceCache.data
    .filter((v: Record<string, unknown>) => {
      if (lang && String(v.language ?? "").toLowerCase() !== lang) return false;
      if (g && String(v.gender ?? "").toLowerCase() !== g) return false;
      if (q && !String(v.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    })
    .slice(0, opts.limit ?? 300)
    .map((v: Record<string, unknown>): HeyGenVoice => ({
      voiceId:      String(v.voice_id),
      name:         String(v.name ?? v.voice_id),
      language:     v.language ? String(v.language) : undefined,
      gender:       v.gender ? String(v.gender) : undefined,
      previewAudio: v.preview_audio ? String(v.preview_audio) : undefined,
    }));

  return { voices, languages };
}
