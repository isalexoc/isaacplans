/**
 * Env-driven settings for the CrankWheel screen-share API.
 *
 * CrankWheel's own in-page CRM button does not render on LeadConnector custom domains, so the
 * agent cannot start a share from a contact page. This integration moves that button into our app
 * instead, where the domain is ours and the problem does not exist.
 *
 * Auth is unusual and worth stating: the API key is sent as `Authorization: Basic <key>` with the
 * key **raw**. It is not base64 of `user:pass`, so never run it through `btoa`.
 */

export type CrankwheelConfig = {
  /** Read/write key — required to mint or delete a meeting link. */
  writeKey: string | null;
  /** Read-only key — enough for usage history. Falls back to the write key. */
  readKey: string | null;
  /** The presenter every link belongs to. Must be a user on the CrankWheel account. */
  presenterEmail: string;
  /** API origin. Meeting links resolve elsewhere; this is only for /ss/api calls. */
  apiBase: string;
  /**
   * How long after minting a "meet now" link the session must START for the link to skip the
   * number handshake. Not how long the client has to click — see `createNoauthLink`.
   */
  noauthWindowSeconds: number;
};

const DEFAULT_API_BASE = "https://meeting.is";
const DEFAULT_PRESENTER = "isaac@isaacplans.com";
/** 15 minutes: long enough to finish dialling and start sharing, short enough to bound reuse. */
const DEFAULT_NOAUTH_WINDOW_SECONDS = 900;

export function getCrankwheelConfig(): CrankwheelConfig {
  const writeKey = process.env.CRANKWHEEL_API_KEY_READ_AND_WRITE?.trim() || null;
  const parsedWindow = Number(process.env.CRANKWHEEL_NOAUTH_WINDOW_SECONDS);
  return {
    writeKey,
    // A read-only key is preferable for reads, but the write key can do everything it can.
    readKey: process.env.CRANKWHEEL_API_KEY_READ_ONLY?.trim() || writeKey,
    presenterEmail: process.env.CRANKWHEEL_PRESENTER_EMAIL?.trim() || DEFAULT_PRESENTER,
    apiBase: (process.env.CRANKWHEEL_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/+$/, ""),
    noauthWindowSeconds:
      Number.isFinite(parsedWindow) && parsedWindow > 0
        ? Math.floor(parsedWindow)
        : DEFAULT_NOAUTH_WINDOW_SECONDS,
  };
}

/** True when links can be minted. Reads alone need only `readKey`. */
export function isCrankwheelConfigured(config: CrankwheelConfig = getCrankwheelConfig()): boolean {
  return Boolean(config.writeKey);
}

/**
 * Absolute base URL CrankWheel should call our hooks on.
 *
 * These are inbound calls from CrankWheel's servers, so unlike most URLs in this app it must be a
 * publicly resolvable https origin — `localhost` is accepted by the API and then silently never
 * called, which is why local runs simply get no live "client joined" badge.
 *
 * Prefers an explicit override, then the URL QStash already calls back on (same requirement, same
 * answer), then the public site URL.
 */
export function getCrankwheelHookBaseUrl(): string | null {
  const candidate =
    process.env.CRANKWHEEL_HOOK_BASE_URL?.trim() ||
    process.env.QSTASH_TARGET_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!candidate) return null;
  const base = candidate.replace(/\/+$/, "");
  return base.startsWith("https://") ? base : null;
}

/** The URL CrankWheel GETs for one lifecycle event of one meeting. */
export function buildCrankwheelHookUrl(
  hookSecret: string,
  event: "created" | "viewer"
): string | null {
  const base = getCrankwheelHookBaseUrl();
  return base ? `${base}/api/crankwheel/hook/${hookSecret}/${event}` : null;
}
