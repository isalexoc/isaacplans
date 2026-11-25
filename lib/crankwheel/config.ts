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
  /**
   * What a meeting minted with this config stores in `crankwheel_meetings.presenter_email`: the
   * `CRANKWHEEL_PRESENTERS` entry's email, or null for Isaac's own account (the env defaults).
   */
  storedPresenter: string | null;
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

type Env = Record<string, string | undefined>;

/** Settings every account shares: where the API lives and the "meet now" window. */
function sharedSettings(env: Env): Pick<CrankwheelConfig, "apiBase" | "noauthWindowSeconds"> {
  const parsedWindow = Number(env.CRANKWHEEL_NOAUTH_WINDOW_SECONDS);
  return {
    apiBase: (env.CRANKWHEEL_API_BASE?.trim() || DEFAULT_API_BASE).replace(/\/+$/, ""),
    noauthWindowSeconds:
      Number.isFinite(parsedWindow) && parsedWindow > 0
        ? Math.floor(parsedWindow)
        : DEFAULT_NOAUTH_WINDOW_SECONDS,
  };
}

/** Isaac's own account: the `CRANKWHEEL_*` env defaults. */
export function getCrankwheelConfig(env: Env = process.env): CrankwheelConfig {
  const writeKey = env.CRANKWHEEL_API_KEY_READ_AND_WRITE?.trim() || null;
  return {
    writeKey,
    // A read-only key is preferable for reads, but the write key can do everything it can.
    readKey: env.CRANKWHEEL_API_KEY_READ_ONLY?.trim() || writeKey,
    presenterEmail: env.CRANKWHEEL_PRESENTER_EMAIL?.trim() || DEFAULT_PRESENTER,
    storedPresenter: null,
    ...sharedSettings(env),
  };
}

/**
 * Another agent's own CrankWheel account (Ysmael, for Legal Shield), from `CRANKWHEEL_PRESENTERS`:
 * a JSON array of `{ "userId", "email", "writeKey", "readKey"? }`, one per agent, keyed by Clerk
 * user id.
 *
 * Each agent gets a separate ACCOUNT, not a seat on Isaac's (Isaac's decision, 2026-11-24): its own
 * billing, meeting history and keys. CrankWheel's spec says `truncate_older_links` only ends the
 * same presenter's older links, so a seat would likely work too; `sameAccountPresenters` treats a
 * shared account conservatively either way.
 */
export type CrankwheelPresenter = { userId: string; email: string; writeKey: string; readKey: string | null };

/** The valid entries of `CRANKWHEEL_PRESENTERS`; a malformed value or entry is ignored, never guessed. */
export function parsePresenters(raw: string | undefined | null): CrankwheelPresenter[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[CRANKWHEEL] CRANKWHEEL_PRESENTERS is not valid JSON; no agent accounts loaded.");
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CrankwheelPresenter[] = [];
  for (const entry of parsed) {
    const e = entry as Record<string, unknown> | null;
    const userId = typeof e?.userId === "string" ? e.userId.trim() : "";
    const email = typeof e?.email === "string" ? e.email.trim() : "";
    const writeKey = typeof e?.writeKey === "string" ? e.writeKey.trim() : "";
    const readKey = typeof e?.readKey === "string" && e.readKey.trim() ? e.readKey.trim() : null;
    if (userId && email && writeKey) out.push({ userId, email, writeKey, readKey });
  }
  return out;
}

function presenterConfig(p: CrankwheelPresenter, env: Env): CrankwheelConfig {
  return {
    writeKey: p.writeKey,
    readKey: p.readKey ?? p.writeKey,
    presenterEmail: p.email,
    storedPresenter: p.email,
    ...sharedSettings(env),
  };
}

/**
 * The account a staff user mints links on: their own `CRANKWHEEL_PRESENTERS` entry, else Isaac's
 * account for the admin. Null for anyone else: a scoped agent without an entry gets an error, and
 * is NEVER put on Isaac's account (his presenter is the one sharing Isaac's screen).
 */
export function crankwheelConfigForUser(
  user: { userId: string; isAdmin: boolean },
  env: Env = process.env
): CrankwheelConfig | null {
  const own = parsePresenters(env.CRANKWHEEL_PRESENTERS).find((p) => p.userId === user.userId);
  if (own) return presenterConfig(own, env);
  return user.isAdmin ? getCrankwheelConfig(env) : null;
}

/**
 * The account a stored meeting was minted on, for revoking it and reading its usage: Isaac's when
 * the row has no presenter, else that presenter's entry. Null when the entry is gone from the env:
 * the caller skips the row rather than asking the wrong account about it.
 */
export function crankwheelConfigForPresenter(
  presenterEmail: string | null,
  env: Env = process.env
): CrankwheelConfig | null {
  if (!presenterEmail) return getCrankwheelConfig(env);
  const wanted = presenterEmail.trim().toLowerCase();
  const entry = parsePresenters(env.CRANKWHEEL_PRESENTERS).find((p) => p.email.toLowerCase() === wanted);
  return entry ? presenterConfig(entry, env) : null;
}

/**
 * Whose stored "meet now" links a new one on this account ends, i.e. the reach of
 * `truncate_older_links`: every presenter entry with the same write key, plus Isaac's rows (null
 * presenter) when his env key is that key too.
 */
export function sameAccountPresenters(
  config: CrankwheelConfig,
  env: Env = process.env
): { emails: string[]; includesDefault: boolean } {
  if (!config.writeKey) return { emails: [], includesDefault: false };
  const emails = parsePresenters(env.CRANKWHEEL_PRESENTERS)
    .filter((p) => p.writeKey === config.writeKey)
    .map((p) => p.email);
  const includesDefault = getCrankwheelConfig(env).writeKey === config.writeKey;
  return { emails, includesDefault };
}

/** True when links can be minted. Reads alone need only `readKey`. */
export function isCrankwheelConfigured(config: CrankwheelConfig): boolean {
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
