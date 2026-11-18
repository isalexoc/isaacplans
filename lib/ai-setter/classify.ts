/**
 * Who sent an outbound message in a lead's thread, and the newest inbound/human messages.
 *
 *   ours      — the AI sent it (its GHL id is in ai_setter_messages)
 *   automated — workflows, campaigns, bulk actions, calendar confirmations, other API apps
 *   human     — Isaac: the GHL web/mobile app, Kixie texts, any outbound call, WhatsApp from his
 *               phone (coexistence), or anything else carrying his user id
 *
 * A human message pauses the AI (48 h) and voids its drafts; automation never does.
 *
 * Provisional: GHL does not document how each sender is marked. Phase 0
 * (`pnpm ai-setter:try --sources <contactId>`) captures the real `source` / `messageType` /
 * `userId` of one message of every kind, and these sets are frozen from that data.
 *
 * Pure: no DB, no network.
 */

import type { ThreadChannel, ThreadMessage } from "./types";

export type OutboundClass = "ours" | "automated" | "human";

/** What the classifier needs besides the message: our own GHL ids and Isaac's GHL user id. */
export type OutboundContext = { ourGhlIds: Set<string>; isaacUserId: string | null };

const AUTOMATED_SOURCES = new Set(["workflow", "campaign", "bulk_actions"]);
/** Texts sent through a custom conversation provider: Kixie's texts land here. */
const PROVIDER_SMS_TYPES = new Set(["TYPE_CUSTOM_SMS", "TYPE_CUSTOM_PROVIDER_SMS"]);
/** CRM-dialed (TYPE_CALL) and Kixie-logged (TYPE_CUSTOM_CALL) calls. */
const CALL_TYPES = new Set(["TYPE_CALL", "TYPE_CUSTOM_CALL"]);

function hasValidDate(msg: ThreadMessage): boolean {
  return msg.dateAdded instanceof Date && !Number.isNaN(msg.dateAdded.getTime());
}

/** Log entries, campaign steps and review/payment requests: system items whoever created them. */
function isSystemItem(type: string, channel: ThreadChannel): boolean {
  return channel === "Activity" || type.startsWith("TYPE_ACTIVITY") || type.startsWith("TYPE_CAMPAIGN_") || type.endsWith("_REQUEST");
}

function isHumanSent(msg: ThreadMessage, type: string, source: string, ctx: OutboundContext): boolean {
  const automatedSource = AUTOMATED_SOURCES.has(source);
  if (source === "app") return true;
  if (CALL_TYPES.has(type)) return true;
  if (PROVIDER_SMS_TYPES.has(type)) return !automatedSource;
  if (msg.channel === "WhatsApp") return source !== "api" && !automatedSource;
  // An API message carrying Isaac's id can be one of OUR sends whose GHL id is not stored yet.
  return Boolean(ctx.isaacUserId) && msg.userId === ctx.isaacUserId && !automatedSource && source !== "api";
}

/**
 * Classify one outbound message. Rule order:
 *  1. ours: the id is one this app sent.
 *  2. automated: Activity entries, TYPE_ACTIVITY*, TYPE_CAMPAIGN_*, *_REQUEST (system items, even
 *     when created from the app).
 *  3. human: source "app"; any outbound call; Kixie/provider texts (unless a workflow, campaign or
 *     bulk action sent them); WhatsApp not sent by the API or an automation; Isaac's user id on a
 *     message not sent by the API or an automation.
 *  4. automated: everything else — workflows, campaigns, bulk actions, other API apps, calendar
 *     confirmations, unknown senders.
 * An inbound message passed by mistake is never human (→ "automated").
 */
export function classifyOutbound(msg: ThreadMessage, ctx: OutboundContext): OutboundClass {
  if (ctx.ourGhlIds.has(msg.id)) return "ours";
  if (msg.direction !== "outbound") return "automated";
  const type = (msg.messageType ?? "").trim().toUpperCase();
  const source = (msg.source ?? "").trim().toLowerCase();
  if (isSystemItem(type, msg.channel)) return "automated";
  return isHumanSent(msg, type, source, ctx) ? "human" : "automated";
}

/** Newest outbound message classified human with `dateAdded` strictly after `after` (any time when null). */
export function latestHumanOutbound(
  messages: ThreadMessage[],
  after: Date | null,
  ctx: OutboundContext
): ThreadMessage | null {
  const afterMs = after ? after.getTime() : Number.NEGATIVE_INFINITY;
  let newest: ThreadMessage | null = null;
  for (const m of messages) {
    if (m.direction !== "outbound" || !hasValidDate(m) || m.dateAdded.getTime() <= afterMs) continue;
    if (newest && m.dateAdded.getTime() < newest.dateAdded.getTime()) continue;
    if (classifyOutbound(m, ctx) === "human") newest = m;
  }
  return newest;
}

/**
 * Newest inbound message, optionally only on `channels` (omitted = every channel; an empty list
 * matches nothing). On a timestamp tie the later array entry wins (GHL lists oldest first).
 */
export function newestInbound(messages: ThreadMessage[], channels?: ThreadChannel[]): ThreadMessage | null {
  const allowed = channels ? new Set<ThreadChannel>(channels) : null;
  let newest: ThreadMessage | null = null;
  for (const m of messages) {
    if (m.direction !== "inbound" || !hasValidDate(m)) continue;
    if (allowed && !allowed.has(m.channel)) continue;
    if (!newest || m.dateAdded.getTime() >= newest.dateAdded.getTime()) newest = m;
  }
  return newest;
}
