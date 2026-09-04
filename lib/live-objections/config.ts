import "server-only";

/**
 * Settings for live objection detection (ElevenLabs Scribe v2 Realtime speech-to-text).
 *
 * Sibling of lib/call-study/config.ts, which owns the BATCH side of the same vendor. They share
 * one API key and nothing else: the model ids are different and NOT interchangeable
 * (`scribe_v2` batch vs `scribe_v2_realtime` live), call-study owns a duration cost-guard that is
 * meaningless for a socket, and this module is the only one that mints browser-facing tokens.
 *
 * The key never reaches the browser. The browser gets a 15-minute single-use token instead,
 * exactly as it gets a short-lived Cloudinary signature in app/api/admin/call-study/sign/route.ts.
 */

export type LiveObjectionsConfig = {
  apiKey: string | null;
  /** Off unless explicitly switched on: this one opens a live audio stream to a paid vendor. */
  enabled: boolean;
  model: string;
  /** Verified: POST https://api.elevenlabs.io/v1/single-use-token/{token_type}. */
  tokenUrl: string;
  wsUrl: string;
  /**
   * Hard cap on one listening session. Billing follows audio, and we stream silence to hold the
   * socket open, so an open socket bills wall-clock. A session forgotten overnight is the only
   * way this feature runs up a bill, and this is the ceiling that stops it.
   */
  maxSessionMinutes: number;
};

const DEFAULT_MODEL = "scribe_v2_realtime";
const DEFAULT_TOKEN_URL = "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe";
const DEFAULT_WS_URL = "wss://api.elevenlabs.io/v1/speech-to-text/realtime";
const DEFAULT_MAX_SESSION_MINUTES = 60;

export function getLiveObjectionsConfig(): LiveObjectionsConfig {
  const parsedMax = Number(process.env.LIVE_OBJECTIONS_MAX_SESSION_MINUTES);
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
    enabled: process.env.LIVE_OBJECTIONS_ENABLED === "true",
    model: process.env.ELEVENLABS_REALTIME_STT_MODEL?.trim() || DEFAULT_MODEL,
    tokenUrl: process.env.ELEVENLABS_REALTIME_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL,
    wsUrl: process.env.ELEVENLABS_REALTIME_STT_URL?.trim() || DEFAULT_WS_URL,
    maxSessionMinutes:
      Number.isFinite(parsedMax) && parsedMax > 0
        ? Math.floor(parsedMax)
        : DEFAULT_MAX_SESSION_MINUTES,
  };
}

/** Both must hold: a key to mint tokens with, and the flag deliberately switched on. */
export function isLiveObjectionsConfigured(
  config: LiveObjectionsConfig = getLiveObjectionsConfig()
): boolean {
  return Boolean(config.apiKey) && config.enabled;
}
