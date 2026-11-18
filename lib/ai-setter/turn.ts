/**
 * One AI Setter turn for one contact: claim → read GHL → deterministic rules → Claude → checks →
 * dispatch → finish. Called by the QStash consumer only (never inline in a webhook).
 *
 * Order matters and is deliberate:
 *   1. opt-outs are decided by CODE first, on every inbound text channel and for every turn
 *      reason (FL 501.059(5): any wish not to be contacted stops texts, even while paused, out of
 *      budget or in shadow mode). A contact the AI doesn't manage only lands in the suppression
 *      list (Isaac decides the CRM side). START, the pending clarification, ambiguous opt-outs
 *      and HELP follow — compliance texts only for AI-managed contacts and fresh messages;
 *   2. suppression by phone; enrollment/exclusion tags; client / status / pause gates; the
 *      reply must go back to the number that wrote;
 *   3. Isaac replied by hand recently → pause (before the "anything new?" check, so a
 *      `user_replied` poke with no new inbound still pauses);
 *   4. freshness, caps, loop breaker, trivial messages; zones, license, language, windows;
 *      Medicare and media hand-offs; budget reservation;
 *   5. the model chooses ONE terminal action; code renders, checks and dispatches it (the same
 *      path after a guard retry);
 *   6. every exit after the GHL reads re-checks the thread: a message (or Isaac's reply) that
 *      arrived mid-turn — whose webhook poke was dropped as "in flight" — re-arms a turn.
 *
 * Pure apart from the injected ports (fully testable offline).
 */

import { resolveTimezone } from "@/lib/leads-the-way/timezone";
import { localCalendarDateKey } from "@/lib/timezone";

import { formatAppointmentForText, formatEta, isIsaacAvailableNow, shouldShowZone } from "./availability";
import { latestHumanOutbound, newestInbound } from "./classify";
import {
  channelWindow,
  classifyClarification,
  classifyTrivialInbound,
  detectHelp,
  detectLoop,
  detectMedicare,
  detectOptOut,
  detectStart,
  licenseDecision,
  normalizeText,
  replyWindowDecision,
  resolveLeadZones,
  toStateCode,
  usesTu,
  type OptOutTier,
} from "./compliance";
import {
  AI_BOOKED_TAG,
  AI_SETTER_TAG,
  EXCLUSION_TAGS,
  MAX_LLM_CALLS_PER_TURN,
  OUT_OF_LICENSE_STATE_TAG,
  PRICE_MICROS,
  RESERVE_INPUT_TOKENS_PER_CALL,
  RESERVE_OUTPUT_TOKENS_PER_CALL,
} from "./config";
import { buildUserContent, refreshOfferLabels, renderThread, type TurnFacts } from "./context";
import { guardFreeText } from "./guard";
import { composeText, dispatchOutbound, needsDisclosure, type DispatchContext, type DispatchResult } from "./outbound";
import { BOOKING_PATHS, PRODUCT_LABELS, calendarIdFor, languageFromTags, productFromSignals, topicPhrase } from "./product";
import { buildSystemPrompt } from "./prompts";
import { clip, detectMessageLanguage, sanitizeForRecord, toE164Nanp } from "./text-utils";
import { renderTemplate, type TemplateId, type TemplateVars } from "./templates";
import {
  TOOL_DEFS,
  createToolExecutor,
  newToolState,
  type BookingOutcome,
  type TerminalDecision,
  type ToolContext,
  type ToolState,
} from "./tools";
import { sanitizeFirstName } from "./ui-strings";
import type {
  AiSetterPorts,
  AiSetterSettings,
  AppointmentRef,
  Channel,
  ContactSnapshot,
  DndChannel,
  HandoffReason,
  Lang,
  LeadRecord,
  LlmLoopResult,
  LlmUsage,
  OfferedSlot,
  ProductLine,
  Register,
  ThreadChannel,
  ThreadMessage,
  TurnFence,
  TurnReason,
} from "./types";

export type TurnOptions = { reason: TurnReason; retry: number };

export type TurnResult = {
  kind: "noop" | "skipped" | "acted";
  reason: string;
  messageId?: string;
  /** Set when the turn re-armed itself: publish a job for this run (with this reason). */
  rearm?: { runId: string; delaySeconds: number; retry: number; reason: TurnReason };
};

/** Carrier/GHL keywords LC Phone already answers on SMS — the app sends no second confirmation. */
const CARRIER_STOP_WORDS = new Set(["stop", "stopall", "stop all", "unsubscribe", "cancel", "end", "quit", "revoke", "optout", "opt out"]);

const ALL_DND_CHANNELS: DndChannel[] = ["SMS", "WhatsApp", "Email", "FB", "Call"];
const AGENT_TZ = "America/New_York";
const LIVE_OFFER_MAX_AGE_MS = 3 * 86_400_000;
/** A message this recent is a live conversation: compliance texts and immediate replies are OK. */
const FRESH_MS = 30 * 60_000;
const OTHER_TEXT_CHANNELS: ThreadChannel[] = ["Email", "FB", "IG", "Live_Chat"];

const EMPTY_USAGE: LlmUsage = {
  model: "",
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  costMicros: 0,
  usedFallback: false,
};

type Ctx = {
  ports: AiSetterPorts;
  opts: TurnOptions;
  fence: TurnFence;
  lead: LeadRecord;
  now: Date;
  /** The newest SMS/WhatsApp inbound when the turn read the thread (re-check baseline). */
  handled: ThreadMessage | null;
  /** Something reached GHL or the queue: a crash must not re-run this inbound. */
  dispatched: boolean;
  finished: boolean;
};

function hasTag(contact: ContactSnapshot, tag: string): boolean {
  const t = tag.toLowerCase();
  return contact.tags.some((x) => x.trim().toLowerCase() === t);
}

function siteHost(siteUrl: string): string {
  try {
    return new URL(siteUrl).host.replace(/^www\./, "");
  } catch {
    return "isaacplans.com";
  }
}

function leadLocalNow(now: Date, zone: string): string {
  return new Intl.DateTimeFormat("es-US", { timeZone: zone, hour: "numeric", minute: "2-digit" }).format(now);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** SMS/WhatsApp inbound messages the last finished turn has not handled yet (oldest first). */
function unhandledInbound(messages: ThreadMessage[], lead: LeadRecord): ThreadMessage[] {
  const after = lead.lastHandledInboundAt?.getTime() ?? 0;
  return messages.filter(
    (m) =>
      m.direction === "inbound" &&
      (m.channel === "SMS" || m.channel === "WhatsApp") &&
      m.id !== lead.lastHandledInboundId &&
      m.dateAdded.getTime() > after
  );
}

/** Inbound text on channels the AI doesn't answer (email, FB, IG, chat) — scanned for opt-outs only. */
function unhandledOtherInbound(messages: ThreadMessage[], lead: LeadRecord, now: Date): ThreadMessage[] {
  const after = Math.max(lead.lastHandledInboundAt?.getTime() ?? 0, now.getTime() - 7 * 86_400_000);
  return messages.filter(
    (m) => m.direction === "inbound" && OTHER_TEXT_CHANNELS.includes(m.channel) && m.body.trim() && m.dateAdded.getTime() > after
  );
}

function watermarkOf(m: ThreadMessage | null, firstName?: string | null): Partial<LeadRecord> {
  const name = firstName !== undefined ? { firstName } : {};
  return m ? { lastHandledInboundId: m.id, lastHandledInboundAt: m.dateAdded, lastInboundAt: m.dateAdded, ...name } : name;
}

// ─── Finishing ───────────────────────────────────────────────────────────────────────────

/** A re-arm the store did on its own: a webhook poke arrived while this turn ran (`poke_pending`). */
function rearmOf(ctx: Ctx, rearmedRunId: string | null, retry = 0): Partial<TurnResult> {
  return rearmedRunId
    ? { rearm: { runId: rearmedRunId, delaySeconds: ctx.ports.config.debounceSeconds, retry, reason: "inbound" } }
    : {};
}

async function finishPlain(
  ctx: Ctx,
  patch: Partial<LeadRecord>,
  kind: TurnResult["kind"],
  reason: string,
  extra: Partial<TurnResult> = {}
): Promise<TurnResult> {
  const r = await ctx.ports.store.finishTurn(ctx.fence, patch, { rearm: false });
  ctx.finished = true;
  return { kind, reason, ...extra, ...rearmOf(ctx, r.rearmedRunId) };
}

/**
 * Finish, re-arming when the lead wrote again (or Isaac replied by hand) while this turn ran —
 * those webhook pokes were dropped as "in flight". A failed re-read also re-arms, at most twice.
 */
async function finishChecked(
  ctx: Ctx,
  patch: Partial<LeadRecord>,
  kind: TurnResult["kind"],
  reason: string,
  extra: Partial<TurnResult> = {}
): Promise<TurnResult> {
  const { ghl, store, config } = ctx.ports;
  const fresh = await ghl.listMessages(ctx.fence.contactId, { limit: 8, sinceDays: 1 });
  let rearm = false;
  let retry = 0;
  if (!fresh.ok) {
    rearm = ctx.opts.retry < 2;
    retry = ctx.opts.retry + 1;
  } else {
    const base = ctx.handled;
    const newerInbound = fresh.value.some(
      (m) =>
        m.direction === "inbound" &&
        (m.channel === "SMS" || m.channel === "WhatsApp" || OTHER_TEXT_CHANNELS.includes(m.channel)) &&
        (!base || (m.id !== base.id && m.dateAdded.getTime() > base.dateAdded.getTime()))
    );
    const human = latestHumanOutbound(fresh.value, ctx.now, { ourGhlIds: new Set(), isaacUserId: config.isaacUserId });
    rearm = newerInbound || Boolean(human);
  }
  const r = await store.finishTurn(ctx.fence, patch, { rearm });
  ctx.finished = true;
  return { kind, reason, ...extra, ...rearmOf(ctx, r.rearmedRunId, rearm ? retry : 0) };
}

async function retryLater(ctx: Ctx, reason: string, delaySeconds: number): Promise<TurnResult> {
  if (ctx.opts.retry >= 3) {
    await finishPlain(ctx, {}, "skipped", `gave_up:${reason}`);
    await ctx.ports.notify.notify({ kind: "error", detail: `turno abandonado (${reason})` });
    return { kind: "skipped", reason: `gave_up:${reason}` };
  }
  const r = await ctx.ports.store.finishTurn(ctx.fence, {}, { rearm: true });
  ctx.finished = true;
  if (!r.rearmedRunId) return { kind: "skipped", reason: "lost_claim" };
  return {
    kind: "skipped",
    reason,
    rearm: { runId: r.rearmedRunId, delaySeconds, retry: ctx.opts.retry + 1, reason: ctx.opts.reason },
  };
}

// ─── Entry point ─────────────────────────────────────────────────────────────────────────

export async function runTurn(contactId: string, runId: string, ports: AiSetterPorts, opts: TurnOptions): Promise<TurnResult> {
  const now = ports.now();
  const claimed = await ports.store.claimTurn(contactId, runId, now);
  if (!claimed) return { kind: "noop", reason: "not_claimable" };
  const ctx: Ctx = {
    ports,
    opts,
    fence: { contactId, runId, attempt: claimed.attempt },
    lead: claimed,
    now,
    handled: null,
    dispatched: false,
    finished: false,
  };
  try {
    return await turnBody(ctx);
  } catch (err) {
    ports.log.error("Turn threw", { contactId, error: err instanceof Error ? err.name : "unknown" });
    if (ctx.finished) return { kind: "skipped", reason: "threw_after_finish" };
    if (!ctx.dispatched) return retryLater(ctx, "threw", 60);
    // Something already went out: mark this inbound handled, never answer it twice.
    await ports.store.finishTurn(ctx.fence, watermarkOf(ctx.handled), { rearm: false });
    ctx.finished = true;
    return { kind: "skipped", reason: "threw_after_dispatch" };
  }
}

// ─── Compliance (before everything else) ─────────────────────────────────────────────────

type Comp = {
  ctx: Ctx;
  settings: AiSetterSettings;
  contact: ContactSnapshot;
  e164: string | null;
  firstName: string | null;
  watermark: Partial<LeadRecord>;
  aiManaged: boolean;
  lang: Lang;
  register: Register;
};

function isFresh(ctx: Ctx, m: ThreadMessage): boolean {
  return ctx.now.getTime() - m.dateAdded.getTime() <= FRESH_MS;
}

async function sendCompliance(
  c: Comp,
  templateId: TemplateId,
  channel: Channel,
  inbound: ThreadMessage,
  extraDecision: Record<string, unknown> = {}
): Promise<DispatchResult> {
  const { ctx } = c;
  const rendered = renderTemplate(templateId, c.lang, c.register, templateVars(ctx.ports, null, c.lang, c.register, null));
  const res = await dispatchOutbound(
    ctx.ports,
    {
      contactId: ctx.fence.contactId,
      channel,
      kind: "template",
      templateId,
      text: rendered.text,
      intent: templateId,
      inReplyToInboundId: inbound.id,
      turnRunId: ctx.fence.runId,
      notBefore: null,
      decision: {
        reason: ctx.opts.reason,
        channel,
        leadStatusAtCreation: ctx.lead.status,
        contextAt: ctx.now.toISOString(),
        inReplyToAt: inbound.dateAdded.toISOString(),
        toE164: c.e164,
        ...extraDecision,
      },
      guardFlags: [],
      usage: null,
      forceApproval: false,
    },
    {
      settings: c.settings,
      firstName: c.firstName,
      product: ctx.lead.product,
      stateCode: ctx.lead.stateCode,
      leadLocalTime: leadLocalNow(ctx.now, ctx.lead.leadTimezone ?? AGENT_TZ),
      sendsAtLabel: "ahora",
    }
  );
  ctx.dispatched = true;
  return res;
}

/** Permanent DND; one retry, then Isaac is told (GHL's own workflows would keep texting). */
async function setDndOrAlert(ctx: Ctx, channels: DndChannel[]): Promise<void> {
  const { ghl } = ctx.ports;
  if (await ghl.setDnd(ctx.fence.contactId, channels)) return;
  if (await ghl.setDnd(ctx.fence.contactId, channels)) return;
  ctx.ports.log.error("Opt-out DND not applied", { contactId: ctx.fence.contactId });
  await ctx.ports.notify.notify({ kind: "error", detail: "no se pudo poner el DND de una baja; ponlo a mano en el CRM" });
}

/**
 * Record an opt-out. Always: suppression by phone (forever). AI-managed contacts also get DND on
 * every channel and, for a fresh SMS/WhatsApp message, one confirmation on that channel (sent
 * BEFORE that channel's DND, which GHL would otherwise block). A contact the AI doesn't manage
 * gets no message and no CRM write — Isaac is told and decides.
 */
async function optOut(c: Comp, m: ThreadMessage, tier: OptOutTier | "model", source: string): Promise<TurnResult> {
  const { ctx } = c;
  const { store, ghl, config } = ctx.ports;
  const contactId = ctx.fence.contactId;
  const fromModel = tier === "model";

  if (fromModel && config.dryRun) {
    // Shadow mode never acts on the model's judgment alone.
    await store.recordEvent(contactId, "would_opt_out", { source });
    return finishChecked(ctx, c.watermark, "skipped", "would_opt_out");
  }

  const alreadySuppressed = c.e164 ? await store.isSuppressed(c.e164) : false;
  if (c.e164) {
    await store.addSuppression({ e164: c.e164, scope: "all", source, rawText: sanitizeForRecord(m.body, 200), contactId });
  }
  await store.supersedePendingDrafts(contactId, "opted_out");
  const patch: Partial<LeadRecord> = {
    ...c.watermark,
    status: "opted_out",
    optOutPending: false,
    offeredSlots: [],
    pausedUntil: null,
    pauseReason: `opt_out:${source}`,
    callNowState: null,
  };

  if (!c.aiManaged) {
    await store.recordEvent(contactId, "opted_out", { source, tier, channel: m.channel, aiManaged: false });
    await ctx.ports.notify.notify({ kind: "opted_out", contactId, firstName: c.firstName, aiManaged: false });
    return finishPlain(ctx, patch, "acted", "opted_out_unmanaged");
  }

  const replyChannel: Channel | null = m.channel === "SMS" || m.channel === "WhatsApp" ? m.channel : null;
  const carrierHandles = m.channel === "SMS" && tier === "keyword" && CARRIER_STOP_WORDS.has(normalizeText(m.body));
  const canConfirm = Boolean(replyChannel) && isFresh(ctx, m) && !alreadySuppressed && !carrierHandles;

  if (canConfirm && replyChannel && !config.dryRun) {
    const replyDnd: DndChannel = replyChannel;
    await setDndOrAlert(ctx, ALL_DND_CHANNELS.filter((ch) => ch !== replyDnd));
    const sent = await sendCompliance(c, "optout_confirm", replyChannel, m, { setDndAfterSend: [replyDnd] });
    if (!sent.queued) await setDndOrAlert(ctx, [replyDnd]);
  } else {
    if (canConfirm && replyChannel) await sendCompliance(c, "optout_confirm", replyChannel, m); // shadow record
    await setDndOrAlert(ctx, ALL_DND_CHANNELS);
  }
  ctx.dispatched = true;
  await store.recordEvent(contactId, "opted_out", { source, tier, channel: m.channel, aiManaged: true });
  await ctx.ports.notify.notify({ kind: "opted_out", contactId, firstName: c.firstName, aiManaged: true });
  return finishPlain(ctx, patch, "acted", "opted_out");
}

/** Steps that run before every other gate. Returns a result when the turn ends here. */
async function complianceFirst(
  c: Comp,
  unhandled: ThreadMessage[],
  otherUnhandled: ThreadMessage[]
): Promise<TurnResult | null> {
  const { ctx } = c;
  const { store, config } = ctx.ports;
  const { lead } = ctx;
  const contactId = ctx.fence.contactId;

  // 1. Definitive opt-outs, every text channel, oldest first.
  const scanned = [...unhandled, ...otherUnhandled].sort((a, b) => a.dateAdded.getTime() - b.dateAdded.getTime());
  for (const m of scanned) {
    const o = detectOptOut(m.body);
    if (o && o.tier !== "ambiguous") return optOut(c, m, o.tier, o.tier);
  }
  const last = unhandled[unhandled.length - 1] ?? null;

  // 2. START lifts the suppression (with a record).
  if (last && detectStart(last.body)) {
    if (c.e164) await store.liftSuppression(c.e164, "start_keyword");
    await store.recordEvent(contactId, "start_keyword", { channel: last.channel });
    return finishPlain(
      ctx,
      { ...c.watermark, optOutPending: false, ...(lead.status === "opted_out" ? { status: "active" as const } : {}) },
      "acted",
      "start"
    );
  }

  // 3. A clarification is pending: yes → opt-out; a bare no → continue; anything else → stay frozen.
  if (lead.optOutPending) {
    if (!last) return finishPlain(ctx, {}, "skipped", "optout_pending");
    const answer = classifyClarification(last.body);
    if (answer === "yes") return optOut(c, last, "phrase", "clarified");
    if (answer === "other") {
      await ctx.ports.notify.notify({ kind: "optout_ambiguous", contactId, firstName: c.firstName });
      return finishPlain(ctx, c.watermark, "skipped", "optout_pending");
    }
  }

  // 4. Ambiguous opt-out → freeze; clarify once, only for an AI-managed lead and a fresh message.
  const ambiguous = unhandled.find((m) => detectOptOut(m.body)?.tier === "ambiguous");
  if (ambiguous && !lead.optOutPending) {
    await store.supersedePendingDrafts(contactId, "optout_ambiguous");
    const pauseOver = lead.status === "paused" && lead.pausedUntil !== null && lead.pausedUntil.getTime() <= ctx.now.getTime();
    const managedNow =
      c.aiManaged && !c.settings.paused && (lead.status === "active" || lead.status === "booked" || pauseOver);
    const suppressed = c.e164 ? await store.isSuppressed(c.e164) : false;
    if (managedNow && !suppressed && isFresh(ctx, ambiguous)) {
      await sendCompliance(c, "optout_clarify", ambiguous.channel === "WhatsApp" ? "WhatsApp" : "SMS", ambiguous);
    }
    await ctx.ports.notify.notify({ kind: "optout_ambiguous", contactId, firstName: c.firstName });
    return finishPlain(ctx, { ...c.watermark, optOutPending: true, callNowState: null }, "acted", "optout_clarify");
  }

  // 5. HELP: fixed reply, AI-managed contacts and fresh messages only.
  if (last && detectHelp(last.body)) {
    if (config.replyToHelp && c.aiManaged && isFresh(ctx, last)) {
      await sendCompliance(c, "help", last.channel === "WhatsApp" ? "WhatsApp" : "SMS", last);
      return finishPlain(ctx, c.watermark, "acted", "help");
    }
    return finishPlain(ctx, c.watermark, "skipped", config.replyToHelp ? "help_not_managed" : "help_answered_by_carrier");
  }
  return null;
}

// ─── The turn ────────────────────────────────────────────────────────────────────────────

async function turnBody(ctx: Ctx): Promise<TurnResult> {
  const { store, ghl, log, config } = ctx.ports;
  const { now, lead, opts, fence } = ctx;
  const contactId = fence.contactId;
  const runId = fence.runId;

  // ── Settings (fail closed: retry later, never drop) ─────────────────────────────────
  const settings = await ctx.ports.settings.read();
  if (settings.failedClosed) {
    if (opts.retry === 0) await ctx.ports.notify.notify({ kind: "error", detail: "no se pudieron leer los ajustes; se reintenta" });
    return retryLater(ctx, "settings_unavailable", 120);
  }

  // ── Read GHL ─────────────────────────────────────────────────────────────────────────
  const contactRes = await ghl.getContact(contactId);
  if (!contactRes.ok) {
    if (contactRes.retryable) return retryLater(ctx, `contact_${contactRes.status}`, 60);
    return finishPlain(ctx, {}, "skipped", `contact_${contactRes.error}`);
  }
  const contact = contactRes.value;
  if (config.locationId && contact.locationId && contact.locationId !== config.locationId) {
    return finishPlain(ctx, {}, "skipped", "wrong_location");
  }
  const messagesRes = await ghl.listMessages(contactId, { limit: 40, sinceDays: 30 });
  if (!messagesRes.ok) {
    if (messagesRes.retryable) return retryLater(ctx, `messages_${messagesRes.status}`, 60);
    return finishPlain(ctx, {}, "skipped", `messages_${messagesRes.status}`);
  }
  const messages = messagesRes.value;
  const ourIds = await store.knownGhlMessageIds(contactId);
  const cls = { ourGhlIds: ourIds, isaacUserId: config.isaacUserId };

  const e164 = toE164Nanp(contact.phone);
  const firstName = sanitizeFirstName(contact.firstName) ?? lead.firstName;
  const newestIn = newestInbound(messages, ["SMS", "WhatsApp"]);
  ctx.handled = newestIn;
  const unhandled = unhandledInbound(messages, lead);
  const otherUnhandled = unhandledOtherInbound(messages, lead, now);
  const watermark = watermarkOf(newestIn, firstName);
  const aiManaged = hasTag(contact, AI_SETTER_TAG) && !EXCLUSION_TAGS.some((t) => hasTag(contact, t));
  const unhandledText = unhandled.map((m) => m.body).join("\n");
  const quickLang: Lang = detectMessageLanguage(unhandledText) ?? lead.language ?? languageFromTags(contact.tags);
  const comp: Comp = {
    ctx,
    settings,
    contact,
    e164,
    firstName,
    watermark,
    aiManaged,
    lang: quickLang,
    register: lead.register ?? "usted",
  };

  // ── 1. Compliance first ──────────────────────────────────────────────────────────────
  const early = await complianceFirst(comp, unhandled, otherUnhandled);
  if (early) return early;

  // ── 2. Suppression and eligibility ───────────────────────────────────────────────────
  if (!e164) return finishPlain(ctx, watermark, "skipped", "no_valid_phone");
  if (await store.isSuppressed(e164)) return finishPlain(ctx, watermark, "skipped", "suppressed");
  if (settings.paused) return finishPlain(ctx, {}, "skipped", "paused_all");
  if (!aiManaged) return finishPlain(ctx, watermark, "skipped", hasTag(contact, AI_SETTER_TAG) ? "excluded_tag" : "not_enrolled");
  if (lead.status === "opted_out" || lead.status === "stopped") return finishPlain(ctx, watermark, "skipped", `status_${lead.status}`);
  if (lead.status === "handoff") return finishPlain(ctx, watermark, "skipped", "with_isaac");
  let resumed = false;
  if (lead.status === "paused") {
    if (lead.pausedUntil && lead.pausedUntil.getTime() <= now.getTime()) resumed = true;
    else return finishPlain(ctx, watermark, "skipped", "paused");
  }
  if (await ctx.ports.calls.isClient(contactId)) {
    await ctx.ports.notify.notify({
      kind: "handoff",
      contactId,
      firstName,
      product: lead.product,
      state: lead.stateCode,
      reason: "existing_client",
      urgent: false,
    });
    return finishPlain(ctx, { ...watermark, status: "handoff", pauseReason: "existing_client" }, "skipped", "existing_client");
  }
  // A reply goes back only to the number that wrote (a changed contact phone must not get it).
  if (newestIn?.fromNumber && newestIn.fromNumber !== e164) {
    await store.recordEvent(contactId, "phone_mismatch", {});
    await ctx.ports.notify.notify({ kind: "error", detail: "llegó un mensaje desde otro número que el del contacto; la IA no respondió" });
    return finishPlain(ctx, watermark, "skipped", "phone_mismatch");
  }

  // ── 3. Isaac replied by hand recently → pause ────────────────────────────────────────
  const humanSince = new Date(Math.max(lead.lastAiOutboundAt?.getTime() ?? 0, now.getTime() - config.humanPauseHours * 3_600_000));
  const human = latestHumanOutbound(messages, humanSince, cls);
  if (human) {
    await store.supersedePendingDrafts(contactId, "isaac_replied");
    await store.recordEvent(contactId, "human_took_over", { messageType: human.messageType, source: human.source });
    return finishPlain(
      ctx,
      {
        ...watermark,
        status: "paused",
        pausedUntil: new Date(human.dateAdded.getTime() + config.humanPauseHours * 3_600_000),
        pauseReason: "isaac_replied",
        disclosedChannels: {},
        callNowState: null,
      },
      "skipped",
      "human_took_over"
    );
  }

  // ── 4. Anything to do? ───────────────────────────────────────────────────────────────
  const callNowOutcome = lead.callNowState === "timeout" || lead.callNowState === "declined" ? lead.callNowState : null;
  if (opts.reason !== "inbound" && !callNowOutcome) return finishPlain(ctx, {}, "noop", "call_now_done");
  if (unhandled.length === 0 && !callNowOutcome) return finishPlain(ctx, {}, "noop", "nothing_new");
  if (!newestIn) return finishPlain(ctx, {}, "skipped", "no_thread");
  const inbound = newestIn;

  if (unhandled.length > 0 && now.getTime() - inbound.dateAdded.getTime() > config.inboundMaxAgeHours * 3_600_000) {
    await store.createMessage({
      contactId,
      channel: inbound.channel === "WhatsApp" ? "WhatsApp" : "SMS",
      kind: "free_text",
      status: "stale",
      intent: "stale_inbound",
      inReplyToInboundId: inbound.id,
      turnRunId: runId,
      decision: { reason: "stale_inbound" },
    });
    return finishPlain(ctx, watermark, "skipped", "stale_inbound");
  }

  const day = localCalendarDateKey(now, AGENT_TZ);
  const turnsToday = lead.turnsDay === day ? lead.turnsToday : 0;
  if (turnsToday >= config.maxTurnsPerContactPerDay) return finishPlain(ctx, watermark, "skipped", "contact_daily_cap");
  if (detectLoop(messages, ourIds, now)) {
    await ctx.ports.notify.notify({ kind: "loop_paused", contactId, firstName });
    return finishPlain(
      ctx,
      { ...watermark, status: "paused", pausedUntil: new Date(now.getTime() + 24 * 3_600_000), pauseReason: "loop" },
      "skipped",
      "loop"
    );
  }
  if ((await store.countTurnsSince(new Date(now.getTime() - 3_600_000))) >= config.maxTurnsPerHour) {
    return retryLater(ctx, "hourly_cap", 600);
  }

  // Skip only when EVERY new message is trivial (a burst "¿cuánto cuesta?" + "ok" still gets an answer).
  const trivials = unhandled.map((m) => classifyTrivialInbound(m.body, m.attachmentKinds));
  const offersLive = lead.offeredSlots.length > 0 && lead.offeredAt !== null && now.getTime() - lead.offeredAt.getTime() < LIVE_OFFER_MAX_AGE_MS;
  if (unhandled.length > 0 && !callNowOutcome) {
    const skippable = trivials.every(
      (k) =>
        k === "auto_reply" || k === "empty" || k === "reaction" || k === "emoji_only" || (k === "ack" && (lead.status === "booked" || !offersLive))
    );
    if (skippable) return finishChecked(ctx, watermark, "skipped", "trivial_ack");
  }

  // ── 5. Channel, zones, license, language, windows ────────────────────────────────────
  const replyChannel: Channel = inbound.channel === "WhatsApp" ? "WhatsApp" : "SMS";
  const dndStatus = contact.dndChannels[replyChannel];
  if (contact.dnd || dndStatus === "active" || dndStatus === "permanent") return finishPlain(ctx, watermark, "skipped", "dnd");
  const waWindow = channelWindow(messages, "WhatsApp", now);
  if (replyChannel === "WhatsApp" && !waWindow.open) return finishPlain(ctx, watermark, "skipped", "whatsapp_window_closed");

  const addressState = toStateCode(contact.state);
  const zonesBase = resolveLeadZones(
    { ghlTimezone: contact.timezone, state: contact.state, postalCode: contact.postalCode, phone: contact.phone },
    resolveTimezone
  );
  // A state the lead reported (or an older address) is an extra candidate; the stricter rules win.
  const otherState = lead.stateCode && lead.stateCode !== addressState ? lead.stateCode : null;
  const otherZone = otherState ? resolveTimezone(otherState, null) : null;
  const zoneList = unique([...zonesBase.zones, ...(otherZone ? [otherZone] : [])]);
  const stateCodes = unique([...zonesBase.stateCodes, ...(otherState ? [otherState] : [])]);
  // The license follows where the lead LIVES (address or what they told us), never the area code.
  const licenseState = addressState ?? lead.stateCode ?? null;
  const licensed = await ctx.ports.license.licensedStateCodes();
  const license = licenseDecision(licenseState, licensed);
  const useReported = !addressState && !contact.timezone && otherZone;
  const leadZone = useReported ? (otherZone as string) : (zonesBase.primaryZone ?? AGENT_TZ);
  const zoneSource: TurnFacts["zoneSource"] = useReported ? "reported" : zonesBase.source;
  const showZone = shouldShowZone(leadZone, zoneSource === "reported" ? "address" : zoneSource);

  const lastCall = await ctx.ports.calls.latestCall(contactId);
  const product: ProductLine = lead.product ?? productFromSignals(contact.tags, lastCall?.lineOfBusiness ?? null);
  const lang: Lang = detectMessageLanguage(unhandledText) ?? lead.language ?? lastCall?.language ?? languageFromTags(contact.tags);
  const register: Register = lead.register === "tu" || (lang === "es" && usesTu(unhandledText)) ? "tu" : "usted";
  const window = replyWindowDecision({ now, lastInboundAt: inbound.dateAdded, zones: zoneList, stateCodes });
  const notBefore = window.allowedNow ? null : window.nextAllowedAt;
  if (!window.allowedNow && !notBefore) return finishPlain(ctx, watermark, "skipped", "no_send_window");
  /** When the reply will actually go out: times and ETAs are worded for that moment. */
  const referenceNow = notBefore ?? now;

  const dispatchCtx: DispatchContext = {
    settings,
    firstName,
    product,
    stateCode: licenseState,
    leadLocalTime: leadLocalNow(now, leadZone),
    sendsAtLabel: notBefore ? leadLocalNow(notBefore, leadZone) : "ahora",
  };
  const contextPatch: Partial<LeadRecord> = {
    ...watermark,
    language: lang,
    register,
    product,
    leadTimezone: leadZone,
    stateCode: licenseState,
    turnsDay: day,
    turnsToday: turnsToday + 1,
    threadTurns: lead.threadTurns + 1,
    optOutPending: false,
    ...(offersLive ? {} : { rejectionsCount: 0 }),
    ...(resumed ? { status: "active" as const, pausedUntil: null, pauseReason: null, disclosedChannels: {} } : {}),
  };
  const leadForText: LeadRecord = resumed ? { ...lead, disclosedChannels: {} } : lead;
  const baseDecision = {
    reason: opts.reason,
    channel: replyChannel,
    consentBasis: "consumer_initiated",
    zones: zoneList,
    stateCodes,
    zoneSource,
    license,
    replyWindow: { allowedNow: window.allowedNow, reason: window.reason, nextAllowedAt: window.nextAllowedAt?.toISOString() ?? null },
    whatsappWindowOpen: waWindow.open,
    dnd: dndStatus ?? "inactive",
    mode: config.dryRun ? "shadow" : "approval",
    contextAt: now.toISOString(),
    inReplyToAt: inbound.dateAdded.toISOString(),
    referenceAt: referenceNow.toISOString(),
    leadZone,
    toE164: e164,
  };

  /** Render + dispatch a template reply (code-driven or model-chosen). Null = missing vars. */
  const sendTemplate = async (
    templateId: TemplateId,
    vars: TemplateVars,
    extra: { offered?: OfferedSlot[]; usage?: LlmUsage | null; forceApproval?: boolean; statusAfter?: LeadRecord["status"]; clearOffers?: boolean } = {}
  ) => {
    const rendered = renderTemplate(templateId, lang, register, vars);
    if (rendered.missing.length > 0) {
      log.warn("Template missing vars", { contactId, templateId, missing: rendered.missing });
      return null;
    }
    const includeDisclosure = needsDisclosure(leadForText, replyChannel, now);
    const includeStop = includeDisclosure && config.appendStopFooter;
    const text = composeText(rendered.text, { lang, register, firstName, brand: config.brandName, includeDisclosure, includeStop });
    const res = await dispatchOutbound(
      ctx.ports,
      {
        contactId,
        channel: replyChannel,
        kind: "template",
        templateId,
        text,
        intent: templateId,
        inReplyToInboundId: inbound.id,
        turnRunId: runId,
        notBefore,
        decision: {
          ...baseDecision,
          includesDisclosure: includeDisclosure,
          includesStop: includeStop,
          offeredSlots: extra.offered ?? null,
          clearOffers: extra.clearOffers ?? false,
          leadStatusAtCreation: extra.statusAfter ?? lead.status,
        },
        guardFlags: [],
        usage: extra.usage ?? null,
        forceApproval: extra.forceApproval ?? false,
      },
      dispatchCtx
    );
    ctx.dispatched = true;
    return res.message;
  };

  const eta = () => formatEta({ now: referenceNow, schedule: settings.schedule, lang, leadZone });
  const vars = templateVars(ctx.ports, product, lang, register, null, leadZone, referenceNow);

  /**
   * Hand the lead to Isaac with a hold message ("Isaac le responde personalmente …"). `silent`
   * (a model refusal): nothing goes to the lead — a refusal can mean abuse or an injected
   * instruction, and Isaac decides what to answer.
   */
  const handoff = async (
    reason: HandoffReason,
    urgent: boolean,
    note: string,
    usage: LlmUsage | null,
    patch: Partial<LeadRecord> = contextPatch,
    opts: { silent?: boolean } = {}
  ): Promise<TurnResult> => {
    const templateId: TemplateId = reason === "media" ? "media_received" : "handoff_hold";
    const msg = opts.silent
      ? null
      : await sendTemplate(templateId, { ...vars, eta: eta() }, { usage, statusAfter: "handoff", forceApproval: Boolean(usage?.usedFallback) });
    if (!config.dryRun) {
      await ghl.addNote(
        contactId,
        `🙋 El asistente de IA pasó este contacto a Isaac (${reason}).${note ? ` ${sanitizeForRecord(note, 300)}` : ""}`
      );
    }
    await ctx.ports.notify.notify({ kind: "handoff", contactId, firstName, product, state: licenseState, reason, urgent });
    await store.recordEvent(contactId, "handoff", { reason, urgent });
    return finishChecked(ctx, { ...patch, status: "handoff", pauseReason: reason, callNowState: null }, "acted", `handoff_${reason}`, {
      messageId: msg?.id,
    });
  };

  // Hand-offs decided by code: media only, Medicare, a thread that ran too long.
  if (unhandled.length > 0 && trivials.every((k) => k === "media_only" || k === "empty")) return handoff("media", false, "", null);
  if (detectMedicare(unhandledText)) return handoff("medicare", false, "Mencionó Medicare.", null);
  if (lead.threadTurns >= config.maxTurnsPerThread) return handoff("confused", false, "Conversación muy larga.", null);

  // ── 6. Appointments, Isaac's availability ────────────────────────────────────────────
  const apptsRes = await ghl.listContactAppointments(contactId);
  if (!apptsRes.ok && apptsRes.retryable) return retryLater(ctx, `appointments_${apptsRes.status}`, 60);
  const appointmentsKnown = apptsRes.ok;
  let upcoming: AppointmentRef | null = apptsRes.ok
    ? (apptsRes.value
        .filter((a) => a.startTime.getTime() > now.getTime() && a.status !== "cancelled" && a.status !== "invalid")
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0] ?? null)
    : null;
  if (!appointmentsKnown && lead.appointmentId && lead.appointmentAt && lead.appointmentAt.getTime() > now.getTime()) {
    upcoming = {
      id: lead.appointmentId,
      calendarId: lead.calendarId ?? calendarIdFor(product, lang),
      contactId,
      startTime: lead.appointmentAt,
      endTime: null,
      status: "confirmed",
      title: null,
    };
  }
  let isaacEvents: AppointmentRef[] | null | undefined;
  const loadIsaacEvents = async (): Promise<AppointmentRef[] | null> => {
    if (isaacEvents !== undefined) return isaacEvents;
    if (!config.isaacUserId) return (isaacEvents = null);
    const res = await ghl.listUserEvents({ userId: config.isaacUserId, startMs: now.getTime() - 3_600_000, endMs: now.getTime() + 9 * 86_400_000 });
    isaacEvents = res.ok ? res.value : null;
    return isaacEvents;
  };
  const events = await loadIsaacEvents();
  const isaacFreeNow =
    events !== null && isIsaacAvailableNow({ now, schedule: settings.schedule, busyUntil: settings.busyUntil, events });
  const callNowUsedToday = Boolean(lead.callNowRequestedAt && localCalendarDateKey(lead.callNowRequestedAt, AGENT_TZ) === day);

  // ── 7. Budget (atomic reserve of a realistic worst case; settled with the real cost) ──
  const reserveMicros = Math.ceil(
    MAX_LLM_CALLS_PER_TURN *
      (RESERVE_INPUT_TOKENS_PER_CALL * PRICE_MICROS.fallbackInput +
        Math.min(config.maxTokens, RESERVE_OUTPUT_TOKENS_PER_CALL) * PRICE_MICROS.fallbackOutput)
  );
  if (!(await store.reserveBudget(day, reserveMicros, Math.round(config.dailyBudgetUsd * 1_000_000)))) {
    await ctx.ports.notify.notify({ kind: "budget", percent: 100 });
    return handoff("other", false, "Presupuesto diario de la IA agotado.", null);
  }
  await store.recordEvent(contactId, "turn", { reason: opts.reason, runId });

  let usage: LlmUsage = EMPTY_USAGE;
  try {
    // ── 8. The model ───────────────────────────────────────────────────────────────────
    const liveOffers = offersLive ? refreshOfferLabels(lead.offeredSlots, { lang, leadZone, now: referenceNow, showZone }) : [];
    const facts: TurnFacts = {
      now,
      channel: replyChannel,
      lang,
      register,
      firstName,
      product,
      topic: topicPhrase(product, lang, register),
      leadZone,
      zoneSource,
      stateCode: licenseState,
      license,
      isaacFreeNow,
      nextIsaacWindow: isaacFreeNow ? null : formatEta({ now, schedule: settings.schedule, lang: "en", leadZone }),
      upcomingAppointment: upcoming
        ? { id: upcoming.id, label: formatAppointmentForText(upcoming.startTime.toISOString(), { lang: "en", register, leadZone, now }) }
        : null,
      liveOffers,
      rejections: offersLive ? lead.rejectionsCount : 0,
      lastCall,
      whatsappWindowOpen: waWindow.open,
      callNowOutcome,
      callNowActive: lead.callNowState === "waiting" || lead.callNowState === "calling" ? lead.callNowState : null,
      callNowUsedToday,
    };
    const toolState: ToolState = newToolState();
    const toolCtx: ToolContext = {
      ports: ctx.ports,
      fence,
      lead,
      contact,
      facts,
      schedule: settings.schedule,
      calendarId: calendarIdFor(product, lang),
      licensed,
      upcoming,
      appointmentsKnown,
      referenceNow,
      loadIsaacEvents,
      dryRun: config.dryRun,
    };
    const executeTool = createToolExecutor(toolCtx, toolState);
    const session = ctx.ports.llm.startSession({
      system: buildSystemPrompt(config),
      tools: TOOL_DEFS,
      userContent: buildUserContent(facts, renderThread(messages, { ourGhlIds: ourIds, isaacUserId: config.isaacUserId, leadZone, now })),
      executeTool,
      maxCalls: MAX_LLM_CALLS_PER_TURN,
      deadlineAt: ctx.ports.deadlineAt,
    });
    let res: LlmLoopResult = await session.run();
    if (res.kind === "no_action" && res.calls < MAX_LLM_CALLS_PER_TURN) {
      // Forced tool use isn't available on Opus 5.5: nudge once.
      res = await session.retryWith("End this turn with exactly one terminal tool call (for example reply_with_template).");
    }
    usage = res.usage;

    // Booking effects (the booking itself already happened inside the tools) — applied once,
    // and again only if a retry round booked something new.
    let appliedBooking: BookingOutcome | null = null;
    let bookingPatch: Partial<LeadRecord> = {};
    const ensureBookingEffects = async () => {
      if (toolState.booking && toolState.booking !== appliedBooking) {
        appliedBooking = toolState.booking;
        bookingPatch = await applyBookingEffects(ctx.ports, toolState.booking, { contactId, product, firstName });
        if (!toolState.booking.simulated) ctx.dispatched = true;
      }
      return bookingPatch;
    };
    const patchNow = (extra: Partial<LeadRecord> = {}): Partial<LeadRecord> => ({
      ...contextPatch,
      ...(toolState.reportedState ? { stateCode: toolState.reportedState, leadTimezone: toolCtx.facts.leadZone } : {}),
      ...bookingPatch,
      ...(bookingPatch.appointmentId
        ? { rejectionsCount: 0 }
        : toolState.rejectedPrevious
          ? { rejectionsCount: lead.rejectionsCount + 1 }
          : {}),
      ...extra,
    });

    const draftDisclosure = needsDisclosure(leadForText, replyChannel, now);
    const guardCtx = () => ({
      channel: replyChannel,
      lang,
      register,
      firstName,
      agentNames: [config.agentFirstName, config.agentFullName],
      brand: config.brandName,
      agentPhone: config.agentPhoneDisplay,
      site: siteHost(config.siteUrl),
      allowedLinks: allowedLinks(ctx.ports, product, lang),
      offeredSlotLabels: [...toolState.offeredThisTurn, ...liveOffers].map((s) => s.label),
      threadText: unhandled.map((m) => m.body).join("\n"),
      // The guard sees the model's words only; the AI notice + STOP the code adds cost ~1 segment.
      maxSmsSegments: draftDisclosure ? 2 : 3,
    });

    /** One path for the first answer AND the answer after a guard retry. */
    const applyDecision = async (decision: TerminalDecision, allowRetry: boolean): Promise<TurnResult> => {
      await ensureBookingEffects();
      const forceApproval = usage.usedFallback;
      const booking = toolState.booking;
      const realBooking = booking && !booking.simulated ? booking : null;
      const dvars: TemplateVars = { ...vars };
      if (booking?.whenIso) {
        dvars.when = formatAppointmentForText(booking.whenIso, { lang, register, leadZone, now: referenceNow });
      } else if (upcoming) {
        dvars.when = formatAppointmentForText(upcoming.startTime.toISOString(), { lang, register, leadZone, now: referenceNow });
      }

      switch (decision.kind) {
        case "template": {
          const offered = decision.slotIds
            .map((id) => toolState.offeredThisTurn.find((s) => s.id === id))
            .filter((s): s is OfferedSlot => Boolean(s));
          if (offered[0]) dvars.slotA = offered[0].label;
          if (offered[1]) dvars.slotB = offered[1].label;
          const statusAfter: LeadRecord["status"] | undefined =
            decision.templateId === "out_of_license"
              ? "stopped"
              : realBooking?.action === "booked" || realBooking?.action === "rescheduled"
                ? "booked"
                : realBooking?.action === "canceled"
                  ? "active"
                  : undefined;
          const msg = await sendTemplate(decision.templateId, dvars, {
            offered: offered.length > 0 ? offered : undefined,
            usage,
            forceApproval,
            statusAfter: statusAfter ?? (bookingPatch.status as LeadRecord["status"] | undefined),
            clearOffers: Boolean(booking),
          });
          if (!msg) return handoff("other", false, "", usage, patchNow());
          if (decision.templateId === "out_of_license" && !config.dryRun) await ghl.addTags(contactId, [OUT_OF_LICENSE_STATE_TAG]);
          const extra: Partial<LeadRecord> = {
            callNowState: null,
            ...(statusAfter ? { status: statusAfter } : {}),
            ...(decision.templateId === "self_booking_link" ? { rejectionsCount: 0 } : {}),
          };
          return finishChecked(ctx, patchNow(extra), "acted", `template_${decision.templateId}`, { messageId: msg.id });
        }

        case "draft": {
          const check = guardFreeText(decision.text, guardCtx());
          if (!check.ok) {
            if (allowRetry) {
              const retried = await session.retryWith(
                `Your draft failed these checks: ${check.violations.join("; ")}. Fix them or use a template. End with one terminal tool.`
              );
              usage = retried.usage;
              if (retried.kind === "terminal" && toolState.terminal && toolState.terminal !== decision) {
                return applyDecision(toolState.terminal, false);
              }
            }
            await store.createMessage({
              contactId,
              channel: replyChannel,
              kind: "free_text",
              status: "blocked",
              body: decision.text,
              intent: decision.intent,
              inReplyToInboundId: inbound.id,
              turnRunId: runId,
              guardFlags: unique(check.violations),
              decision: { ...baseDecision, blockedBy: "guard" },
              model: usage.model,
              costMicros: usage.costMicros,
            });
            return handoff("guard_failed", false, "", usage, patchNow());
          }
          const includeDisclosure = draftDisclosure;
          const includeStop = includeDisclosure && config.appendStopFooter;
          const finalText = composeText(decision.text, { lang, register, firstName, brand: config.brandName, includeDisclosure, includeStop });
          const offeredInText = toolState.offeredThisTurn.filter((s) => finalText.includes(s.label));
          const res2 = await dispatchOutbound(
            ctx.ports,
            {
              contactId,
              channel: replyChannel,
              kind: "free_text",
              templateId: null,
              text: finalText,
              intent: decision.intent,
              inReplyToInboundId: inbound.id,
              turnRunId: runId,
              notBefore,
              decision: {
                ...baseDecision,
                includesDisclosure: includeDisclosure,
                includesStop: includeStop,
                offeredSlots: offeredInText.length > 0 ? offeredInText : null,
                clearOffers: Boolean(booking),
                leadStatusAtCreation: (bookingPatch.status as LeadRecord["status"] | undefined) ?? lead.status,
              },
              guardFlags: unique(check.warnings),
              usage,
              forceApproval: true,
            },
            dispatchCtx
          );
          ctx.dispatched = true;
          return finishChecked(ctx, patchNow({ callNowState: null }), "acted", "draft", { messageId: res2.message.id });
        }

        case "call_now":
          return callNow(ctx, {
            inbound,
            patch: patchNow(),
            isaacFreeNow: isaacFreeNow && !callNowUsedToday && !lead.callNowState,
            sendTemplate,
            executeTool,
            toolState,
            vars: dvars,
            usage,
            forceApproval,
            firstName,
            product,
            stateCode: licenseState,
            leadLocalTime: dispatchCtx.leadLocalTime,
          });

        case "handoff":
          return handoff(decision.reason, decision.urgent, decision.note, usage, patchNow());

        case "not_interested": {
          const msg = await sendTemplate("not_interested_close", dvars, { usage, forceApproval, statusAfter: "stopped" });
          await store.recordEvent(contactId, "not_interested", {});
          return finishChecked(ctx, patchNow({ status: "stopped", offeredSlots: [], callNowState: null }), "acted", "not_interested", {
            messageId: msg?.id,
          });
        }

        case "opt_out":
          return optOut({ ...comp, lang, register }, inbound, "model", "model");

        case "end":
          return finishChecked(ctx, patchNow(), "acted", "end_without_reply");
      }
    };

    if (res.kind === "terminal" && toolState.terminal) return await applyDecision(toolState.terminal, true);

    // No terminal action. A booking that already happened still gets its confirmation.
    await ensureBookingEffects();
    const done = toolState.booking && !toolState.booking.simulated ? toolState.booking : null;
    if (done) {
      const templateId: TemplateId =
        done.action === "booked" ? "confirm_booking" : done.action === "rescheduled" ? "confirm_reschedule" : "confirm_cancel";
      return await applyDecision({ kind: "template", templateId, slotIds: [] }, false);
    }
    const errCode = res.kind === "error" ? (/^(429|5\d\d|network):/.exec(res.detail)?.[1] ?? null) : null;
    if (errCode && opts.retry < 2) return await retryLater(ctx, `llm_${errCode}`, 120);
    log.warn("Model ended without an action; handing off", { contactId, result: res.kind });
    return await handoff("model_refused", false, "", usage, patchNow(), { silent: res.kind === "refused" });
  } finally {
    await store.settleBudget(day, reserveMicros, usage.costMicros);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────────────

export function allowedLinks(ports: AiSetterPorts, product: ProductLine | null, lang: Lang): string[] {
  const host = siteHost(ports.config.siteUrl);
  const path = BOOKING_PATHS[product ?? "general"][lang];
  return [`${host}${path}`, `https://${host}${path}`, `${ports.config.siteUrl}${path}`, `${host}/isaac-orraiz.vcf`];
}

export function templateVars(
  ports: AiSetterPorts,
  product: ProductLine | null,
  lang: Lang,
  register: Register,
  upcoming: AppointmentRef | null,
  leadZone?: string,
  now?: Date
): TemplateVars {
  const { config } = ports;
  const host = siteHost(config.siteUrl);
  const vars: TemplateVars = {
    agentPhone: config.agentPhoneDisplay,
    agentFullName: config.agentFullName,
    brand: config.brandName,
    site: host,
    vcardUrl: `${host}/isaac-orraiz.vcf`,
    topic: topicPhrase(product, lang, register),
    link: `${host}${BOOKING_PATHS[product ?? "general"][lang]}`,
  };
  if (upcoming && leadZone && now) {
    vars.when = formatAppointmentForText(upcoming.startTime.toISOString(), { lang, register, leadZone, now });
  }
  return vars;
}

async function applyBookingEffects(
  ports: AiSetterPorts,
  b: BookingOutcome,
  ctx: { contactId: string; product: ProductLine; firstName: string | null }
): Promise<Partial<LeadRecord>> {
  const { ghl, store, notify } = ports;
  if (b.simulated) {
    await store.recordEvent(ctx.contactId, `would_${b.action}`, { whenIso: b.whenIso });
    return {};
  }
  const whenEt = b.whenIso
    ? new Intl.DateTimeFormat("es-US", {
        timeZone: AGENT_TZ,
        weekday: "long",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(b.whenIso))
    : "";
  const label = PRODUCT_LABELS[ctx.product].es;
  if (b.action === "booked" && b.whenIso) {
    await ghl.addTags(ctx.contactId, [AI_BOOKED_TAG]);
    await ghl.addNote(ctx.contactId, `📅 Cita agendada por el asistente de IA: ${whenEt} (hora del Este). Producto: ${label}.`);
    await notify.notify({ kind: "booked", contactId: ctx.contactId, firstName: ctx.firstName, product: ctx.product, whenLabel: `${whenEt} ET` });
    await store.recordEvent(ctx.contactId, "booked", { appointmentId: b.appointment?.id ?? null });
    return {
      status: "booked",
      appointmentId: b.appointment?.id ?? null,
      appointmentAt: new Date(b.whenIso),
      calendarId: b.calendarId,
      bookingIntent: null,
      offeredSlots: [],
    };
  }
  if (b.action === "rescheduled" && b.whenIso) {
    await ghl.addNote(ctx.contactId, `🔁 La IA cambió la cita para ${whenEt} (hora del Este).`);
    await notify.notify({ kind: "booked", contactId: ctx.contactId, firstName: ctx.firstName, product: ctx.product, whenLabel: `${whenEt} ET (cambio)` });
    await store.recordEvent(ctx.contactId, "rescheduled", { appointmentId: b.appointment?.id ?? null });
    return { status: "booked", appointmentId: b.appointment?.id ?? null, appointmentAt: new Date(b.whenIso), offeredSlots: [], bookingIntent: null };
  }
  await ghl.addNote(ctx.contactId, "❌ La IA canceló la cita a pedido del cliente.");
  await store.recordEvent(ctx.contactId, "canceled", { appointmentId: b.appointment?.id ?? null });
  return { status: "active", appointmentId: null, appointmentAt: null, offeredSlots: [], bookingIntent: null };
}

async function callNow(
  ctx: Ctx,
  c: {
    inbound: ThreadMessage;
    patch: Partial<LeadRecord>;
    isaacFreeNow: boolean;
    sendTemplate: (
      id: TemplateId,
      vars: TemplateVars,
      extra?: { offered?: OfferedSlot[]; usage?: LlmUsage | null; forceApproval?: boolean; statusAfter?: LeadRecord["status"] }
    ) => Promise<{ id: string } | null>;
    executeTool: (name: string, input: unknown) => Promise<unknown>;
    toolState: ToolState;
    vars: TemplateVars;
    usage: LlmUsage;
    forceApproval: boolean;
    firstName: string | null;
    product: ProductLine;
    stateCode: string | null;
    leadLocalTime: string;
  }
): Promise<TurnResult> {
  const { config, now } = ctx.ports;
  if (c.isaacFreeNow) {
    const requestedAt = now();
    const msg = await c.sendTemplate("call_now_checking", c.vars, { usage: c.usage, forceApproval: c.forceApproval });
    await ctx.ports.notify.notify({
      kind: "call_now",
      contactId: ctx.fence.contactId,
      firstName: c.firstName,
      product: c.product,
      state: c.stateCode,
      leadLocalTime: c.leadLocalTime,
    });
    await ctx.ports.queue.publishCallNowTimeout(ctx.fence.contactId, requestedAt.toISOString(), config.callNowTimeoutSeconds);
    await ctx.ports.store.recordEvent(ctx.fence.contactId, "call_now_requested", {});
    return finishChecked(ctx, { ...c.patch, callNowState: "waiting", callNowRequestedAt: requestedAt }, "acted", "call_now_waiting", {
      messageId: msg?.id,
    });
  }
  // Isaac isn't free: offer two times right away (code picks them, no extra model call).
  if (c.toolState.offeredThisTurn.length === 0) {
    await c.executeTool("find_open_slots", {
      after_local: null,
      before_local: null,
      part_of_day: null,
      weekday: null,
      date_local: null,
      lead_works: false,
      lead_declined_offered_times: false,
    });
  }
  const offered = c.toolState.offeredThisTurn;
  const vars: TemplateVars = { ...c.vars, slotA: offered[0]?.label, slotB: offered[1]?.label };
  const templateId: TemplateId = offered.length >= 2 ? "call_now_unavailable" : offered.length === 1 ? "offer_one_time" : "ask_time_preference";
  const msg = await c.sendTemplate(templateId, vars, {
    offered: offered.length > 0 ? offered : undefined,
    usage: c.usage,
    forceApproval: c.forceApproval,
  });
  return finishChecked(ctx, { ...c.patch, callNowState: null }, "acted", `call_now_${templateId}`, { messageId: msg?.id });
}

/** Exposed for the settings / actions layer: the hold-message ETA in the lead's words. */
export function etaFor(settings: AiSetterSettings, now: Date, lang: Lang, leadZone: string): string {
  return formatEta({ now, schedule: settings.schedule, lang, leadZone });
}

/** Lead-safe, single-line note text (exported for actions). */
export function noteText(text: string): string {
  return clip(sanitizeForRecord(text, 300), 300);
}
