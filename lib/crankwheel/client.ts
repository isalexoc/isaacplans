/**
 * Thin server-side client for the CrankWheel RESTful API.
 *
 * Best-effort by design, in the style of `lib/agent-crm-contacts.ts`: every call returns null on
 * any miss (missing key, network error, non-2xx) rather than throwing, so a CrankWheel outage
 * degrades the meeting button instead of breaking the intake form it lives on.
 *
 * Server-only — it reads API keys.
 */

import "server-only";
import { getCrankwheelConfig, type CrankwheelConfig } from "./config";
// Re-exported so callers keep importing every CrankWheel helper from one place.
export { uidFromUrl, withViewerLocale } from "./url";
import type {
  CrankwheelAudio,
  CrankwheelUsageResponse,
  CrankwheelUsageSession,
  NoauthLinkResponse,
  ScheduledMeetingResponse,
} from "./types";

const LOG = "[CRANKWHEEL]";
const TIMEOUT_MS = 15_000;

type CwFetchOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: Record<string, unknown>;
  /** True when the endpoint mutates — forces the read/write key. */
  write?: boolean;
  config?: CrankwheelConfig;
};

/** What the transport actually learned: whether the call succeeded, and the raw body if any. */
type CwResult = { ok: boolean; text: string };

/**
 * One request to /ss/api/*.
 *
 * The `Authorization` header takes the API key RAW after the word `Basic` — CrankWheel is not
 * doing real HTTP Basic here, so base64-encoding the key produces a 401.
 */
async function cwRequest(path: string, options: CwFetchOptions = {}): Promise<CwResult> {
  const config = options.config ?? getCrankwheelConfig();
  const key = options.write ? config.writeKey : config.readKey;
  if (!key) {
    console.warn(`${LOG} No ${options.write ? "read/write" : "read"} API key configured.`);
    return { ok: false, text: "" };
  }

  const method = options.method ?? "GET";
  try {
    const res = await fetch(`${config.apiBase}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`${LOG} ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
      return { ok: false, text };
    }
    return { ok: true, text };
  } catch (error) {
    console.error(`${LOG} ${method} ${path} threw:`, error);
    return { ok: false, text: "" };
  }
}

/** `cwRequest` plus JSON parsing. Null means "no usable body", for any reason. */
async function cwFetch<T>(path: string, options: CwFetchOptions = {}): Promise<T | null> {
  const { ok, text } = await cwRequest(path, options);
  if (!ok || !text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(`${LOG} ${path} returned non-JSON: ${text.slice(0, 200)}`);
    return null;
  }
}

/**
 * Mint a link the client can use to join WITHOUT the number handshake.
 *
 * `within_seconds` bounds when the SESSION must start, not when the client must click: a link
 * minted now and shared from ten minutes from now still works for whoever opens it afterwards.
 *
 * `truncate_older_links` is passed unconditionally and must stay that way. A noauth link binds to
 * the first session joined with it, and this account has a single presenter — so a link left live
 * for one client would silently admit them to the NEXT client's session. Truncating ends every
 * older link's validity the moment a new one is minted, which is the documented fix.
 *
 * The two hooks are HTTPS URLs CrankWheel GETs when the session is created and when the first
 * viewer joins. They are how the agent's panel knows the client showed up without polling anyone.
 */
export async function createNoauthLink(params: {
  createHook?: string;
  viewerHook?: string;
  withinSeconds?: number;
  config?: CrankwheelConfig;
}): Promise<NoauthLinkResponse | null> {
  const config = params.config ?? getCrankwheelConfig();
  return cwFetch<NoauthLinkResponse>("/ss/api/make_noauth_link", {
    method: "POST",
    write: true,
    config,
    body: {
      email: config.presenterEmail,
      within_seconds: String(params.withinSeconds ?? config.noauthWindowSeconds),
      truncate_older_links: true,
      ...(params.createHook ? { create_hook: params.createHook } : {}),
      ...(params.viewerHook ? { viewer_hook: params.viewerHook } : {}),
    },
  });
}

/**
 * Mint a durable link, safe to send days ahead.
 *
 * Unlike a noauth link this one always requires the agent to admit the viewer by the number they
 * read out, which is exactly what makes it safe to leave sitting in someone's text messages. It
 * accepts no hooks, so a scheduled meeting's outcome is only known from the usage API afterwards.
 */
export async function createScheduledMeeting(params: {
  name: string;
  audio?: CrankwheelAudio;
  config?: CrankwheelConfig;
}): Promise<ScheduledMeetingResponse | null> {
  const config = params.config ?? getCrankwheelConfig();
  return cwFetch<ScheduledMeetingResponse>("/ss/api/schedule_meeting", {
    method: "POST",
    write: true,
    config,
    body: {
      name: params.name,
      email: config.presenterEmail,
      // "call" = the agent phones the client. Keeps the conversation on Kixie, so the existing
      // recording and call-summary pipeline still sees it.
      audio: params.audio ?? "call",
    },
  });
}

/**
 * Revoke a link outright — harder than letting it expire. A viewer who opens it afterwards is told
 * the presenter has stopped sharing rather than being dropped into a handshake queue.
 */
export async function deleteMeetingLink(uid: string, config?: CrankwheelConfig): Promise<boolean> {
  if (!uid) return false;
  // Deliberately `cwRequest`, not `cwFetch`: a successful delete answers with a bare string like
  // "Meeting link deleted", which is not JSON. Parsing it would report a working delete as failed.
  const { ok } = await cwRequest(`/ss/api/schedule_meeting/${encodeURIComponent(uid)}`, {
    method: "DELETE",
    write: true,
    config,
  });
  return ok;
}

/** Session history for the presenter, used to build the post-meeting CRM note. */
export async function listUsage(params: {
  from: Date;
  to: Date;
  config?: CrankwheelConfig;
}): Promise<CrankwheelUsageSession[]> {
  const qs = new URLSearchParams({
    from: params.from.toISOString().replace(/\.\d{3}Z$/, "Z"),
    to: params.to.toISOString().replace(/\.\d{3}Z$/, "Z"),
  });
  const res = await cwFetch<CrankwheelUsageResponse>(`/ss/api/usage_new?${qs}`, {
    config: params.config,
  });
  return res?.sessions ?? [];
}
