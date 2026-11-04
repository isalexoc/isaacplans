import { AGENT_CRM_API_BASE, agentCrmAuthHeaders } from "@/lib/agent-crm-contacts";
import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
  type CallSummaryConfig,
} from "@/lib/agent-crm-call-summary-config";
import {
  exportCallMessages,
  extractWebhookTranscript,
  type ExportCallMessage,
  type GhlCallWebhookPayload,
} from "@/lib/agent-crm-call-summary";
import {
  enqueueKixieCallJob,
  findProcessedCallIds,
  firstCallSummaryAt,
} from "@/lib/agent-crm-call-summary-store";
import { createCallSummaryLogger, type CallSummaryLogger } from "@/lib/agent-crm-call-summary-log";
import { triggerKixieProcessorKick } from "@/lib/kixie-call-processor";
import { publishJob } from "@/lib/qstash/client";

/**
 * Calls dialed from the CRM (GHL's own phone) → recording → Whisper → contact note.
 *
 * GHL stopped producing transcripts for these calls on 2026-09-21, so its "Transcript Generated"
 * trigger never fires anymore. Instead the workflow fires on Call Status and sends just the
 * contact; the app finds the call that ended, queues its recording into the same job queue Kixie
 * uses, and the Kixie processor does the rest.
 */

/** GHL logs CRM-dialed calls as TYPE_CALL. Kixie's are TYPE_CUSTOM_CALL and arrive through its own webhook. */
const CRM_CALL_TYPE = "TYPE_CALL";

/** Only the call that just ended, never an older call of the same contact. */
const RECENT_CALL_WINDOW_MS = 2 * 60 * 60 * 1000;

/** GHL can flip the status before it writes the call's length; look again before giving up. */
const LOOKUP_RETRY_MS = [0, 10_000, 30_000];

/** Give GHL a minute to attach the recording before the processor downloads it. */
const RECORDING_READY_DELAY_SECONDS = 60;

/** The backfill pages the export newest-first; this caps a run that never reaches its cutoff. */
const BACKFILL_MAX_PAGES = 20;

type CrmCall = {
  messageId: string;
  contactId: string;
  locationId: string;
  direction: string | null;
  durationSeconds: number;
  dateAdded: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** GHL's recording endpoint; needs the CRM key, which the transcriber adds for this host. */
export function ghlRecordingUrl(messageId: string, locationId: string): string {
  return `${AGENT_CRM_API_BASE}/conversations/messages/${encodeURIComponent(messageId)}/locations/${encodeURIComponent(locationId)}/recording`;
}

/** A workflow ping carrying only the contact: no transcript and no native message fields. */
export function isCallEndedPing(payload: GhlCallWebhookPayload): boolean {
  return Boolean(
    payload.contactId?.trim() &&
      !extractWebhookTranscript(payload) &&
      !payload.messageType &&
      !payload.messageTypeString
  );
}

function toCrmCall(msg: ExportCallMessage, locationId: string, config: CallSummaryConfig): CrmCall | null {
  if (msg.messageType !== CRM_CALL_TYPE) return null;
  const messageId = (msg.id ?? msg.messageId)?.trim();
  const contactId = msg.contactId?.trim();
  const durationSeconds = msg.meta?.call?.duration ?? 0;
  const dateAdded = new Date(msg.dateAdded ?? "").getTime();
  if (!messageId || !contactId || !Number.isFinite(dateAdded)) return null;
  if (durationSeconds < config.minDurationSeconds) return null;
  return {
    messageId,
    contactId,
    locationId: msg.locationId ?? locationId,
    direction: msg.direction ?? null,
    durationSeconds,
    dateAdded,
  };
}

async function ghlGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${AGENT_CRM_API_BASE}${path}`, { headers: agentCrmAuthHeaders(token) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GHL GET ${path.split("?")[0]} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

/** The contact's CRM calls that ended recently and are long enough to summarize. */
export async function findRecentCrmCalls(
  contactId: string,
  config: CallSummaryConfig,
  log: CallSummaryLogger
): Promise<CrmCall[]> {
  const locationId = config.locationId!;
  const token = config.piToken!;
  const search = await ghlGet<{ conversations?: { id: string }[] }>(
    `/conversations/search?${new URLSearchParams({ locationId, contactId })}`,
    token
  );

  const since = Date.now() - RECENT_CALL_WINDOW_MS;
  const calls: CrmCall[] = [];
  for (const conversation of search.conversations ?? []) {
    const page = await ghlGet<{ messages?: { messages?: ExportCallMessage[] } }>(
      `/conversations/${encodeURIComponent(conversation.id)}/messages?type=${CRM_CALL_TYPE}&limit=10`,
      token
    );
    for (const msg of page.messages?.messages ?? []) {
      const call = toCrmCall({ ...msg, contactId: msg.contactId ?? contactId }, locationId, config);
      // dateAdded may be when the call started; adding its length covers a long call either way.
      if (call && call.dateAdded + call.durationSeconds * 1000 >= since) calls.push(call);
    }
  }
  log.debug("CRM calls found for contact", { contactId, count: calls.length });
  return calls;
}

async function queueCrmCall(call: CrmCall, log: CallSummaryLogger): Promise<boolean> {
  const result = await enqueueKixieCallJob(
    {
      messageId: call.messageId,
      contactId: call.contactId,
      locationId: call.locationId,
      recordingUrl: ghlRecordingUrl(call.messageId, call.locationId),
      direction: call.direction,
      callDurationSeconds: call.durationSeconds,
      source: "ghl_native",
    },
    log
  );
  return result.queued;
}

async function dispatchRecordingJob(messageId: string, origin: string): Promise<void> {
  const published = await publishJob({
    path: "/api/queue/kixie-call-summary",
    body: { messageId },
    requestOrigin: origin,
    retries: 3,
    delaySeconds: RECORDING_READY_DELAY_SECONDS,
  });
  if (!published) {
    await triggerKixieProcessorKick(origin);
  }
}

/** Handle a "call ended" ping: queue the contact's ended CRM call(s) that have no summary yet. */
export async function queueEndedCrmCalls(contactId: string, origin: string): Promise<string[]> {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);

  for (const delay of LOOKUP_RETRY_MS) {
    if (delay) await sleep(delay);
    const calls = await findRecentCrmCalls(contactId, config, log);
    if (calls.length === 0) continue;

    const queued: string[] = [];
    for (const call of calls) {
      if (await queueCrmCall(call, log)) {
        queued.push(call.messageId);
        await dispatchRecordingJob(call.messageId, origin);
      }
    }
    log.info("CRM call ping handled", { contactId, found: calls.length, queued });
    return queued;
  }

  log.info("CRM call ping: no ended call long enough to summarize", {
    contactId,
    minDurationSeconds: config.minDurationSeconds,
  });
  return [];
}

/**
 * Daily safety net (cron 6 AM UTC) for CRM calls whose ping never arrived: queue every recent CRM
 * call long enough to summarize that has no row yet; the 7 AM queue reconcile processes them.
 *
 * It reaches back only to the first CRM call that arrived through a ping, so switching this on
 * never summarizes calls made before the switch.
 */
export async function runCallSummaryBackfill(overrides?: {
  backfillDays?: number;
  backfillMaxPerRun?: number;
}): Promise<{ queued: number; alreadyHandled: number; cutoff: string | null }> {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);
  if (!isCallSummaryConfigured(config)) {
    throw new Error("Call summary is not configured");
  }

  const firstLive = await firstCallSummaryAt("ghl_native");
  if (!firstLive) {
    log.info("Backfill: no CRM call has arrived through a ping yet; nothing to catch up");
    return { queued: 0, alreadyHandled: 0, cutoff: null };
  }

  const backfillDays = overrides?.backfillDays ?? config.backfillDays;
  const max = overrides?.backfillMaxPerRun ?? config.backfillMaxPerRun;
  const cutoff = Math.max(Date.now() - backfillDays * 24 * 60 * 60 * 1000, firstLive.getTime());
  log.info("Backfill started", { cutoff: new Date(cutoff).toISOString(), max });

  const candidates: CrmCall[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < BACKFILL_MAX_PAGES; page++) {
    const { messages, nextCursor } = await exportCallMessages(config, cursor, log);
    for (const msg of messages) {
      const call = toCrmCall(msg, config.locationId!, config);
      if (call && call.dateAdded >= cutoff) candidates.push(call);
    }
    const oldest = new Date(messages[messages.length - 1]?.dateAdded ?? 0).getTime();
    if (messages.length === 0 || oldest < cutoff || !nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  const handled = await findProcessedCallIds(candidates.map((c) => c.messageId));
  let queued = 0;
  for (const call of candidates) {
    if (queued >= max) break;
    if (handled.has(call.messageId)) continue;
    if (await queueCrmCall(call, log)) queued += 1;
  }

  log.info("Backfill finished", { candidates: candidates.length, queued });
  return { queued, alreadyHandled: handled.size, cutoff: new Date(cutoff).toISOString() };
}
