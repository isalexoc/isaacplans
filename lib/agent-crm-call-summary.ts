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
import { formatLocalizedDate, NOTE_SEPARATOR } from "@/lib/call-summary-note-format";
import type { CallLanguage } from "@/lib/call-summary-structured";
import { createHash } from "crypto";
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
  /** Seconds; GHL workflows may send a string merge field. */
  callDuration?: number | string;
  callStatus?: string;
  status?: string;
  dateAdded?: string;
  attachments?: unknown;
  userId?: string;
  from?: string;
  to?: string;
  /** Full call text from workflow (e.g. {{transcript_generated.call_transcript}}). */
  transcript?: string;
  call_transcript?: string;
  callTranscript?: string;
};

const CALL_EVENT_TYPES = new Set(["InboundMessage", "OutboundMessage"]);

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

/** GHL sends literal "null" / empty when a merge field is missing. */
export function normalizeMergeField(value: unknown): string {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "null" || lower === "undefined" || lower === "n/a") return "";
  return s;
}

/** Optional metadata; duration filtering belongs in GHL workflows. */
export function parseCallDuration(value: unknown): number {
  const normalized = normalizeMergeField(value);
  if (!normalized) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  const n = Number.parseInt(normalized, 10);
  if (Number.isFinite(n)) return Math.max(0, n);
  const digits = normalized.replace(/\D/g, "");
  if (digits) {
    const d = Number.parseInt(digits, 10);
    if (Number.isFinite(d)) return Math.max(0, d);
  }
  return 0;
}

/** Transcript text sent directly from a GHL workflow custom webhook. */
export function extractWebhookTranscript(payload: GhlCallWebhookPayload): string {
  for (const c of [payload.transcript, payload.call_transcript, payload.callTranscript]) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return "";
}

export function isCallSummaryWebhookPayload(
  payload: GhlCallWebhookPayload,
  eventType?: string
): boolean {
  const mt = (payload.messageType ?? "").toUpperCase();
  const mts = (payload.messageTypeString ?? "").toUpperCase();
  if (mt === "CALL" || mts.includes("CALL") || mts.includes("VOICEMAIL")) return true;
  if (eventType && CALL_EVENT_TYPES.has(eventType) && (mt || mts)) return true;
  if (payload.contactId?.trim() && extractWebhookTranscript(payload)) return true;
  return false;
}

function isCallMessage(payload: GhlCallWebhookPayload): boolean {
  if (isCallSummaryWebhookPayload(payload)) return true;
  const mt = (payload.messageType ?? "").toUpperCase();
  const mts = (payload.messageTypeString ?? "").toUpperCase();
  return mt === "CALL" || mts.includes("CALL") || mts.includes("VOICEMAIL");
}

/** DB idempotency key: real messageId when present, else stable hash for workflow transcript webhooks. */
export function resolveCallProcessingId(payload: GhlCallWebhookPayload): string {
  const messageId = payload.messageId?.trim();
  if (messageId) return messageId;

  const contactId = payload.contactId?.trim() ?? "";
  const transcript = extractWebhookTranscript(payload);
  const direction = (payload.direction ?? "").trim();
  const duration = String(parseCallDuration(payload.callDuration));
  const dateAdded = (payload.dateAdded ?? "").trim();
  const status = `${payload.callStatus ?? payload.status ?? ""}`.trim();

  const hash = createHash("sha256")
    .update([contactId, direction, duration, dateAdded, status, transcript.slice(0, 4000)].join("|"))
    .digest("hex")
    .slice(0, 24);

  return `wh_${hash}`;
}

function isGhlMessageId(messageId: string): boolean {
  const id = messageId.trim();
  return Boolean(id) && !id.startsWith("wh_") && !id.startsWith("kx_");
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
  const status = normalizeMergeField(payload.callStatus ?? payload.status).toLowerCase();
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
    processingId: string;
    transcriptSource: "workflow" | "api" | "whisper";
    language?: CallLanguage;
  }
): string {
  const durationLabel =
    meta.callDurationSeconds > 0
      ? `${Math.floor(meta.callDurationSeconds / 60)}m ${(meta.callDurationSeconds % 60).toString().padStart(2, "0")}s`
      : null;
  const dateLine = formatLocalizedDate(meta.dateAdded, meta.language ?? "en");

  const headerMeta = [dateLine, meta.direction !== "unknown" ? meta.direction : null, durationLabel]
    .filter(Boolean)
    .join(" · ");

  return [
    `[${config.notePrefix}] — ${headerMeta}`,
    "",
    summaryBody,
    "",
    NOTE_SEPARATOR,
    meta.processingId.startsWith("kx_")
      ? `Generated from Kixie call recording (${meta.processingId})`
      : meta.transcriptSource === "workflow"
        ? `Generated from call transcript (workflow: ${meta.processingId})`
        : `Generated from call transcript (messageId: ${meta.processingId})`,
  ].join("\n");
}

async function resolveTranscriptForSummary(
  payload: GhlCallWebhookPayload,
  config: CallSummaryConfig,
  locationId: string,
  token: string,
  log: CallSummaryLogger
): Promise<{ transcript: string; source: "workflow" | "api" | "whisper" }> {
  const fromWebhook = extractWebhookTranscript(payload);
  if (fromWebhook) {
    log.info("Using transcript from workflow webhook", previewText(fromWebhook, 200));
    return { transcript: fromWebhook, source: "workflow" };
  }

  const messageId = payload.messageId?.trim();
  const recordingUrl = firstRecordingUrl(payload.attachments);

  if (messageId && isGhlMessageId(messageId)) {
    let transcript = await fetchCallTranscription(locationId, messageId, token, log);
    if (transcript) return { transcript, source: "api" };

    if (recordingUrl) {
      log.info("No GHL API transcript; falling back to Whisper", { messageId });
      transcript = await transcribeRecordingWithWhisper(recordingUrl, config, log);
      if (transcript) return { transcript, source: "whisper" };
    }
    log.warn("No recording URL in attachments", { messageId });
  } else if (recordingUrl) {
    log.info("Transcribing recording with Whisper", { messageId: messageId ?? "none" });
    const transcript = await transcribeRecordingWithWhisper(recordingUrl, config, log);
    if (transcript) return { transcript, source: "whisper" };
  }

  return { transcript: "", source: "api" };
}

/** Summarize an existing transcript and create CRM note (Kixie async processor). */
export async function completeCallSummaryFromTranscript(
  payload: GhlCallWebhookPayload,
  transcript: string,
  transcriptSource: "workflow" | "api" | "whisper",
  options?: { skipIdempotency?: boolean }
): Promise<{ ok: boolean; reason?: string; noteId?: string | null }> {
  const config = getCallSummaryConfig();
  const log = createCallSummaryLogger(config.debug);
  const pipelineT0 = Date.now();

  if (!isCallSummaryConfigured(config)) {
    return { ok: false, reason: "not_configured" };
  }

  const contactId = payload.contactId?.trim();
  const locationId = (payload.locationId ?? config.locationId)?.trim();
  const token = config.piToken!;
  const processingId = resolveCallProcessingId(payload);

  if (!contactId || !locationId) {
    return { ok: false, reason: "missing_ids" };
  }

  if (!transcript.trim()) {
    return { ok: false, reason: "empty_transcript" };
  }

  if (!options?.skipIdempotency) {
    const existing = await getProcessedCall(processingId, log);
    if (existing?.status === "completed") {
      return { ok: false, reason: "already_processed" };
    }
  }

  const direction = payload.direction ?? "unknown";
  const callDuration = parseCallDuration(payload.callDuration);
  const callStatus = payload.callStatus ?? payload.status ?? "completed";

  try {
    log.step("Transcript ready", { source: transcriptSource, ...previewText(transcript, 250) });

    const { title, body: summaryBody, structured } = await summarizeCallTranscript(
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
      processingId,
      transcriptSource,
      language: structured?.language,
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
        messageId: processingId,
        contactId,
        locationId,
        noteId,
        direction,
        callDurationSeconds: callDuration,
        status: "completed",
        source: "kixie",
        errorMessage: null,
      },
      log
    );

    log.info("Pipeline completed successfully", {
      processingId,
      contactId,
      noteId,
      transcriptSource,
      ms: Date.now() - pipelineT0,
    });
    return { ok: true, noteId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Pipeline failed", { processingId, contactId, error: message });
    return { ok: false, reason: message };
  }
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

  const contactId = payload.contactId?.trim();
  const locationId = (payload.locationId ?? config.locationId)?.trim();
  const token = config.piToken!;
  const processingId = resolveCallProcessingId(payload);
  const webhookTranscript = extractWebhookTranscript(payload);

  if (!contactId || !locationId) {
    log.warn("Missing required IDs", { contactId, locationId, processingId });
    return { ok: false, reason: "missing_ids" };
  }

  const hasRecording = Boolean(firstRecordingUrl(payload.attachments));
  if (!webhookTranscript && !payload.messageId?.trim() && !hasRecording) {
    log.warn("Missing transcript, messageId, and recording URL", { contactId });
    return { ok: false, reason: "missing_transcript_or_message_id" };
  }

  const gate = shouldProcessCall(payload, config);
  if (!gate.ok) {
    log.info("Call skipped by rules", { processingId, reason: gate.reason });
    if (!options?.force) {
      await markCallProcessed(
        {
          messageId: processingId,
          contactId,
          locationId,
          direction: payload.direction ?? null,
          callDurationSeconds: parseCallDuration(payload.callDuration),
          status: "skipped",
          errorMessage: gate.reason,
        },
        log
      );
    }
    return { ok: false, reason: gate.reason };
  }

  if (!options?.force) {
    const existing = await getProcessedCall(processingId, log);
    if (existing?.status === "completed") {
      log.info("Already processed", { processingId, noteId: existing.noteId });
      return { ok: false, reason: "already_processed" };
    }
    if (existing?.status === "skipped") {
      log.info("Previously skipped", { processingId, reason: existing.errorMessage });
      return { ok: false, reason: existing.errorMessage ?? "skipped" };
    }
    if (existing?.status === "pending" || existing?.status === "processing") {
      log.info("Call queued for async processing", { processingId, status: existing.status });
      return { ok: false, reason: "queued_for_processing" };
    }
    if (existing?.status === "failed") {
      log.info("Retrying previously failed call", { processingId, priorError: existing.errorMessage });
    }
  }

  const direction = payload.direction ?? "unknown";
  const callDuration = parseCallDuration(payload.callDuration);
  const callStatus = payload.callStatus ?? payload.status ?? "completed";

  try {
    const { transcript, source: transcriptSource } = await resolveTranscriptForSummary(
      payload,
      config,
      locationId,
      token,
      log
    );

    if (!transcript) {
      throw new Error(
        "No transcript available (workflow transcript, GHL message transcription, or Whisper on recording URL)"
      );
    }

    log.step("Transcript ready", { source: transcriptSource, ...previewText(transcript, 250) });

    const { title, body: summaryBody, structured } = await summarizeCallTranscript(
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
      processingId,
      transcriptSource,
      language: structured?.language,
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
        messageId: processingId,
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
      processingId,
      contactId,
      noteId,
      transcriptSource,
      ms: Date.now() - pipelineT0,
    });
    return { ok: true, noteId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Pipeline failed", {
      processingId,
      contactId,
      error: message,
      ms: Date.now() - pipelineT0,
    });
    await markCallProcessed(
      {
        messageId: processingId,
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

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function payloadFromWebhookBody(body: Record<string, unknown>): GhlCallWebhookPayload {
  const nested = body.data;
  const raw =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? ({ ...nested, type: (body.type as string) ?? (nested as Record<string, unknown>).type } as Record<
          string,
          unknown
        >)
      : body;

  const transcript = pickString(raw, "transcript", "call_transcript", "callTranscript");

  return {
    ...(raw as GhlCallWebhookPayload),
    type: typeof raw.type === "string" ? raw.type : undefined,
    locationId: pickString(raw, "locationId", "location_id"),
    contactId: pickString(raw, "contactId", "contact_id"),
    messageId: pickString(raw, "messageId", "message_id", "id"),
    conversationId: pickString(raw, "conversationId", "conversation_id"),
    messageType: pickString(raw, "messageType", "message_type"),
    messageTypeString: pickString(raw, "messageTypeString", "message_type_string"),
    direction: pickString(raw, "direction"),
    callDuration:
      typeof raw.callDuration === "number" || typeof raw.callDuration === "string"
        ? raw.callDuration
        : typeof raw.duration === "number" || typeof raw.duration === "string"
          ? raw.duration
          : undefined,
    callStatus: pickString(raw, "callStatus", "call_status"),
    status: pickString(raw, "status"),
    dateAdded: pickString(raw, "dateAdded", "date_added"),
    userId: pickString(raw, "userId", "user_id"),
    from: pickString(raw, "from"),
    to: pickString(raw, "to"),
    transcript,
    call_transcript: transcript,
  };
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
      else if (
        result.reason === "already_processed" ||
        result.reason?.startsWith("call_status_") ||
        result.reason === "voicemail_excluded" ||
        result.reason === "not_a_call"
      ) {
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
