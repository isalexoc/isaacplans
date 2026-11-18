/**
 * The ONLY path that sends a message to a lead: a QStash job per approved message.
 *
 * Approval means "release", not "send": right before the POST everything is re-checked against
 * fresh GHL data — suppression, DND, enrollment and exclusion tags, the number the reply was
 * written for, a newer inbound since the turn READ the thread (→ stale + a new turn), Isaac
 * replying by hand (→ stale + pause), a pending opt-out clarification, the WhatsApp 24 h window,
 * the lead's hours (→ held), times that went stale while held, and whether a template is still
 * approved. Two-phase: approved → sending (one conditional UPDATE, so a double tap or a QStash
 * retry can never send twice) → sent | send_unknown | failed.
 *
 * An app-detected opt-out's DND (`decision.setDndAfterSend`) is applied on EVERY final outcome —
 * sent, stale, blocked, failed, unknown — never only when the confirmation text went out.
 *
 * Pure apart from the injected ports.
 */

import { resolveTimezone } from "@/lib/leads-the-way/timezone";
import { localCalendarDateKey } from "@/lib/timezone";

import { latestHumanOutbound, newestInbound } from "./classify";
import { channelWindow, replyWindowDecision, resolveLeadZones } from "./compliance";
import { AI_SETTER_TAG, EXCLUSION_TAGS } from "./config";
import { templateHash, isTemplateId } from "./templates";
import { toE164Nanp } from "./text-utils";
import type { AiSetterPorts, ContactSnapshot, DndChannel, LeadRecord, MessageRecord, OfferedSlot } from "./types";

export type SendResult = {
  kind: "sent" | "held" | "stale" | "blocked" | "failed" | "unknown" | "noop";
  reason: string;
};

/** A turn untouched this long is dead (same window as the store's stale-turn rule). */
const TURN_GRACE_MS = 6 * 60_000;
/** Holds caused by errors (GHL 5xx/429, settings read, deadline) give up after this long. */
const MAX_ERROR_HOLD_MS = 2 * 3_600_000;
/** An offered time closer than this when the message would go out is no longer offerable. */
const MIN_OFFER_NOTICE_MS = 60 * 60_000;
/** A verify that can't read the thread gives up after this long (then Isaac checks by hand). */
const MAX_VERIFY_MS = 3_600_000;
/** Words whose meaning depends on the day the text is read. */
const RELATIVE_DAY_RE = /\b(?:today|tonight|tomorrow|this (?:morning|afternoon|evening)|hoy|mañana|esta (?:noche|tarde))\b/iu;

function decisionOf(msg: MessageRecord): Record<string, unknown> {
  return msg.decision ?? {};
}

function isCompliance(msg: MessageRecord): boolean {
  return decisionOf(msg).compliance === true;
}

function dndAfterSend(msg: MessageRecord): DndChannel[] | null {
  const v = decisionOf(msg).setDndAfterSend;
  if (!Array.isArray(v)) return null;
  const list = v.filter((c): c is DndChannel => typeof c === "string");
  return list.length > 0 ? list : null;
}

function offeredOf(msg: MessageRecord): OfferedSlot[] | null {
  const v = decisionOf(msg).offeredSlots;
  if (!Array.isArray(v)) return null;
  return v.filter(
    (s): s is OfferedSlot =>
      Boolean(s) && typeof s === "object" && typeof (s as OfferedSlot).id === "string" && typeof (s as OfferedSlot).startIso === "string"
  );
}

function dateOf(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t) : null;
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.length > 0) : [];
}

function hasTag(contact: ContactSnapshot, tag: string): boolean {
  const t = tag.toLowerCase();
  return contact.tags.some((x) => x.trim().toLowerCase() === t);
}

function isAiManaged(contact: ContactSnapshot): boolean {
  return hasTag(contact, AI_SETTER_TAG) && !EXCLUSION_TAGS.some((t) => hasTag(contact, t));
}

async function markStale(ports: AiSetterPorts, msg: MessageRecord, reason: string): Promise<SendResult> {
  await ports.store.transitionMessage(msg.id, ["approved", "sending"], "stale", { error: reason });
  await ports.store.recordEvent(msg.contactId, "send_stale", { messageId: msg.id, reason });
  return { kind: "stale", reason };
}

/**
 * Stale, and answer again with fresh context. The new turn must SEE the message this one
 * answered: when a later turn already moved the watermark past it (an "ok", an emoji), it is
 * rewound to just before the answered inbound — otherwise the regeneration ends "nothing new".
 */
async function staleAndRegenerate(
  ports: AiSetterPorts,
  msg: MessageRecord,
  lead: LeadRecord | null,
  reason: string
): Promise<SendResult> {
  const { store, queue } = ports;
  const result = await markStale(ports, msg, reason);
  const answeredAt = dateOf(decisionOf(msg).inReplyToAt);
  if (lead && answeredAt && lead.lastHandledInboundAt && lead.lastHandledInboundAt.getTime() >= answeredAt.getTime()) {
    await store.updateLeadUnfenced(msg.contactId, {
      lastHandledInboundId: null,
      lastHandledInboundAt: new Date(answeredAt.getTime() - 1),
    });
  }
  const armed = await store.armTurn(msg.contactId, ports.now());
  if (armed.armed && armed.runId) await queue.publishTurn(msg.contactId, armed.runId, 0, { reason: "inbound" });
  return result;
}

/**
 * Re-queue a send held by an error. Bounded: after MAX_ERROR_HOLD_MS from approval (or from the
 * hold time it was waiting for), the message goes stale and Isaac is told — no endless chains.
 */
async function holdOrGiveUp(ports: AiSetterPorts, msg: MessageRecord, reason: string, delayMs: number): Promise<SendResult> {
  const now = ports.now();
  const base = Math.max((msg.approvedAt ?? msg.createdAt).getTime(), msg.notBefore?.getTime() ?? 0);
  if (now.getTime() - base > MAX_ERROR_HOLD_MS) {
    const res = await markStale(ports, msg, `gave_up_${reason}`);
    await ports.notify.notify({ kind: "error", detail: `un mensaje no se pudo enviar en 2 horas (${reason}); revisa el CRM` });
    return res;
  }
  await ports.queue.publishSend(msg.id, new Date(now.getTime() + delayMs));
  return { kind: "held", reason };
}

/** Lead updates once a message is out (offers become "live", disclosure recorded). */
async function afterSent(ports: AiSetterPorts, msg: MessageRecord, lead: LeadRecord | null): Promise<void> {
  const now = ports.now();
  const d = decisionOf(msg);
  const patch: Partial<LeadRecord> = { lastAiOutboundAt: now };
  if (d.includesDisclosure === true) {
    patch.disclosedChannels = { ...(lead?.disclosedChannels ?? {}), [msg.channel]: now.toISOString() };
  }
  const offered = offeredOf(msg);
  if (offered && offered.length > 0) {
    patch.offeredSlots = offered;
    patch.offeredAt = now;
  } else if (d.clearOffers === true) {
    patch.offeredSlots = [];
  }
  await ports.store.updateLeadUnfenced(msg.contactId, patch);
}

/** Applies a pending opt-out DND; one retry, then Isaac is told (GHL's workflows would keep texting). */
async function applyPendingDnd(ports: AiSetterPorts, msg: MessageRecord, channels: DndChannel[]): Promise<void> {
  if (await ports.ghl.setDnd(msg.contactId, channels)) return;
  if (await ports.ghl.setDnd(msg.contactId, channels)) return;
  ports.log.error("Opt-out DND not applied", { contactId: msg.contactId, messageId: msg.id });
  await ports.notify.notify({ kind: "error", detail: "no se pudo poner el DND de una baja; ponlo a mano en el CRM" });
}

export async function runSend(messageId: string, ports: AiSetterPorts): Promise<SendResult> {
  const msg = await ports.store.getMessage(messageId);
  if (!msg || msg.status !== "approved") return { kind: "noop", reason: msg ? `status_${msg.status}` : "missing" };
  const result = await sendApproved(msg, ports);
  const dnd = dndAfterSend(msg);
  // "held" comes back later; "noop" means another worker owns it (and will apply it).
  if (dnd && result.kind !== "held" && result.kind !== "noop") await applyPendingDnd(ports, msg, dnd);
  return result;
}

async function sendApproved(msg: MessageRecord, ports: AiSetterPorts): Promise<SendResult> {
  const { store, ghl, queue, config } = ports;
  const now = ports.now();
  const d = decisionOf(msg);

  if (!msg.body) return markStale(ports, msg, "no_body");
  if (msg.notBefore && msg.notBefore.getTime() > now.getTime() + 30_000) {
    await queue.publishSend(msg.id, msg.notBefore);
    return { kind: "held", reason: "not_before" };
  }
  if (config.dryRun) return markStale(ports, msg, "dry_run");

  const compliance = isCompliance(msg);
  // HELP / confirmations / clarifications are only worth sending promptly.
  if (compliance && msg.expiresAt && msg.expiresAt.getTime() <= now.getTime()) return markStale(ports, msg, "expired");

  const settings = await ports.settings.read();
  if (!compliance && settings.failedClosed) return holdOrGiveUp(ports, msg, "settings_unavailable", 60_000);
  if (!compliance && settings.paused) return markStale(ports, msg, "paused_all");

  const lead = await store.getLead(msg.contactId);
  // A turn for this lead is armed or running: it may answer something newer (and supersede this).
  if (
    !compliance &&
    lead &&
    (lead.turnState === "running" || lead.turnState === "armed") &&
    now.getTime() - lead.updatedAt.getTime() < TURN_GRACE_MS
  ) {
    await queue.publishSend(msg.id, new Date(now.getTime() + 30_000));
    return { kind: "held", reason: `turn_${lead.turnState}` };
  }
  if (!compliance && lead?.optOutPending) return markStale(ports, msg, "optout_pending");
  const statusAtCreation = d.leadStatusAtCreation;
  if (
    !compliance &&
    lead &&
    lead.status !== statusAtCreation &&
    (lead.status === "opted_out" || lead.status === "paused" || lead.status === "handoff" || lead.status === "stopped")
  ) {
    return markStale(ports, msg, `lead_${lead.status}`);
  }

  // Fresh GHL state.
  const contactRes = await ghl.getContact(msg.contactId);
  if (!contactRes.ok) {
    if (contactRes.retryable) return holdOrGiveUp(ports, msg, `contact_${contactRes.status}`, 60_000);
    return markStale(ports, msg, `contact_${contactRes.status}`);
  }
  const contact = contactRes.value;
  if (!isAiManaged(contact)) return markStale(ports, msg, "not_ai_managed");
  const e164 = toE164Nanp(contact.phone);
  // The reply goes only to the number the turn read (the contact's phone may have been changed).
  const toE164 = typeof d.toE164 === "string" ? d.toE164 : null;
  if (toE164 && e164 !== toE164) {
    await store.recordEvent(msg.contactId, "phone_changed_before_send", { messageId: msg.id });
    await ports.notify.notify({ kind: "error", detail: "el teléfono del contacto cambió antes de enviar; la IA no envió" });
    return markStale(ports, msg, "phone_changed");
  }
  if (!compliance && (!e164 || (await store.isSuppressed(e164)))) {
    await store.transitionMessage(msg.id, ["approved"], "blocked", { error: "suppressed" });
    return { kind: "blocked", reason: "suppressed" };
  }
  const dnd = contact.dndChannels[msg.channel];
  if (contact.dnd || dnd === "active" || dnd === "permanent") {
    await store.transitionMessage(msg.id, ["approved"], "blocked", { error: "dnd" });
    return { kind: "blocked", reason: "dnd" };
  }

  const messagesRes = await ghl.listMessages(msg.contactId, { limit: 30, sinceDays: 7 });
  if (!messagesRes.ok) {
    if (messagesRes.retryable) return holdOrGiveUp(ports, msg, `messages_${messagesRes.status}`, 60_000);
    return markStale(ports, msg, `messages_${messagesRes.status}`);
  }
  const messages = messagesRes.value;
  // A closed WhatsApp window can't be fixed by regenerating: stale, nothing else.
  if (msg.channel === "WhatsApp" && !channelWindow(messages, "WhatsApp", now).open) {
    return markStale(ports, msg, "whatsapp_window_closed");
  }

  if (!compliance) {
    // The boundary is when the turn READ the thread, not when the row was written (the model
    // call sits in between: a message or Isaac's reply in that window must count).
    const contextAt = dateOf(d.contextAt) ?? msg.createdAt;
    const newest = newestInbound(messages, ["SMS", "WhatsApp"]);
    if (newest && newest.id !== msg.inReplyToInboundId && newest.dateAdded.getTime() > contextAt.getTime()) {
      return staleAndRegenerate(ports, msg, lead, "newer_inbound");
    }
    const ourIds = await store.knownGhlMessageIds(msg.contactId);
    const human = latestHumanOutbound(messages, contextAt, { ourGhlIds: ourIds, isaacUserId: config.isaacUserId });
    if (human) {
      await store.updateLeadUnfenced(msg.contactId, {
        status: "paused",
        pausedUntil: new Date(human.dateAdded.getTime() + config.humanPauseHours * 3_600_000),
        pauseReason: "isaac_replied",
        disclosedChannels: {},
        callNowState: null,
      });
      return markStale(ports, msg, "isaac_replied");
    }
    // Times worded for another day ("mañana a las 10" written yesterday), or an offer too close.
    const leadZone = typeof d.leadZone === "string" ? d.leadZone : (lead?.leadTimezone ?? "America/New_York");
    const referenceAt = dateOf(d.referenceAt) ?? dateOf(d.contextAt) ?? msg.createdAt;
    if (RELATIVE_DAY_RE.test(msg.body) && localCalendarDateKey(referenceAt, leadZone) !== localCalendarDateKey(now, leadZone)) {
      return staleAndRegenerate(ports, msg, lead, "day_changed");
    }
    const offered = offeredOf(msg) ?? [];
    if (offered.some((s) => Date.parse(s.startIso) < now.getTime() + MIN_OFFER_NOTICE_MS)) {
      return staleAndRegenerate(ports, msg, lead, "offer_too_soon");
    }
    // Template still approved with the same wording?
    if (msg.kind === "template" && msg.templateId && isTemplateId(msg.templateId) && !msg.approvedBy) {
      const hash = templateHash(msg.templateId);
      if (settings.approvedTemplates[msg.templateId] !== hash || msg.templateHash !== hash) {
        await store.transitionMessage(msg.id, ["approved"], "draft", {
          expiresAt: new Date(now.getTime() + config.draftTtlHours * 3_600_000),
        });
        await ports.notify.notify({
          kind: "draft_ready",
          messageId: msg.id,
          contactId: msg.contactId,
          firstName: lead?.firstName ?? null,
          product: lead?.product ?? null,
          state: lead?.stateCode ?? null,
          leadLocalTime: new Intl.DateTimeFormat("es-US", { timeZone: leadZone, hour: "numeric", minute: "2-digit" }).format(now),
          sendsAt: "ahora",
          preview: null,
        });
        return { kind: "held", reason: "template_not_approved" };
      }
    }
  }

  // Hours. Zones: the CURRENT GHL address plus every zone the turn considered (a state the lead
  // reported, an older address): the strictest rule wins.
  const fresh = resolveLeadZones(
    { ghlTimezone: contact.timezone, state: contact.state, postalCode: contact.postalCode, phone: contact.phone },
    resolveTimezone
  );
  const zones = [...new Set([...fresh.zones, ...stringsOf(d.zones)])];
  const stateCodes = [...new Set([...fresh.stateCodes, ...stringsOf(d.stateCodes)])];
  const lastInbound = newestInbound(messages, ["SMS", "WhatsApp"]);
  const window = replyWindowDecision({ now, lastInboundAt: lastInbound?.dateAdded ?? null, zones, stateCodes });
  if (!compliance && !window.allowedNow) {
    if (!window.nextAllowedAt) return markStale(ports, msg, "no_window");
    await store.transitionMessage(msg.id, ["approved"], "approved", { notBefore: window.nextAllowedAt });
    await queue.publishSend(msg.id, window.nextAllowedAt);
    return { kind: "held", reason: window.reason };
  }
  if (Date.now() > ports.deadlineAt) return holdOrGiveUp(ports, msg, "deadline", 30_000);

  // ── Two-phase send ─────────────────────────────────────────────────────────────────
  const claimed = await store.transitionMessage(msg.id, ["approved"], "sending");
  if (!claimed) return { kind: "noop", reason: "already_claimed" };

  const outcome = await ghl.sendMessage({ contactId: msg.contactId, channel: msg.channel, text: msg.body });

  if (outcome.kind === "sent") {
    await store.transitionMessage(msg.id, ["sending"], "sent", { ghlMessageId: outcome.messageId, sentAt: ports.now() });
    await afterSent(ports, msg, lead);
    await store.recordEvent(msg.contactId, "sent", { messageId: msg.id, channel: msg.channel, templateId: msg.templateId });
    return { kind: "sent", reason: "ok" };
  }
  if (outcome.kind === "unknown") {
    await store.transitionMessage(msg.id, ["sending"], "send_unknown", { error: `unknown_${outcome.status}` });
    await queue.publishVerifySend(msg.id, 120);
    return { kind: "unknown", reason: `status_${outcome.status}` };
  }
  if (outcome.reason === "rate_limited") {
    const back = await store.transitionMessage(msg.id, ["sending"], "approved");
    return holdOrGiveUp(ports, back ?? msg, "rate_limited", 60_000);
  }
  await store.transitionMessage(msg.id, ["sending"], "failed", { error: `${outcome.reason}_${outcome.status}` });
  if (outcome.reason === "dnd") {
    // A DND rejection is a text match on GHL's error, not proof of an opt-out (Isaac may have set
    // a temporary DND): pause the lead instead of writing a permanent suppression.
    await store.updateLeadUnfenced(msg.contactId, { status: "paused", pausedUntil: null, pauseReason: "ghl_dnd" });
    await store.recordEvent(msg.contactId, "send_rejected_dnd", { messageId: msg.id });
  } else {
    await ports.notify.notify({ kind: "error", detail: `envío rechazado (${outcome.reason} ${outcome.status})` });
  }
  return { kind: "failed", reason: `${outcome.reason}_${outcome.status}` };
}

/**
 * A send whose outcome was unknown (timeout/5xx after POST): look for it in the thread. Found →
 * sent. Not found → failed and Isaac is told; the app never resends blindly (it could double-text).
 */
export async function runVerifySend(messageId: string, ports: AiSetterPorts): Promise<SendResult> {
  const { store, ghl } = ports;
  const msg = await store.getMessage(messageId);
  if (!msg || msg.status !== "send_unknown" || !msg.body) return { kind: "noop", reason: "not_unknown" };
  const res = await ghl.listMessages(msg.contactId, { limit: 15, sinceDays: 1 });
  if (!res.ok) {
    if (res.retryable && ports.now().getTime() - msg.updatedAt.getTime() < MAX_VERIFY_MS) {
      await ports.queue.publishVerifySend(msg.id, 300);
      return { kind: "held", reason: `messages_${res.status}` };
    }
    await store.transitionMessage(msg.id, ["send_unknown"], "failed", { error: `verify_${res.status}` });
    await ports.notify.notify({ kind: "error", detail: "no se pudo confirmar un envío; revisa la conversación en el CRM" });
    return { kind: "failed", reason: `messages_${res.status}` };
  }
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  const target = norm(msg.body);
  // From when the row was written: a row the reconcile found stuck in `sending` was POSTed long
  // before it became `send_unknown`.
  const since = msg.createdAt.getTime() - 5 * 60_000;
  const match = res.value.find(
    (m) => m.direction === "outbound" && m.dateAdded.getTime() >= since && norm(m.body) === target
  );
  if (match) {
    await store.transitionMessage(msg.id, ["send_unknown"], "sent", { ghlMessageId: match.id, sentAt: match.dateAdded });
    await afterSent(ports, msg, await store.getLead(msg.contactId));
    return { kind: "sent", reason: "verified" };
  }
  await store.transitionMessage(msg.id, ["send_unknown"], "failed", { error: "unknown_not_found" });
  await ports.notify.notify({ kind: "error", detail: "un envío quedó en duda; revisa la conversación en el CRM" });
  return { kind: "failed", reason: "unknown_not_found" };
}
