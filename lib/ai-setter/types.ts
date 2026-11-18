/**
 * Shared types and port interfaces for the AI Setter.
 *
 * Pure: no DB, no `server-only`, no SDK imports. Every side effect (GHL, Claude, the database,
 * Telegram, Sanity) goes through a port defined here, so the core (`turn.ts`, `compliance.ts`,
 * `availability.ts`, …) runs offline in `scripts/test-ai-setter.ts` with fakes.
 */

// ─── Basics ────────────────────────────────────────────────────────────────────────────────

export type Lang = "en" | "es";

/** Spanish register. English ignores it. Default "usted"; switches to "tu" only after the lead uses tú. */
export type Register = "usted" | "tu";

/** Channels the AI may SEND on in Phase 1. */
export type Channel = "SMS" | "WhatsApp";

/** Every channel a thread message can come from (normalized from GHL `messageType`). */
export type ThreadChannel = Channel | "Email" | "FB" | "IG" | "Live_Chat" | "Call" | "Activity" | "Other";

export type ProductLine =
  | "aca"
  | "short_term_medical"
  | "dental_vision"
  | "hospital_indemnity"
  | "final_expense"
  | "iul"
  | "life_insurance"
  | "health_alternative"
  | "general";

/**
 * active   — the AI answers this lead
 * paused   — Isaac replied by hand (auto-resumes at `pausedUntil`) or "lo tomo yo" (no `pausedUntil`)
 * handoff  — waiting on Isaac (question the AI must not answer)
 * booked   — has an AI-booked appointment (the AI still answers: reschedule, questions)
 * stopped  — not interested / out of license state / closed; the AI only answers HELP/STOP
 * opted_out — STOP or any wish not to be contacted. Never messaged again (suppression by phone).
 */
export type LeadStatus = "active" | "paused" | "handoff" | "booked" | "stopped" | "opted_out";

export type TurnState = "idle" | "armed" | "running";

// ─── GHL data (normalized) ─────────────────────────────────────────────────────────────────

export type AttachmentKind = "audio" | "image" | "video" | "document" | "other";

export type ThreadMessage = {
  /** GHL message id. */
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  channel: ThreadChannel;
  /** Raw GHL `messageType`, e.g. "TYPE_SMS", "TYPE_WHATSAPP", "TYPE_CUSTOM_SMS", "TYPE_CALL". */
  messageType: string;
  /** Raw GHL `source`: workflow | bulk_actions | campaign | api | app | null. */
  source: string | null;
  userId: string | null;
  /** Raw body, NOT masked. Only `context.ts` decides what reaches the model, masked. */
  body: string;
  /**
   * Sender number of an INBOUND SMS/WhatsApp as GHL reports it (normalized to E.164 when
   * parseable), or null when GHL doesn't say. The turn only answers when it matches the
   * contact's phone (a reply must go back to the number that wrote).
   */
  fromNumber: string | null;
  attachmentKinds: AttachmentKind[];
  dateAdded: Date;
  /** delivered | failed | pending | read | sent | undelivered | opt_out | … */
  status: string | null;
};

export type DndStatus = "active" | "inactive" | "permanent";
export type DndChannel = "SMS" | "WhatsApp" | "Email" | "FB" | "Call" | "GMB";

export type ContactSnapshot = {
  id: string;
  locationId: string | null;
  firstName: string | null;
  lastName: string | null;
  /** As GHL stores it (normally E.164). */
  phone: string | null;
  email: string | null;
  tags: string[];
  /** GHL native `timezone` (IANA) when set. */
  timezone: string | null;
  /** 2-letter code or full name, as stored. */
  state: string | null;
  postalCode: string | null;
  source: string | null;
  /** Global DND flag. */
  dnd: boolean;
  dndChannels: Partial<Record<DndChannel, DndStatus>>;
  dateAdded: Date | null;
};

export type AppointmentRef = {
  id: string;
  calendarId: string;
  contactId: string | null;
  startTime: Date;
  endTime: Date | null;
  /** new | confirmed | cancelled | showed | noshow | invalid | completed | active */
  status: string;
  title: string | null;
};

// ─── Schedule & slots ──────────────────────────────────────────────────────────────────────

/** 0 = Sunday … 6 = Saturday (same as `Date#getDay()`), evaluated in `WeeklySchedule.timeZone`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "HH:MM" 24h in the schedule's time zone. `end` may be "24:00" (midnight). end > start. */
export type TimeWindow = { start: string; end: string };

export type WeeklySchedule = {
  /** IANA zone the windows are written in (Isaac: "America/New_York"). */
  timeZone: string;
  days: Record<Weekday, TimeWindow[]>;
};

/** A time the AI offered to this lead. `id` is short ("A"/"B"/…), stable while the offer is live. */
export type OfferedSlot = {
  id: string;
  /** ISO with offset exactly as GHL returned it (what we send back when booking). */
  startIso: string;
  /** Human label in the lead's language and zone, e.g. "hoy a las 4:30 de la tarde". */
  label: string;
};

// ─── Records the store keeps ───────────────────────────────────────────────────────────────

export type LeadRecord = {
  contactId: string;
  /** First name only, for the admin list (no other PII is copied out of GHL). */
  firstName: string | null;
  status: LeadStatus;
  language: Lang | null;
  register: Register | null;
  product: ProductLine | null;
  leadTimezone: string | null;
  stateCode: string | null;
  /** Turn fencing (copy of the phone-finder arm/claim pattern). */
  runId: string | null;
  attempt: number;
  turnState: TurnState;
  armedAt: Date | null;
  /** Watermark: the newest inbound GHL message id a finished turn has handled. */
  lastHandledInboundId: string | null;
  lastHandledInboundAt: Date | null;
  lastInboundAt: Date | null;
  lastAiOutboundAt: Date | null;
  /** channel -> ISO time the AI disclosure was last included on that channel. */
  disclosedChannels: Partial<Record<Channel, string>>;
  pausedUntil: Date | null;
  pauseReason: string | null;
  offeredSlots: OfferedSlot[];
  offeredAt: Date | null;
  /** Times the lead turned down offered times in a row (2+ → send the self-booking link). */
  rejectionsCount: number;
  appointmentId: string | null;
  appointmentAt: Date | null;
  calendarId: string | null;
  /** Saved BEFORE the booking POST, so a retry never books twice. */
  bookingIntent: { slotIso: string; calendarId: string; runId: string } | null;
  callNowState: "waiting" | "calling" | "declined" | "timeout" | null;
  callNowRequestedAt: Date | null;
  turnsDay: string | null;
  turnsToday: number;
  threadTurns: number;
  /** Ambiguous opt-out: everything frozen until the lead clarifies or Isaac decides. */
  optOutPending: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TurnFence = { contactId: string; runId: string; attempt: number };

export type MessageStatus =
  | "draft" // free text waiting for Isaac
  | "approved" // released by Isaac; a send job is queued
  | "sending" // POST in flight (two-phase send)
  | "sent"
  | "send_unknown" // timeout/5xx after POST: never regenerate; reconcile against GHL first
  | "failed"
  | "stale" // context changed before it went out (newer inbound, human reply, window closed)
  | "rejected" // Isaac rejected it
  | "superseded" // replaced by a newer draft for the same lead
  | "blocked" // a compliance rule stopped it
  | "shadow"; // AI_SETTER_DRY_RUN: what the AI WOULD have sent

export type MessageKind = "template" | "free_text";

export type MessageRecord = {
  id: string;
  contactId: string;
  channel: Channel;
  kind: MessageKind;
  templateId: string | null;
  templateHash: string | null;
  /** Final text (null after the 90-day purge). */
  body: string | null;
  /** The AI's original text when Isaac edited it (learning signal). */
  originalBody: string | null;
  status: MessageStatus;
  intent: string | null;
  inReplyToInboundId: string | null;
  turnRunId: string | null;
  ghlMessageId: string | null;
  /** Compliance decision snapshot: rule inputs + outcome (kept 5 years, no message text). */
  decision: Record<string, unknown> | null;
  guardFlags: string[];
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  costMicros: number;
  usedFallback: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  /** Do not send before this time (held for the lead's window). */
  notBefore: Date | null;
  /** Drafts expire; an expired draft becomes `stale`. */
  expiresAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewMessage = Pick<MessageRecord, "contactId" | "channel" | "kind" | "status"> &
  Partial<Omit<MessageRecord, "id" | "contactId" | "channel" | "kind" | "status" | "createdAt" | "updatedAt">>;

export type SuppressionScope = "all" | "sms" | "whatsapp";

// ─── Ports ─────────────────────────────────────────────────────────────────────────────────

export type GhlFailure = { ok: false; status: number; retryable: boolean; error: string };
export type GhlResult<T> = { ok: true; value: T } | GhlFailure;

/**
 * `unknown` = the request may have reached GHL (timeout, network drop, 5xx after send). The
 * caller must NOT regenerate or blindly resend: it reconciles against the thread first.
 */
export type SendOutcome =
  | { kind: "sent"; messageId: string; conversationId: string | null }
  /** `rate_limited` (429) was NOT sent and is safe to retry later; the others are permanent. */
  | { kind: "rejected"; status: number; reason: "dnd" | "invalid" | "scope" | "rate_limited" | "other" }
  | { kind: "unknown"; status: number };

export type CreateAppointmentFailure = GhlFailure & { slotTaken: boolean };

export interface GhlPort {
  getContact(contactId: string): Promise<GhlResult<ContactSnapshot>>;
  /**
   * Messages from ALL of the contact's conversations, unfiltered by type, merged and sorted
   * OLDEST FIRST. Stops after `limit` real messages or `sinceDays`.
   */
  listMessages(contactId: string, opts: { limit: number; sinceDays: number }): Promise<GhlResult<ThreadMessage[]>>;
  sendMessage(input: { contactId: string; channel: Channel; text: string }): Promise<SendOutcome>;
  /** Free slot start times (ISO with offset) for one calendar, `endMs` exclusive, ≤ 31 days. */
  getFreeSlots(input: {
    calendarId: string;
    startMs: number;
    endMs: number;
    timeZone: string;
    userId: string | null;
  }): Promise<GhlResult<string[]>>;
  /** Isaac's appointments across ALL calendars (conflict check). */
  listUserEvents(input: { userId: string; startMs: number; endMs: number }): Promise<GhlResult<AppointmentRef[]>>;
  listContactAppointments(contactId: string): Promise<GhlResult<AppointmentRef[]>>;
  createAppointment(input: {
    calendarId: string;
    contactId: string;
    startIso: string;
    endIso: string;
    title: string;
    description: string;
    assignedUserId: string | null;
  }): Promise<{ ok: true; value: AppointmentRef } | CreateAppointmentFailure>;
  /** Always sends `appointmentStatus` together with a new `startTime` (GHL resets it otherwise). */
  updateAppointment(input: {
    appointmentId: string;
    startIso?: string;
    endIso?: string;
    status: "confirmed" | "cancelled";
  }): Promise<GhlResult<AppointmentRef>>;
  /** Permanent DND on these channels (never touches `inboundDndSettings`). */
  setDnd(contactId: string, channels: DndChannel[]): Promise<boolean>;
  addTags(contactId: string, tags: string[]): Promise<boolean>;
  removeTags(contactId: string, tags: string[]): Promise<boolean>;
  addNote(contactId: string, body: string): Promise<boolean>;
}

/** JSON Schema tool definition (strict-compatible: additionalProperties false + required). */
export type ToolDef = { name: string; description: string; inputSchema: Record<string, unknown> };

/** What a tool execution returns to the model. `terminal` ends the loop. */
export type ToolExecResult = { content: string; isError?: boolean; terminal?: boolean };

export type LlmUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costMicros: number;
  /** A fallback model served at least one call. Its output always goes to approval. */
  usedFallback: boolean;
};

export type LlmLoopResult =
  | { kind: "terminal"; toolName: string; input: unknown; usage: LlmUsage; calls: number }
  | { kind: "no_action"; text: string; usage: LlmUsage; calls: number }
  | { kind: "refused" | "max_tokens" | "deadline" | "error"; detail: string; usage: LlmUsage; calls: number };

export interface LlmSession {
  /** Run until a terminal tool is called or a limit is hit. */
  run(): Promise<LlmLoopResult>;
  /**
   * Answer the pending terminal tool_use with an error result carrying `feedback` (e.g. the
   * guard's violations) and run again. Same system prompt + tools: the history is append-only.
   */
  retryWith(feedback: string): Promise<LlmLoopResult>;
}

export interface LlmPort {
  startSession(input: {
    system: string;
    tools: ToolDef[];
    userContent: string;
    executeTool: (name: string, input: unknown) => Promise<ToolExecResult>;
    /** API calls across run() + retryWith() for this session. */
    maxCalls: number;
    deadlineAt: number;
  }): LlmSession;
}

export interface StorePort {
  getLead(contactId: string): Promise<LeadRecord | null>;
  /** Insert if missing (never overwrites); returns the stored row. */
  ensureLead(contactId: string, init: Partial<LeadRecord>): Promise<LeadRecord>;
  /** INSERT … ON CONFLICT DO UPDATE … WHERE idle OR stale. Only the caller that armed publishes. */
  armTurn(contactId: string, now: Date): Promise<{ armed: boolean; runId: string | null }>;
  /** armed (or stale running) → running, attempt+1. Null = not claimable. */
  claimTurn(contactId: string, runId: string, now: Date): Promise<LeadRecord | null>;
  /** Fenced on (contactId, runId, attempt, running). False = lost the claim. */
  updateLead(fence: TurnFence, patch: Partial<LeadRecord>): Promise<boolean>;
  /** running → idle (fenced), applying `patch`; with `rearm` it goes straight back to armed with a new runId. */
  finishTurn(
    fence: TurnFence,
    patch: Partial<LeadRecord>,
    opts: { rearm: boolean }
  ): Promise<{ ok: boolean; rearmedRunId: string | null }>;
  /** Admin actions (pause/resume/take over) — not part of a turn. */
  updateLeadUnfenced(contactId: string, patch: Partial<LeadRecord>): Promise<void>;
  createMessage(msg: NewMessage): Promise<MessageRecord>;
  getMessage(id: string): Promise<MessageRecord | null>;
  /** Conditional transition: only if the current status is in `from`. Null = not transitioned. */
  transitionMessage(
    id: string,
    from: MessageStatus[],
    to: MessageStatus,
    patch?: Partial<MessageRecord>
  ): Promise<MessageRecord | null>;
  /** draft/approved → superseded for this lead. Returns how many. */
  supersedePendingDrafts(contactId: string, reason: string): Promise<number>;
  listContactMessages(contactId: string, limit: number): Promise<MessageRecord[]>;
  /** GHL ids of everything this app sent to the contact (classifier: OURS). */
  knownGhlMessageIds(contactId: string): Promise<Set<string>>;
  recordEvent(contactId: string, type: string, detail?: Record<string, unknown>): Promise<void>;
  isSuppressed(e164: string): Promise<boolean>;
  addSuppression(s: {
    e164: string;
    scope: SuppressionScope;
    source: string;
    rawText: string | null;
    contactId: string | null;
  }): Promise<void>;
  liftSuppression(e164: string, reason: string): Promise<boolean>;
  /** Atomic reserve against the day's budget (micro-USD). False = over budget. */
  reserveBudget(day: string, micros: number, limitMicros: number): Promise<boolean>;
  /** Replace the reservation with the actual cost, and count the turn. */
  settleBudget(day: string, reservedMicros: number, actualMicros: number): Promise<void>;
  /** Turns started by any lead since `since` (global hourly cap). */
  countTurnsSince(since: Date): Promise<number>;
}

export type AiSetterSettings = {
  paused: boolean;
  busyUntil: Date | null;
  schedule: WeeklySchedule;
  /** templateId → approved content hash. Unapproved templates go to the inbox like free text. */
  approvedTemplates: Record<string, string>;
  /** True when the read failed: callers MUST treat it as paused (fail closed). */
  failedClosed: boolean;
};

export interface SettingsPort {
  read(): Promise<AiSetterSettings>;
}

export type HandoffReason =
  | "asked_for_person"
  | "pricing_detail"
  | "health"
  | "medicare"
  | "existing_client"
  | "complaint"
  | "legal"
  | "confused"
  | "media"
  | "stale_message"
  | "model_refused"
  | "guard_failed"
  | "other";

/** Alerts never carry the lead's message text — first name, product, state, local time only. */
export type NotifyEvent =
  | {
      kind: "draft_ready";
      messageId: string;
      contactId: string;
      firstName: string | null;
      product: ProductLine | null;
      state: string | null;
      leadLocalTime: string;
      /** When the draft will go out if approved now ("now" or a local time). */
      sendsAt: string;
      /**
       * The AI's draft text (our outbound words, never the lead's message), ≤ 500 chars, so Isaac
       * reads what he approves with [Enviar]. Null for template drafts.
       */
      preview: string | null;
    }
  | {
      kind: "call_now";
      contactId: string;
      firstName: string | null;
      product: ProductLine | null;
      state: string | null;
      leadLocalTime: string;
    }
  | {
      kind: "handoff";
      contactId: string;
      firstName: string | null;
      product: ProductLine | null;
      state: string | null;
      reason: HandoffReason;
      urgent: boolean;
    }
  | { kind: "booked"; contactId: string; firstName: string | null; product: ProductLine | null; whenLabel: string }
  /**
   * `aiManaged` false: an opt-out from a contact the AI doesn't manage (not enrolled / excluded);
   * the app only recorded it in its suppression list — Isaac decides the CRM's DND.
   */
  | { kind: "opted_out"; contactId: string; firstName: string | null; aiManaged: boolean }
  | { kind: "optout_ambiguous"; contactId: string; firstName: string | null }
  | { kind: "loop_paused"; contactId: string; firstName: string | null }
  | { kind: "budget"; percent: 50 | 80 | 100 }
  | { kind: "error"; detail: string };

export interface NotifyPort {
  notify(event: NotifyEvent): Promise<void>;
}

/** Enums only — never the call summary's free text (it carries health and money details). */
export type CallSignal = {
  disposition: string | null;
  lineOfBusiness: string | null;
  language: Lang | null;
  followUpDateIso: Date | null;
  at: Date;
};

export interface CallsPort {
  latestCall(contactId: string): Promise<CallSignal | null>;
  /** Sold / enrolled / signed / completed intake, from the app DB. */
  isClient(contactId: string): Promise<boolean>;
}

export interface LicensePort {
  /** 2-letter codes Isaac is licensed in. Null = unknown (the gate is skipped, logged). */
  licensedStateCodes(): Promise<string[] | null>;
}

/**
 * Why a turn runs. `inbound` = the lead (or Isaac) wrote something; the call-now reasons run a
 * turn without a new inbound so the model offers two times after Isaac didn't/couldn't call.
 */
export type TurnReason = "inbound" | "call_now_timeout" | "call_now_declined";

/** QStash jobs, behind a port so the core never publishes directly (and tests can record them). */
export interface QueuePort {
  publishTurn(
    contactId: string,
    runId: string,
    delaySeconds: number,
    opts?: { retry?: number; reason?: TurnReason }
  ): Promise<boolean>;
  /** `notBefore` holds the send until the lead's window opens. */
  publishSend(messageId: string, notBefore: Date | null): Promise<boolean>;
  publishVerifySend(messageId: string, delaySeconds: number): Promise<boolean>;
  publishCallNowTimeout(contactId: string, requestedAtIso: string, delaySeconds: number): Promise<boolean>;
}

export type AiSetterLogger = {
  readonly debugEnabled: boolean;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

/** Everything a turn, a send or an action needs, injected (fakes in tests, real adapters in process.ts). */
export type AiSetterPorts = {
  ghl: GhlPort;
  llm: LlmPort;
  store: StorePort;
  settings: SettingsPort;
  notify: NotifyPort;
  calls: CallsPort;
  license: LicensePort;
  queue: QueuePort;
  now: () => Date;
  /** Epoch ms after which no new model call or GHL write starts. */
  deadlineAt: number;
  log: AiSetterLogger;
  config: import("./config").AiSetterConfig;
};
