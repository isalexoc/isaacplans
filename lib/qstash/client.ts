/**
 * QStash publish client (singleton) + small helpers.
 *
 * `publishJob` no-ops (returns null) whenever QStash is disabled or unconfigured,
 * so callers can safely keep their legacy fallback path behind the same call.
 */
import { Client } from "@upstash/qstash";
import {
  getQStashConfig,
  isQStashPublishConfigured,
  resolveTargetBaseUrl,
} from "./config";

let client: Client | null = null;

function getClient(): Client | null {
  const config = getQStashConfig();
  if (!config.token) return null;
  if (!client) {
    // Pin to the region-specific endpoint (QSTASH_URL) so a region token isn't
    // sent to the default global URL.
    client = new Client({ token: config.token, ...(config.url ? { baseUrl: config.url } : {}) });
  }
  return client;
}

export type PublishJobInput = {
  /** App path QStash should call back, e.g. "/api/queue/kixie-call-summary". */
  path: string;
  /** JSON body delivered to the endpoint. */
  body: Record<string, unknown>;
  /** Relative delay in seconds (mutually exclusive with notBefore). */
  delaySeconds?: number;
  /** Absolute delivery time as a Unix timestamp in seconds. */
  notBefore?: number;
  /** Max QStash retries on 5xx (QStash applies its own backoff). Default 3. */
  retries?: number;
  /** Inbound request origin, used when QSTASH_TARGET_BASE_URL is unset. */
  requestOrigin?: string;
};

/**
 * Publish a job to QStash. Returns the QStash messageId on success, or null when
 * QStash is disabled/unconfigured or the target URL cannot be resolved (caller
 * should fall back to its legacy path in that case).
 */
export async function publishJob(input: PublishJobInput): Promise<string | null> {
  if (!isQStashPublishConfigured()) return null;

  const baseUrl = resolveTargetBaseUrl(input.requestOrigin);
  if (!baseUrl) {
    console.error("[qstash] No target base URL resolved; cannot publish", { path: input.path });
    return null;
  }

  const qstash = getClient();
  if (!qstash) return null;

  try {
    const res = await qstash.publishJSON({
      url: `${baseUrl}${input.path}`,
      body: input.body,
      retries: input.retries ?? 3,
      ...(input.notBefore !== undefined ? { notBefore: input.notBefore } : {}),
      ...(input.delaySeconds !== undefined ? { delay: input.delaySeconds } : {}),
    });
    const messageId = Array.isArray(res) ? res[0]?.messageId : res.messageId;
    return messageId ?? null;
  } catch (err) {
    console.error("[qstash] publishJob failed", { path: input.path, error: err });
    return null;
  }
}

/** Cancel a previously scheduled QStash message. Safe to call with null/unknown ids. */
export async function cancelJob(messageId: string | null | undefined): Promise<void> {
  if (!messageId) return;
  const qstash = getClient();
  if (!qstash) return;
  try {
    await qstash.messages.delete(messageId);
  } catch (err) {
    // 404 = already delivered/cancelled; non-fatal.
    console.warn("[qstash] cancelJob failed (non-fatal)", { messageId, error: err });
  }
}
