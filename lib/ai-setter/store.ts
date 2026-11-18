/**
 * Postgres store for the AI Setter: `aiSetterStore` implements `StorePort` (./types.ts), plus what
 * the admin panel, its actions, the reconcile and the retention job need.
 *
 * Every guard is ONE SQL statement, the pattern of lib/phone-finder/store.ts: the Neon HTTP driver
 * has no interactive transactions, and two webhook deliveries (or a QStash retry racing the daily
 * reconcile) must never both run a turn, send a message or spend the same budget. `db.batch` (one
 * HTTP transaction) only pairs a write with the read that follows it.
 *
 * Nothing here logs: rows hold message text, and the callers own the PII-free logging.
 */

import "server-only";

import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/lib/db";
import {
  aiSetterDailyUsage,
  aiSetterEvents,
  aiSetterLeads,
  aiSetterMessages,
  aiSetterSuppressions,
} from "@/lib/db/schema";

import type {
  Channel,
  Lang,
  LeadRecord,
  LeadStatus,
  MessageKind,
  MessageRecord,
  MessageStatus,
  NewMessage,
  ProductLine,
  Register,
  StorePort,
  SuppressionScope,
  TurnFence,
  TurnState,
} from "./types";

type LeadRow = typeof aiSetterLeads.$inferSelect;
type LeadColumns = Partial<typeof aiSetterLeads.$inferInsert>;
type MessageRow = typeof aiSetterMessages.$inferSelect;
type MessageColumns = Partial<typeof aiSetterMessages.$inferInsert>;

const L = aiSetterLeads;
const M = aiSetterMessages;
const E = aiSetterEvents;
const S = aiSetterSuppressions;
const U = aiSetterDailyUsage;

/** An armed or running turn untouched this long has died: the queue route's maxDuration is 300 s. */
const STALE_TURN_MS = 6 * 60_000;
/** The daily reconcile picks up turns nobody has touched for this long. */
const RECONCILE_AFTER_MS = 10 * 60_000;
/** `countTurnsSince` counts these events (the turn engine records one per turn it starts). */
const TURN_EVENT_TYPE = "turn";
const INT4_MAX = 2_147_483_647;
const ERROR_MAX_CHARS = 300;
/** Opt-out evidence kept with a suppression (the caller masks it first). */
const RAW_TEXT_MAX_CHARS = 200;
const MAX_LIST_LIMIT = 500;
/** An `intent` the retention keeps: a plain code (the rule of `safeCode` in ./text-utils), as a Postgres regex. */
const SIMPLE_CODE_PATTERN = "^[a-z_]{1,40}$";

/** What the inbox shows: everything waiting on Isaac, plus what went wrong. */
const INBOX_STATUSES: MessageStatus[] = ["draft", "shadow", "stale", "blocked", "send_unknown", "failed"];
/** Not out the door yet: a newer draft or a human reply replaces these. */
const PENDING_STATUSES: MessageStatus[] = ["draft", "approved", "shadow"];

// ─── Narrowing: each map lists every member of its union, so TypeScript flags a missing one ──

const LEAD_STATUSES: Record<LeadStatus, true> = {
  active: true,
  paused: true,
  handoff: true,
  booked: true,
  stopped: true,
  opted_out: true,
};
const TURN_STATES: Record<TurnState, true> = { idle: true, armed: true, running: true };
const LANGS: Record<Lang, true> = { en: true, es: true };
const REGISTERS: Record<Register, true> = { usted: true, tu: true };
const PRODUCTS: Record<ProductLine, true> = {
  aca: true,
  short_term_medical: true,
  dental_vision: true,
  hospital_indemnity: true,
  final_expense: true,
  iul: true,
  life_insurance: true,
  health_alternative: true,
  general: true,
};
const CALL_NOW_STATES: Record<NonNullable<LeadRecord["callNowState"]>, true> = {
  waiting: true,
  calling: true,
  declined: true,
  timeout: true,
};
const CHANNELS: Record<Channel, true> = { SMS: true, WhatsApp: true };
const KINDS: Record<MessageKind, true> = { template: true, free_text: true };
const NO_MESSAGES: Record<MessageStatus, number> = {
  draft: 0,
  approved: 0,
  sending: 0,
  sent: 0,
  send_unknown: 0,
  failed: 0,
  stale: 0,
  rejected: 0,
  superseded: 0,
  blocked: 0,
  shadow: 0,
};

function isMember<T extends string>(members: Record<T, unknown>, value: string | null): value is T {
  return value !== null && Object.prototype.hasOwnProperty.call(members, value);
}

function memberOrNull<T extends string>(members: Record<T, unknown>, value: string | null): T | null {
  return isMember(members, value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBookingIntent(value: unknown): value is NonNullable<LeadRecord["bookingIntent"]> {
  return (
    isRecord(value) &&
    typeof value.slotIso === "string" &&
    typeof value.calendarId === "string" &&
    typeof value.runId === "string"
  );
}

// ─── Row → record ──────────────────────────────────────────────────────────────────────────

function toLead(row: LeadRow): LeadRecord {
  return {
    contactId: row.contactId,
    firstName: row.firstName,
    // An unknown value fails closed: the AI does not answer a paused lead.
    status: isMember(LEAD_STATUSES, row.status) ? row.status : "paused",
    language: memberOrNull(LANGS, row.language),
    register: memberOrNull(REGISTERS, row.register),
    product: memberOrNull(PRODUCTS, row.product),
    leadTimezone: row.leadTimezone,
    stateCode: row.stateCode,
    runId: row.runId,
    attempt: row.attemptCount,
    turnState: isMember(TURN_STATES, row.turnState) ? row.turnState : "idle",
    armedAt: row.armedAt,
    lastHandledInboundId: row.lastHandledInboundId,
    lastHandledInboundAt: row.lastHandledInboundAt,
    lastInboundAt: row.lastInboundAt,
    lastAiOutboundAt: row.lastAiOutboundAt,
    disclosedChannels: isRecord(row.disclosedChannels) ? row.disclosedChannels : {},
    pausedUntil: row.pausedUntil,
    pauseReason: row.pauseReason,
    offeredSlots: Array.isArray(row.offeredSlots) ? row.offeredSlots : [],
    offeredAt: row.offeredAt,
    rejectionsCount: row.rejectionsCount,
    appointmentId: row.appointmentId,
    appointmentAt: row.appointmentAt,
    calendarId: row.calendarId,
    bookingIntent: isBookingIntent(row.bookingIntent) ? row.bookingIntent : null,
    callNowState: memberOrNull(CALL_NOW_STATES, row.callNowState),
    callNowRequestedAt: row.callNowRequestedAt,
    turnsDay: row.turnsDay,
    turnsToday: row.turnsToday,
    threadTurns: row.threadTurns,
    optOutPending: row.optOutPending,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    contactId: row.contactId,
    channel: isMember(CHANNELS, row.channel) ? row.channel : "SMS",
    // Unknown values fail closed: free text always waits for Isaac, and `blocked` never sends.
    kind: isMember(KINDS, row.kind) ? row.kind : "free_text",
    templateId: row.templateId,
    templateHash: row.templateHash,
    body: row.body,
    originalBody: row.originalBody,
    status: isMember(NO_MESSAGES, row.status) ? row.status : "blocked",
    intent: row.intent,
    inReplyToInboundId: row.inReplyToInboundId,
    turnRunId: row.turnRunId,
    ghlMessageId: row.ghlMessageId,
    decision: isRecord(row.decision) ? row.decision : null,
    guardFlags: Array.isArray(row.guardFlags) ? row.guardFlags.filter((f): f is string => typeof f === "string") : [],
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cacheReadTokens: row.cacheReadTokens,
    costMicros: row.costMicros,
    usedFallback: row.usedFallback,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    sentAt: row.sentAt,
    notBefore: row.notBefore,
    expiresAt: row.expiresAt,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Record patch → columns ────────────────────────────────────────────────────────────────

/** Drops `undefined` keys: in a patch, undefined means "leave this column alone". */
function definedOnly<T extends object>(columns: T): Partial<T> {
  return Object.fromEntries(Object.entries(columns).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Integer columns reject 12.5 and NaN; these counters are never negative. */
function toCount(value: number): number {
  return Number.isFinite(value) ? Math.min(INT4_MAX, Math.max(0, Math.round(value))) : 0;
}

function countOrUndefined(value: number | undefined): number | undefined {
  return value === undefined ? undefined : toCount(value);
}

function clip(text: string | null | undefined, max: number): string | null | undefined {
  return typeof text === "string" ? text.slice(0, max) : text;
}

/**
 * Only keys present in the patch are written. The fence (`runId`, `attempt`, `turnState`,
 * `armedAt`), `contactId` and the timestamps belong to the store: a patch never touches them.
 */
function leadColumns(p: Partial<LeadRecord>): LeadColumns {
  return definedOnly({
    firstName: p.firstName,
    status: p.status,
    language: p.language,
    register: p.register,
    product: p.product,
    leadTimezone: p.leadTimezone,
    stateCode: p.stateCode,
    lastHandledInboundId: p.lastHandledInboundId,
    lastHandledInboundAt: p.lastHandledInboundAt,
    lastInboundAt: p.lastInboundAt,
    lastAiOutboundAt: p.lastAiOutboundAt,
    disclosedChannels: p.disclosedChannels,
    pausedUntil: p.pausedUntil,
    pauseReason: p.pauseReason,
    offeredSlots: p.offeredSlots,
    offeredAt: p.offeredAt,
    rejectionsCount: countOrUndefined(p.rejectionsCount),
    appointmentId: p.appointmentId,
    appointmentAt: p.appointmentAt,
    calendarId: p.calendarId,
    bookingIntent: p.bookingIntent,
    callNowState: p.callNowState,
    callNowRequestedAt: p.callNowRequestedAt,
    turnsDay: p.turnsDay,
    turnsToday: countOrUndefined(p.turnsToday),
    threadTurns: countOrUndefined(p.threadTurns),
    optOutPending: p.optOutPending,
  });
}

/** Same rule for messages: `id`, `contactId`, `status` (set by the transition) and timestamps are the store's. */
function messageColumns(p: Partial<MessageRecord>): MessageColumns {
  return definedOnly({
    channel: p.channel,
    kind: p.kind,
    templateId: p.templateId,
    templateHash: p.templateHash,
    body: p.body,
    originalBody: p.originalBody,
    intent: p.intent,
    inReplyToInboundId: p.inReplyToInboundId,
    turnRunId: p.turnRunId,
    ghlMessageId: p.ghlMessageId,
    decision: p.decision,
    guardFlags: p.guardFlags,
    model: p.model,
    inputTokens: countOrUndefined(p.inputTokens),
    outputTokens: countOrUndefined(p.outputTokens),
    cacheReadTokens: countOrUndefined(p.cacheReadTokens),
    costMicros: countOrUndefined(p.costMicros),
    usedFallback: p.usedFallback,
    approvedBy: p.approvedBy,
    approvedAt: p.approvedAt,
    sentAt: p.sentAt,
    notBefore: p.notBefore,
    expiresAt: p.expiresAt,
    error: clip(p.error, ERROR_MAX_CHARS),
  });
}

function newRunId(): string {
  return `ais_${nanoid(16)}`;
}

function clampLimit(limit: number | undefined, fallback: number): number {
  const n = limit === undefined || !Number.isFinite(limit) ? fallback : Math.round(limit);
  return Math.min(MAX_LIST_LIMIT, Math.max(1, n));
}

/** Matches only the worker holding this attempt's claim. */
function fenced(fence: TurnFence) {
  return and(
    eq(L.contactId, fence.contactId),
    eq(L.runId, fence.runId),
    eq(L.attemptCount, fence.attempt),
    eq(L.turnState, "running")
  );
}

// ─── Leads and turns ───────────────────────────────────────────────────────────────────────

async function getLead(contactId: string): Promise<LeadRecord | null> {
  const rows = await db.select().from(L).where(eq(L.contactId, contactId)).limit(1);
  return rows[0] ? toLead(rows[0]) : null;
}

/** INSERT … ON CONFLICT DO NOTHING, then SELECT, in one HTTP transaction. Never overwrites. */
async function ensureLead(contactId: string, init: Partial<LeadRecord>): Promise<LeadRecord> {
  const now = new Date();
  const [, rows] = await db.batch([
    db
      .insert(L)
      .values({ ...leadColumns(init), contactId, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: L.contactId }),
    db.select().from(L).where(eq(L.contactId, contactId)).limit(1),
  ]);
  const row = rows[0];
  if (!row) throw new Error("ai_setter_leads row missing after ensureLead");
  return toLead(row);
}

/**
 * Arms a turn unless one is already armed or running (a burst of messages becomes one turn). A
 * turn untouched for 6+ minutes is dead and may be replaced. Only the caller that armed publishes.
 *
 * A poke that lands while a turn is RUNNING is not lost: it sets `poke_pending`, and that turn's
 * `finishTurn` re-arms instead of going idle (the running turn read GHL before this message
 * arrived — an opt-out or Isaac's own reply among them).
 */
async function armTurn(contactId: string, now: Date): Promise<{ armed: boolean; runId: string | null }> {
  const runId = newRunId();
  const staleBefore = new Date(now.getTime() - STALE_TURN_MS);
  const rows = await db
    .insert(L)
    .values({ contactId, runId, turnState: "armed", attemptCount: 0, armedAt: now, pokePending: false, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: L.contactId,
      set: { runId, turnState: "armed", attemptCount: 0, armedAt: now, pokePending: false, updatedAt: now },
      where: or(eq(L.turnState, "idle"), lte(L.updatedAt, staleBefore)),
    })
    .returning({ runId: L.runId });
  const got = rows[0]?.runId ?? null;
  if (got === runId) return { armed: true, runId: got };
  // Not armed: one is armed (it will read this message) or running (flag it for the re-arm).
  // `updated_at` is left alone so a live turn's staleness clock isn't reset by pokes.
  await db
    .update(L)
    .set({ pokePending: true })
    .where(and(eq(L.contactId, contactId), eq(L.turnState, "running")));
  return { armed: false, runId: null };
}

/** armed (or a dead `running`) → running, attempt + 1. Null = finished, replaced, or running elsewhere. */
async function claimTurn(contactId: string, runId: string, now: Date): Promise<LeadRecord | null> {
  const staleBefore = new Date(now.getTime() - STALE_TURN_MS);
  const rows = await db
    .update(L)
    .set({ turnState: "running", attemptCount: sql`${L.attemptCount} + 1`, updatedAt: now })
    .where(
      and(
        eq(L.contactId, contactId),
        eq(L.runId, runId),
        or(eq(L.turnState, "armed"), and(eq(L.turnState, "running"), lte(L.updatedAt, staleBefore)))
      )
    )
    .returning();
  return rows[0] ? toLead(rows[0]) : null;
}

/** Fenced write; it also refreshes `updated_at`, which keeps a live turn from looking dead. */
async function updateLead(fence: TurnFence, patch: Partial<LeadRecord>): Promise<boolean> {
  const rows = await db
    .update(L)
    .set({ ...leadColumns(patch), updatedAt: new Date() })
    .where(fenced(fence))
    .returning({ contactId: L.contactId });
  return rows.length > 0;
}

async function finishTurn(
  fence: TurnFence,
  patch: Partial<LeadRecord>,
  opts: { rearm: boolean }
): Promise<{ ok: boolean; rearmedRunId: string | null }> {
  const now = new Date();
  const runId = newRunId();
  // Re-arm when asked, or when a poke arrived while this turn ran (`poke_pending`); one UPDATE,
  // so a poke can't slip between "read the flag" and "go idle".
  const rearm = opts.rearm ? sql<boolean>`true` : sql<boolean>`${L.pokePending}`;
  const rows = await db
    .update(L)
    .set({
      ...leadColumns(patch),
      turnState: sql`CASE WHEN ${rearm} THEN 'armed' ELSE 'idle' END`,
      runId: sql`CASE WHEN ${rearm} THEN ${runId}::text ELSE ${L.runId} END`,
      attemptCount: sql`CASE WHEN ${rearm} THEN 0 ELSE ${L.attemptCount} END`,
      // Same wire format drizzle uses for `timestamp` columns (ISO, read as UTC wall time).
      armedAt: sql`CASE WHEN ${rearm} THEN ${now.toISOString()}::timestamp ELSE ${L.armedAt} END`,
      pokePending: false,
      updatedAt: now,
    })
    .where(fenced(fence))
    .returning({ turnState: L.turnState, runId: L.runId });
  const row = rows[0];
  if (!row) return { ok: false, rearmedRunId: null };
  return { ok: true, rearmedRunId: row.turnState === "armed" && row.runId === runId ? runId : null };
}

async function updateLeadUnfenced(contactId: string, patch: Partial<LeadRecord>): Promise<void> {
  await db
    .update(L)
    .set({ ...leadColumns(patch), updatedAt: new Date() })
    .where(eq(L.contactId, contactId));
}

// ─── Messages ──────────────────────────────────────────────────────────────────────────────

async function createMessage(msg: NewMessage): Promise<MessageRecord> {
  const now = new Date();
  const rows = await db
    .insert(M)
    .values({
      ...messageColumns(msg),
      id: `aim_${nanoid(16)}`,
      contactId: msg.contactId,
      channel: msg.channel,
      kind: msg.kind,
      status: msg.status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("ai_setter_messages insert returned no row");
  return toMessage(row);
}

async function getMessage(id: string): Promise<MessageRecord | null> {
  const rows = await db.select().from(M).where(eq(M.id, id)).limit(1);
  return rows[0] ? toMessage(rows[0]) : null;
}

async function transitionMessage(
  id: string,
  from: MessageStatus[],
  to: MessageStatus,
  patch: Partial<MessageRecord> = {}
): Promise<MessageRecord | null> {
  if (from.length === 0) return null;
  const rows = await db
    .update(M)
    .set({ ...messageColumns(patch), status: to, updatedAt: new Date() })
    .where(and(eq(M.id, id), inArray(M.status, from)))
    .returning();
  return rows[0] ? toMessage(rows[0]) : null;
}

/**
 * draft / approved / shadow → superseded; `reason` lands in `error` (why it never went out).
 * Compliance rows (`decision.compliance` true: the opt-out confirmation, the HELP reply) are left
 * alone: a newer draft or a human reply never cancels a text the rules require.
 */
async function supersedePendingDrafts(contactId: string, reason: string): Promise<number> {
  const rows = await db
    .update(M)
    .set({ status: "superseded", error: reason.slice(0, ERROR_MAX_CHARS), updatedAt: new Date() })
    .where(
      and(
        eq(M.contactId, contactId),
        inArray(M.status, PENDING_STATUSES),
        // NULL decision (or no `compliance` key) counts as "not compliance".
        sql`(${M.decision}->>'compliance') IS DISTINCT FROM 'true'`
      )
    )
    .returning({ id: M.id });
  return rows.length;
}

/** Newest first. */
async function listContactMessages(contactId: string, limit: number): Promise<MessageRecord[]> {
  const rows = await db
    .select()
    .from(M)
    .where(eq(M.contactId, contactId))
    .orderBy(desc(M.createdAt))
    .limit(clampLimit(limit, 50));
  return rows.map(toMessage);
}

async function knownGhlMessageIds(contactId: string): Promise<Set<string>> {
  const rows = await db
    .select({ ghlMessageId: M.ghlMessageId })
    .from(M)
    .where(and(eq(M.contactId, contactId), isNotNull(M.ghlMessageId)));
  return new Set(rows.flatMap((r) => (r.ghlMessageId ? [r.ghlMessageId] : [])));
}

async function recordEvent(contactId: string, type: string, detail?: Record<string, unknown>): Promise<void> {
  await db.insert(E).values({ id: `aie_${nanoid(16)}`, contactId, type, detail: detail ?? null, at: new Date() });
}

// ─── Suppressions (by phone, forever) ──────────────────────────────────────────────────────

async function isSuppressed(e164: string): Promise<boolean> {
  const rows = await db
    .select({ e164: S.e164 })
    .from(S)
    .where(and(eq(S.e164, e164.trim()), isNull(S.liftedAt)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Upsert. While a suppression is live a repeat only widens it (sms + whatsapp → all) and keeps the
 * FIRST opt-out's evidence; on a lifted row it starts over. Either way `lifted_at` is cleared.
 * `rawText` is stored clipped to 200 characters; masking it is the caller's job.
 */
async function addSuppression(s: {
  e164: string;
  scope: SuppressionScope;
  source: string;
  rawText: string | null;
  contactId: string | null;
}): Promise<void> {
  const lifted = sql`${S.liftedAt} IS NOT NULL`;
  await db
    .insert(S)
    .values({
      e164: s.e164.trim(),
      scope: s.scope,
      source: s.source,
      rawText: clip(s.rawText, RAW_TEXT_MAX_CHARS),
      contactId: s.contactId,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: S.e164,
      set: {
        scope: sql`CASE WHEN ${lifted} OR ${S.scope} = excluded.scope THEN excluded.scope ELSE 'all' END`,
        source: sql`CASE WHEN ${lifted} THEN excluded.source ELSE ${S.source} END`,
        rawText: sql`CASE WHEN ${lifted} THEN excluded.raw_text ELSE COALESCE(${S.rawText}, excluded.raw_text) END`,
        contactId: sql`CASE WHEN ${lifted} THEN COALESCE(excluded.contact_id, ${S.contactId}) ELSE COALESCE(${S.contactId}, excluded.contact_id) END`,
        createdAt: sql`CASE WHEN ${lifted} THEN excluded.created_at ELSE ${S.createdAt} END`,
        liftedAt: null,
        liftReason: null,
      },
    });
}

/** START / UNSTOP. The row stays (with when and why); false = nothing live to lift. */
async function liftSuppression(e164: string, reason: string): Promise<boolean> {
  const rows = await db
    .update(S)
    .set({ liftedAt: new Date(), liftReason: reason.slice(0, ERROR_MAX_CHARS) })
    .where(and(eq(S.e164, e164.trim()), isNull(S.liftedAt)))
    .returning({ e164: S.e164 });
  return rows.length > 0;
}

// ─── Daily budget (micro-USD) ──────────────────────────────────────────────────────────────

/** Reserve before calling Claude. One statement: two turns can never both take the last dollars. */
async function reserveBudget(day: string, micros: number, limitMicros: number): Promise<boolean> {
  if (!Number.isFinite(micros) || !Number.isFinite(limitMicros)) return false;
  const amount = Math.ceil(Math.max(0, micros));
  const limit = Math.floor(limitMicros);
  if (limit <= 0 || amount > Math.min(limit, INT4_MAX)) return false;
  const now = new Date();
  const rows = await db
    .insert(U)
    .values({ day, reservedMicros: amount, updatedAt: now })
    .onConflictDoUpdate({
      target: U.day,
      set: { reservedMicros: sql`${U.reservedMicros} + ${amount}`, updatedAt: now },
      // Summed as bigint so the check itself can never overflow the int4 columns.
      where: sql`${U.reservedMicros}::bigint + ${U.costMicros} + ${amount} <= ${limit}`,
    })
    .returning({ day: U.day });
  return rows.length > 0;
}

async function settleBudget(day: string, reservedMicros: number, actualMicros: number): Promise<void> {
  const reserved = toCount(reservedMicros);
  const actual = toCount(actualMicros);
  const now = new Date();
  await db
    .insert(U)
    .values({ day, turns: 1, costMicros: actual, updatedAt: now })
    .onConflictDoUpdate({
      target: U.day,
      set: {
        reservedMicros: sql`GREATEST(${U.reservedMicros} - ${reserved}, 0)`,
        costMicros: sql`${U.costMicros} + ${actual}`,
        turns: sql`${U.turns} + 1`,
        updatedAt: now,
      },
    });
}

async function countTurnsSince(since: Date): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(E)
    .where(and(eq(E.type, TURN_EVENT_TYPE), gte(E.at, since)));
  return rows[0]?.n ?? 0;
}

/** Postgres-backed `StorePort` for the webhook, the turn engine and the send / reconcile jobs. */
export const aiSetterStore: StorePort = {
  getLead,
  ensureLead,
  armTurn,
  claimTurn,
  updateLead,
  finishTurn,
  updateLeadUnfenced,
  createMessage,
  getMessage,
  transitionMessage,
  supersedePendingDrafts,
  listContactMessages,
  knownGhlMessageIds,
  recordEvent,
  isSuppressed,
  addSuppression,
  liftSuppression,
  reserveBudget,
  settleBudget,
  countTurnsSince,
};

// ─── Admin panel, reconcile and retention ──────────────────────────────────────────────────

/** Inbox: drafts waiting on Isaac, shadow-mode replies and the messages that went wrong. Newest first. */
export async function listInbox(limit = 50): Promise<Array<MessageRecord & { lead: LeadRecord | null }>> {
  const rows = await db
    .select({ message: M, lead: L })
    .from(M)
    .leftJoin(L, eq(L.contactId, M.contactId))
    .where(inArray(M.status, INBOX_STATUSES))
    .orderBy(desc(M.createdAt))
    .limit(clampLimit(limit, 50));
  return rows.map((r) => ({ ...toMessage(r.message), lead: r.lead ? toLead(r.lead) : null }));
}

/** Leads, most recently updated first; optionally one status only. */
export async function listLeads(opts: { status?: LeadStatus; limit?: number } = {}): Promise<LeadRecord[]> {
  const rows = await db
    .select()
    .from(L)
    .where(opts.status ? eq(L.status, opts.status) : undefined)
    .orderBy(desc(L.updatedAt))
    .limit(clampLimit(opts.limit, 100));
  return rows.map(toLead);
}

/** One agent-local day's spend row (zeros when nothing ran that day). */
export async function getDailyStats(
  day: string
): Promise<{ turns: number; costMicros: number; sends: number; reservedMicros: number }> {
  const rows = await db
    .select({ turns: U.turns, costMicros: U.costMicros, sends: U.sends, reservedMicros: U.reservedMicros })
    .from(U)
    .where(eq(U.day, day))
    .limit(1);
  return rows[0] ?? { turns: 0, costMicros: 0, sends: 0, reservedMicros: 0 };
}

/** Messages created since `since`, by status. Every status key is present (0 when none). */
export async function countMessagesSince(since: Date): Promise<Record<MessageStatus, number>> {
  const rows = await db
    .select({ status: M.status, n: count() })
    .from(M)
    .where(gte(M.createdAt, since))
    .groupBy(M.status);
  const counts: Record<MessageStatus, number> = { ...NO_MESSAGES };
  for (const row of rows) {
    if (isMember(NO_MESSAGES, row.status)) counts[row.status] = row.n;
  }
  return counts;
}

/** Turns QStash never finished: armed or running, untouched for 10+ minutes. Oldest first. */
export async function findReconcilableTurns(limit: number, now: Date): Promise<LeadRecord[]> {
  const before = new Date(now.getTime() - RECONCILE_AFTER_MS);
  const rows = await db
    .select()
    .from(L)
    .where(and(inArray(L.turnState, ["armed", "running"]), lte(L.updatedAt, before)))
    .orderBy(asc(L.updatedAt))
    .limit(clampLimit(limit, 20));
  return rows.map(toLead);
}

/** Approved messages whose hold (`not_before`) has passed. Oldest first. */
export async function findApprovedToSend(limit: number, now: Date): Promise<MessageRecord[]> {
  const rows = await db
    .select()
    .from(M)
    .where(and(eq(M.status, "approved"), or(isNull(M.notBefore), lte(M.notBefore, now))))
    .orderBy(asc(M.createdAt))
    .limit(clampLimit(limit, 20));
  return rows.map(toMessage);
}

/**
 * Messages left in `sending` (the worker died around the POST) and untouched since `olderThan`.
 * Oldest first. The reconcile checks each one against the GHL thread: never a blind resend.
 */
export async function findStuckSending(olderThan: Date, limit: number): Promise<MessageRecord[]> {
  const rows = await db
    .select()
    .from(M)
    .where(and(eq(M.status, "sending"), lte(M.updatedAt, olderThan)))
    .orderBy(asc(M.updatedAt))
    .limit(clampLimit(limit, 20));
  return rows.map(toMessage);
}

/** draft with `expires_at <= now` → stale (error "draft_expired"). Returns how many. */
export async function expireDrafts(now: Date): Promise<number> {
  const rows = await db
    .update(M)
    .set({ status: "stale", error: "draft_expired", updatedAt: now })
    .where(and(eq(M.status, "draft"), lte(M.expiresAt, now)))
    .returning({ id: M.id });
  return rows.length;
}

/**
 * 90-day retention for messages created before `before`: clears `body` / `original_body`, drops an
 * `intent` that isn't a plain code, and cuts every guard flag to its code ("money:<word>" →
 * "money": the part after the colon quotes the message). The rest of the metadata stays.
 * Suppressions are never touched (they are kept forever). Returns how many rows changed.
 */
export async function purgeOldMessageText(before: Date): Promise<number> {
  const intentIsCode = sql`${M.intent} ~ ${SIMPLE_CODE_PATTERN}`;
  const rows = await db
    .update(M)
    .set({
      body: null,
      originalBody: null,
      intent: sql`CASE WHEN ${intentIsCode} THEN ${M.intent} ELSE NULL END`,
      // Non-string entries are dropped; a column that isn't a JSON array becomes [].
      guardFlags: sql`CASE WHEN jsonb_typeof(${M.guardFlags}) = 'array' THEN COALESCE((
        SELECT jsonb_agg(split_part(item.flag #>> '{}', ':', 1) ORDER BY item.ord)
        FROM jsonb_array_elements(${M.guardFlags}) WITH ORDINALITY AS item(flag, ord)
        WHERE jsonb_typeof(item.flag) = 'string'
      ), '[]'::jsonb) ELSE '[]'::jsonb END`,
    })
    .where(
      and(
        lt(M.createdAt, before),
        or(
          isNotNull(M.body),
          isNotNull(M.originalBody),
          and(isNotNull(M.intent), sql`NOT (${intentIsCode})`),
          // A flag with a detail (or anything but a plain list of codes) has a ":" in its JSON text.
          sql`${M.guardFlags}::text LIKE '%:%'`
        )
      )
    )
    .returning({ id: M.id });
  return rows.length;
}

/** A lead's audit trail, newest first. */
export async function listEvents(
  contactId: string,
  limit: number
): Promise<Array<{ type: string; detail: Record<string, unknown> | null; at: Date }>> {
  const rows = await db
    .select({ type: E.type, detail: E.detail, at: E.at })
    .from(E)
    .where(eq(E.contactId, contactId))
    .orderBy(desc(E.at))
    .limit(clampLimit(limit, 50));
  return rows.map((r) => ({ type: r.type, detail: isRecord(r.detail) ? r.detail : null, at: r.at }));
}

/**
 * How many `type` events one lead logged since `since`, counted in SQL (e.g. the webhook flood
 * guard). Prefer it over filtering `listEvents`, whose newest-N window mixes every event type.
 */
export async function countContactEventsSince(contactId: string, type: string, since: Date): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(E)
    .where(and(eq(E.contactId, contactId), eq(E.type, type), gte(E.at, since)));
  return rows[0]?.n ?? 0;
}

/** Counts one message that actually went out today (the panel's "sends"). */
export async function incrementDailySends(day: string): Promise<void> {
  const now = new Date();
  await db
    .insert(U)
    .values({ day, sends: 1, updatedAt: now })
    .onConflictDoUpdate({ target: U.day, set: { sends: sql`${U.sends} + 1`, updatedAt: now } });
}

// ─── Admin actions (unfenced) ──────────────────────────────────────────────────────────────

/**
 * Voids the lead's turn, whatever state it is in: back to idle under a NEW run id with attempt 0.
 * A turn running right now loses its fence (its next fenced `updateLead` / `finishTurn` matches
 * nothing), and a queued job for the old run can no longer claim it. For take-over and pause.
 */
export async function invalidateTurn(contactId: string): Promise<void> {
  await db
    .update(L)
    .set({ turnState: "idle", runId: newRunId(), attemptCount: 0, pokePending: false, updatedAt: new Date() })
    .where(eq(L.contactId, contactId));
}

/**
 * Re-opens every inbound from `toBefore` on: clears `last_handled_inbound_id` and sets
 * `last_handled_inbound_at` 1 ms before `toBefore` (a turn answers inbound strictly after it).
 * Unfenced; used to regenerate a reply. Throws a RangeError on an invalid date.
 */
export async function rewindWatermark(contactId: string, toBefore: Date): Promise<void> {
  const ms = toBefore.getTime();
  if (!Number.isFinite(ms)) throw new RangeError("rewindWatermark: invalid date");
  await db
    .update(L)
    .set({ lastHandledInboundId: null, lastHandledInboundAt: new Date(ms - 1), updatedAt: new Date() })
    .where(eq(L.contactId, contactId));
}
