/**
 * Env-driven settings for Upstash QStash (event-driven background jobs).
 *
 * QStash replaces frequent Neon-polling crons: instead of a cron waking the
 * database every few minutes, we publish a message when there is real work and
 * QStash calls us back (with built-in retries + delayed delivery). This keeps
 * Neon idle — and therefore cheap — when nothing is happening.
 *
 * See QSTASH_SETUP.md.
 */

export type QStashConfig = {
  /** Master switch. When false, callers fall back to the legacy kick/cron path. */
  enabled: boolean;
  /** Publish token (Upstash console → QStash). */
  token: string | null;
  /** Region-specific QStash service endpoint, e.g. https://qstash-us-east-1.upstash.io. */
  url: string | null;
  /** Receiver verification keys (Upstash-Signature). */
  currentSigningKey: string | null;
  nextSigningKey: string | null;
  /**
   * Public base URL QStash calls back to, e.g. https://www.isaacplans.com.
   * Falls back to the inbound request origin when unset.
   */
  targetBaseUrl: string | null;
};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

export function getQStashConfig(): QStashConfig {
  return {
    enabled: parseBool(process.env.QSTASH_ENABLED, false),
    token: process.env.QSTASH_TOKEN?.trim() || null,
    url: process.env.QSTASH_URL?.trim().replace(/\/$/, "") || null,
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY?.trim() || null,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY?.trim() || null,
    targetBaseUrl: process.env.QSTASH_TARGET_BASE_URL?.trim().replace(/\/$/, "") || null,
  };
}

/** True when QStash can publish (enabled + token present). */
export function isQStashPublishConfigured(config: QStashConfig = getQStashConfig()): boolean {
  return Boolean(config.enabled && config.token);
}

/** True when inbound QStash deliveries can be verified (signing keys present). */
export function isQStashReceiveConfigured(config: QStashConfig = getQStashConfig()): boolean {
  return Boolean(config.currentSigningKey && config.nextSigningKey);
}

/**
 * Resolve the absolute base URL QStash should call back. Prefers the configured
 * production URL (so preview deployments never receive prod traffic); otherwise
 * uses the inbound request origin.
 */
export function resolveTargetBaseUrl(requestOrigin?: string): string | null {
  const config = getQStashConfig();
  return config.targetBaseUrl || requestOrigin?.replace(/\/$/, "") || null;
}
