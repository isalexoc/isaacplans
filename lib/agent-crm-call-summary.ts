import {
  AGENT_CRM_API_BASE,
  agentCrmAuthHeaders,
  agentCrmJsonHeaders,
} from "@/lib/agent-crm-contacts";
import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
  type CallSummaryConfig,
} from "@/lib/agent-crm-call-summary-config";
import { getProcessedCall, markCallProcessed } from "@/lib/agent-crm-call-summary-store";
import {
  summarizeCallTranscript,
  transcribeRecordingWithWhisper,
} from "@/lib/openai-call-summary";
import {
  createCallSummaryLogger,
  previewText,
  sanitizeCallPayload,
  type CallSummaryLogger,
} from "@/lib/agent-crm-call-summary-log";

export type GhlCallWebhookPayload = {
  type?: string;
  locationId?: string;
  contactId?: string;
  messageId?: string;
  conversationId?: string;
  messageType?: string;
  messageTypeString?: string;
  direction?: string;
  callDuration?: number;
  callStatus?: string;
  status?: string;
  dateAdded?: string;
  attachments?: unknown;
  userId?: string;
  from?: string;
  to?: string;
};

export type ExportCallMessage = {
  id?: string;
  messageId?: string;
  contactId?: string;
  locationId?: string;
  direction?: string;
  callDuration?: number;
  callStatus?: string;
  status?: string;
  dateAdded?: string;
  attachments?: unknown;
  messageType?: string;
  type?: string;
  userId?: string;
};

const TRANSCRIPTION_RETRY_MS = [0, 3_000, 8_000, 20_000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstRecordingUrl(attachments: unknown): string | null {
  if (!attachments) return null;
  if (typeof attachments === "string" && attachments.startsWith("http")) return attachments;
  if (Array.isArray(attachments)) {
    for (const item of attachments) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (item && typeof item === "object" && "url" in item) {
        const url = (item as { url?: unknown }).url;
        if (typeof url === "string" && url.startsWith("http")) return url;
      }
    }
  }
  return null;
}

function isVoicemailPayload(payload: GhlCallWebhookPayload): boolean {
  const status = `${payload.callStatus ?? ""} ${payload.status ?? ""}`.toLowerCase();
  const typeStr = (payload.messageTypeString ?? payload.messageType ?? "").toUpperCase();
  return status.includes("voicemail") || typeStr.includes("VOICEMAIL");
}

function isCallMessage(payload: GhlCallWebhookPayload): boolean {
  const mt = (payload.messageType ?? "").toUpperCase();
  const mts = (payload.messageTypeString ?? "").toUpperCase();
  return mt === "CALL" || mts.includes("CALL") || mts.includes("VOICEMAIL");
}

function shouldProcessCall(payload: GhlCallWebhookPayload, config: CallSummaryConfig): {
  ok: boolean;
  reason?: string;
} {
  if (!isCallMessage(payload)) {
    return { ok: false, reason: "not_a_call" };
  }
  if (!config.includeVoicemail && isVoicemailPayload(payload)) {
    return { ok: false, reason: "voicemail_excluded" };
  }
  const duration = Number(payload.callDuration ?? 0);
  if (duration < config.minDurationSeconds) {
    return { ok: false, reason: "duration_below_minimum" };
  }
  const status = `${payload.callStatus ?? payload.status ?? ""}`.toLowerCase();
  if (status && !["completed", "answered", "voicemail"].some((s) => status.includes(s))) {
    if (status.includes("no-answer") || status.includes("busy") || status.includes("failed")) {
      return { ok: false, reason: `call_status_${status}` };
    }
  }
  return { ok: true };
}

function extractTranscriptText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  const candidates = [
    d.transcript,
    d.transcription,
    d.text,
    d.body,
    (d.data as Record<string, unknown> | undefined)?.transcript,
    (d.message as Record<string, unknown> | undefined)?.transcript,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export async function fetchCallTranscription(
  locationId: string,
  messageId: string,
  token: string,
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<string> {
  const url = `${AGENT_CRM_API_BASE}/conversations/locations/${encodeURIComponent(locationId)}/messages/${encodeURIComponent(messageId)}/transcription`;

  log.step("Fetch GHL transcription", { locationId, messageId, url });

  for (let attempt = 0; attempt < TRANSCRIPTION_RETRY_MS.length; attempt++) {
    const delay = TRANSCRIPTION_RETRY_MS[attempt];
    if (delay > 0) {
      log.debug("Transcription retry wait", { attempt: attempt + 1, delayMs: delay });
      await sleep(delay);
    }

    const attemptT0 = Date.now();
    const res = await fetch(url, {
      method: "GET",
      headers: agentCrmAuthHeaders(token),
    });

    const text = await res.text();
    log.debug("Transcription API response", {
      attempt: attempt + 1,
      status: res.status,
      ms: Date.now() - attemptT0,
      bodyLength: text.length,
      bodyPreview: text.slice(0, 120),
    });

    if (res.status === 404) continue;

    if (!res.ok) {
      log.warn("Transcription fetch failed", { status: res.status, preview: text.slice(0, 200) });
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      if (text.trim()) {
        log.info("Transcription received as plain text", previewText(text.trim(), 200));
        return text.trim();
      }
      continue;
    }

    const transcript = extractTranscriptText(data);
    if (transcript) {
      log.info("GHL transcription found", previewText(transcript, 200));
      return transcript;
    }
    log.debug("Transcription response empty", { attempt: attempt + 1 });
  }

  log.warn("No GHL transcription after retries", { messageId, attempts: TRANSCRIPTION_RETRY_MS.length });
  return "";
}

export async function createContactNote(
  params: {
    contactId: string;
    token: string;
    title: string;
    body: string;
    userId?: string;
  },
  log: CallSummaryLogger = createCallSummaryLogger()
): Promise<string | null> {
  log.step("Create CRM contact note", {
    contactId: params.contactId,
    title: params.title,
    bodyLength: params.body.length,
    hasUserId: Boolean(params.userId),
  });
  const t0 = Date.now();
  const res = await fetch(`${AGENT_CRM_API_BASE}/contacts/${params.contactId}/notes`, {
    method: "POST",
    headers: agentCrmJsonHeaders(params.token),
    body: JSON.stringify({
      body: params.body,
      title: params.title,
      ...(params.userId ? { userId: params.userId } : {}),
    }),
  });

  const text = await res.text();
  log.elapsed("Create CRM contact note", t0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("Create note failed", { status: res.status, preview: text.slice(0, 300) });
    throw new Error(`Create note failed (${res.status}): ${text.slice(0, 500)}`);
  }

  try {
    const data = JSON.parse(text) as { note?: { id?: string }; id?: string };
    const noteId = data.note?.id ?? data.id ?? null;
    log.info("CRM note created", { noteId, contactId: params.contactId });
    return noteId;
  } catch {
    log.warn("CRM note created but response was not JSON", { preview: text.slice(0, 120) });
    return null;
  }
}

function formatNoteBody(
  config: CallSummaryConfig,
  summaryBody: string,
  meta: {
    direction: string;
    callDurationSeconds: number;
    dateAdded?: string;
    messageId: string;
  }
): string {
  const mins = Math.floor(meta.callDurationSeconds / 60);
  const secs = meta.callDurationSeconds % 60;
  const durationLabel = `${mins}m ${secs.toString().padStart(2, "0")}s`;
  const dateLine = meta.dateAdded
    ? new Date(meta.dateAdded).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

  return [
    `[${config.notePrefix}] — ${dateLine} · ${meta.direction} · ${durationLabel}`,
    "",
    summaryBody,
    "",
    "---",
    `Generated from call transcript (messageId: ${meta.messageId})`,
  ].join("\n");
}

export async function processCallSummary(
  payload: GhlCallWebhookPayload,
  options?: { force?: boolean }
): Promise<{ ok: boolean; reason?: string; noteId?: string | null }> {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);
  const pipelineT0 = Date.now();

  log.info("processCallSummary started", {
    ...sanitizeCallPayload(payload),
    force: Boolean(options?.force),
    debug: config.debug,
  });

  if (!isCallSummaryConfigured(config)) {
    log.error("Not configured", {
      enabled: config.enabled,
      hasOpenAi: Boolean(config.openaiApiKey),
      hasPi: Boolean(config.piToken),
      hasLocation: Boolean(config.locationId),
    });
    return { ok: false, reason: "not_configured" };
  }

  const messageId = payload.messageId?.trim();
  const contactId = payload.contactId?.trim();
  const locationId = (payload.locationId ?? config.locationId)?.trim();
  const token = config.piToken!;

  if (!messageId || !contactId || !locationId) {
    log.warn("Missing required IDs", { messageId, contactId, locationId });
    return { ok: false, reason: "missing_ids" };
  }

  const gate = shouldProcessCall(payload, config);
  if (!gate.ok) {
    log.info("Call skipped by rules", { messageId, reason: gate.reason, gate });
    if (!options?.force) {
      await markCallProcessed(
        {
          messageId,
          contactId,
          locationId,
          direction: payload.direction ?? null,
          callDurationSeconds: payload.callDuration ?? null,
          status: "skipped",
          errorMessage: gate.reason,
        },
        log
      );
    }
    return { ok: false, reason: gate.reason };
  }

  if (!options?.force) {
    const existing = await getProcessedCall(messageId, log);
    if (existing?.status === "completed") {
      log.info("Already processed", { messageId, noteId: existing.noteId });
      return { ok: false, reason: "already_processed" };
    }
    if (existing?.status === "skipped") {
      log.info("Previously skipped", { messageId, reason: existing.errorMessage });
      return { ok: false, reason: existing.errorMessage ?? "skipped" };
    }
    if (existing?.status === "failed") {
      log.info("Retrying previously failed call", { messageId, priorError: existing.errorMessage });
    }
  }

  const direction = payload.direction ?? "unknown";
  const callDuration = Number(payload.callDuration ?? 0);
  const callStatus = payload.callStatus ?? payload.status ?? "completed";

  try {
    let transcript = await fetchCallTranscription(locationId, messageId, token, log);

    if (!transcript) {
      const recordingUrl = firstRecordingUrl(payload.attachments);
      if (recordingUrl) {
        log.info("No GHL transcript; falling back to Whisper", { messageId });
        transcript = await transcribeRecordingWithWhisper(recordingUrl, config, log);
      } else {
        log.warn("No recording URL in attachments", { messageId });
      }
    }

    if (!transcript) {
      throw new Error("No transcript available (GHL transcription empty and no recording)");
    }

    log.step("Transcript ready", previewText(transcript, 250));

    const { title, body: summaryBody } = await summarizeCallTranscript(
      {
        transcript,
        direction,
        callDurationSeconds: callDuration,
        callStatus,
        contactId,
        dateAdded: payload.dateAdded,
      },
      config,
      log
    );

    const noteBody = formatNoteBody(config, summaryBody, {
      direction,
      callDurationSeconds: callDuration,
      dateAdded: payload.dateAdded,
      messageId,
    });

    const noteTitle = title.startsWith(config.notePrefix) ? title : `${config.notePrefix}: ${title}`;

    const noteId = await createContactNote(
      {
        contactId,
        token,
        title: noteTitle,
        body: noteBody,
        userId: payload.userId,
      },
      log
    );

    await markCallProcessed(
      {
        messageId,
        contactId,
        locationId,
        noteId,
        direction,
        callDurationSeconds: callDuration,
        status: "completed",
      },
      log
    );

    log.info("Pipeline completed successfully", {
      messageId,
      contactId,
      noteId,
      ms: Date.now() - pipelineT0,
    });
    return { ok: true, noteId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Pipeline failed", {
      messageId,
      contactId,
      error: message,
      ms: Date.now() - pipelineT0,
    });
    await markCallProcessed(
      {
        messageId,
        contactId,
        locationId,
        direction: payload.direction ?? null,
        callDurationSeconds: callDuration,
        status: "failed",
        errorMessage: message,
      },
      log
    );
    return { ok: false, reason: message };
  }
}

export function payloadFromWebhookBody(body: Record<string, unknown>): GhlCallWebhookPayload {
  const nested = body.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as GhlCallWebhookPayload), type: (body.type as string) ?? (nested as GhlCallWebhookPayload).type };
  }
  return body as GhlCallWebhookPayload;
}

export async function exportCallMessages(
  config: CallSummaryConfig,
  cursor?: string | null,
  log: CallSummaryLogger = createCallSummaryLogger(config.debug)
): Promise<{ messages: ExportCallMessage[]; nextCursor: string | null }> {
  const locationId = config.locationId!;
  const token = config.piToken!;

  const q = new URLSearchParams({
    locationId,
    channel: "Call",
    limit: "50",
  });
  if (cursor) q.set("cursor", cursor);

  log.step("Export call messages", { locationId, cursor: cursor ?? null });
  const t0 = Date.now();
  const res = await fetch(`${AGENT_CRM_API_BASE}/conversations/messages/export?${q}`, {
    method: "GET",
    headers: agentCrmAuthHeaders(token),
  });

  const text = await res.text();
  log.elapsed("Export call messages", t0, { status: res.status, ok: res.ok });
  if (!res.ok) {
    log.error("Export messages failed", { status: res.status, preview: text.slice(0, 300) });
    throw new Error(`Export messages failed (${res.status}): ${text.slice(0, 500)}`);
  }

  const data = JSON.parse(text) as Record<string, unknown>;
  const messages = (data.messages ?? data.data ?? []) as ExportCallMessage[];
  const list = Array.isArray(messages) ? messages : [];

  const nextCursor =
    (typeof data.nextCursor === "string" && data.nextCursor) ||
    (typeof data.cursor === "string" && data.cursor) ||
    (data.meta && typeof data.meta === "object"
      ? ((data.meta as Record<string, unknown>).nextCursor as string | undefined)
      : undefined) ||
    null;

  log.debug("Export page", {
    count: list.length,
    nextCursor: nextCursor ? `${nextCursor.slice(0, 12)}…` : null,
  });

  return { messages: list, nextCursor };
}

export function exportMessageToPayload(msg: ExportCallMessage, locationId: string): GhlCallWebhookPayload {
  return {
    locationId: msg.locationId ?? locationId,
    contactId: msg.contactId,
    messageId: msg.messageId ?? msg.id,
    direction: msg.direction,
    callDuration: msg.callDuration,
    callStatus: msg.callStatus,
    status: msg.status,
    dateAdded: msg.dateAdded,
    attachments: msg.attachments,
    messageType: msg.messageType ?? "CALL",
    userId: msg.userId,
  };
}

export async function runCallSummaryBackfill(overrides?: {
  backfillDays?: number;
  backfillMaxPerRun?: number;
}): Promise<{
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
}> {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);
  if (!isCallSummaryConfigured(config)) {
    throw new Error("Call summary is not configured");
  }

  const backfillDays = overrides?.backfillDays ?? config.backfillDays;
  const max = overrides?.backfillMaxPerRun ?? config.backfillMaxPerRun;
  const cutoff = Date.now() - backfillDays * 24 * 60 * 60 * 1000;
  let cursor: string | null = null;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  log.info("Backfill started", { backfillDays, max, cutoff: new Date(cutoff).toISOString() });

  outer: while (processed + skipped + failed < max) {
    const { messages, nextCursor } = await exportCallMessages(config, cursor, log);
    if (messages.length === 0) {
      log.info("Backfill: no more messages on page");
      break;
    }

    for (const msg of messages) {
      if (processed + skipped + failed >= max) break outer;

      const messageId = (msg.messageId ?? msg.id)?.trim();
      if (!messageId) continue;

      if (msg.dateAdded) {
        const t = new Date(msg.dateAdded).getTime();
        if (Number.isFinite(t) && t < cutoff) {
          log.debug("Backfill: message before cutoff", { messageId, dateAdded: msg.dateAdded });
          continue;
        }
      }

      log.debug("Backfill: processing message", { messageId, contactId: msg.contactId });
      const payload = exportMessageToPayload(msg, config.locationId!);
      const result = await processCallSummary(payload);
      if (result.ok) processed += 1;
      else if (result.reason === "already_processed" || result.reason?.startsWith("duration_") || result.reason === "voicemail_excluded" || result.reason === "not_a_call" || result.reason === "duration_below_minimum") {
        skipped += 1;
        log.debug("Backfill: skipped", { messageId, reason: result.reason });
      } else if (result.reason === "not_configured" || result.reason === "missing_ids") {
        errors.push(result.reason);
        log.error("Backfill: fatal error", { reason: result.reason });
        break outer;
      } else {
        failed += 1;
        if (result.reason) errors.push(`${messageId}: ${result.reason}`);
        log.warn("Backfill: failed message", { messageId, reason: result.reason });
      }
    }

    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }

  log.info("Backfill finished", { processed, skipped, failed, errorCount: errors.length });
  return { processed, skipped, failed, errors };
}
