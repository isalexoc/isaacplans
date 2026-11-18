/**
 * GoHighLevel ("Agent CRM") adapter for the AI Setter: contacts, conversation threads, sending,
 * calendars, tags, notes and DND, behind the `GhlPort` contract in ./types.
 *
 * - Built on `httpJson`: every call has a timeout and nothing here throws or logs. Failures come
 *   back as values whose `error` is our own short code, never GHL's error body (it can carry names
 *   and phone numbers).
 * - Each endpoint family sends the `Version` its OpenAPI spec pins (constants below). The shared
 *   `agentCrm*Headers` helpers are not used because they pin 2021-07-28 for everything. The newer
 *   marketplace pages document `Version: v3`, where the DND channel keys are lowercase; this
 *   adapter stays on the dated versions the rest of the app already runs on.
 * - A write that times out (status 0) may still have reached GHL: `sendMessage` reports it as
 *   `unknown`, and callers check the thread or the contact's appointments before trying again.
 * - Ids go into URL paths only after a format check, so a malformed id never reaches GHL.
 * - An inbound SMS / WhatsApp's `fromNumber` comes from a field GHL doesn't document (see
 *   `senderNumberOf`); null means "unknown", never "no match".
 *
 * Not `server-only` (the CLI imports it). No DB, no logging.
 */

import { AGENT_CRM_API_BASE } from "@/lib/agent-crm-contacts";
import { httpJson, type FetchLike, type HttpResult } from "@/lib/phone-finder/http";

import { toE164Nanp } from "./text-utils";
import type {
  AppointmentRef,
  AttachmentKind,
  Channel,
  ContactSnapshot,
  DndChannel,
  DndStatus,
  GhlFailure,
  GhlPort,
  GhlResult,
  SendOutcome,
  ThreadChannel,
  ThreadMessage,
} from "./types";

// ─── API versions & limits ─────────────────────────────────────────────────────────────────

/** Contacts, tags, notes, DND and the contact's appointments. DND keys: SMS, WhatsApp, Email, FB, Call, GMB. */
const CONTACTS_API_VERSION = "2021-07-28";
/** Conversations: search, a conversation's messages, send. */
const CONVERSATIONS_API_VERSION = "2021-04-15";
/** Calendars: free slots, events, create / edit / read an appointment. */
const CALENDARS_API_VERSION = "2021-04-15";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_WRITE_TIMEOUT_MS = 20_000;
const DAY_MS = 86_400_000;

const CONVERSATION_SEARCH_LIMIT = 20;
/** Only the contact's most recently active conversations are read. */
const MAX_CONVERSATIONS = 5;
const MESSAGES_PAGE_SIZE = 100;
/** Backstop on pagination (500 messages per conversation); one page normally covers the window. */
const MAX_PAGES_PER_CONVERSATION = 5;

/** GET /calendars/{id}/free-slots rejects ranges over 31 days, so longer ones are split. */
const FREE_SLOTS_MAX_RANGE_MS = 31 * DAY_MS;
/** At most 3 chunks (93 days) per call; nothing later is asked for. */
const MAX_FREE_SLOT_CHUNKS = 3;

/** Contact appointments with a zone-less time that get re-read for the exact one (newest first). */
const MAX_APPOINTMENT_READBACKS = 10;

const DND_CHANNELS: readonly DndChannel[] = ["SMS", "WhatsApp", "Email", "FB", "Call", "GMB"];
const DND_SETTING = { status: "permanent", message: "Opted out via AI Setter", code: "ai_setter" } as const;

const SEND_CHANNELS: ReadonlySet<string> = new Set<Channel>(["SMS", "WhatsApp"]);

/** GHL ids (contacts, calendars, users, events, recurring instances): letters, digits, `_`, `-`. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// ─── Small readers ─────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trimmed non-empty string, else null. */
function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 429 || status >= 500;
}

function isValidId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/** `exact` is false for a zone-less date-time: GHL doesn't say which zone those are in. */
type Timestamp = { date: Date; exact: boolean };

const EPOCH_MS_TEXT = /^\d{12,14}$/;
const NAIVE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;
const EXPLICIT_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

function timestampOf(ms: number, exact: boolean): Timestamp | null {
  return Number.isFinite(ms) && ms > 0 ? { date: new Date(ms), exact } : null;
}

/**
 * Epoch ms (number or digit string) and ISO with an offset are exact. A zone-less
 * "YYYY-MM-DD HH:MM:SS" (what GET /contacts/{id}/appointments documents) is read as UTC, the same
 * on every machine, and flagged inexact.
 */
function readTimestamp(value: unknown): Timestamp | null {
  if (typeof value === "number") return timestampOf(value, true);
  const text = str(value);
  if (!text) return null;
  if (EPOCH_MS_TEXT.test(text)) return timestampOf(Number(text), true);
  const naive = NAIVE_DATE_TIME.exec(text);
  if (naive) return timestampOf(Date.parse(`${naive[1]}T${naive[2]}Z`), false);
  return timestampOf(Date.parse(text), EXPLICIT_ZONE.test(text));
}

function toDate(value: unknown): Date | null {
  return readTimestamp(value)?.date ?? null;
}

/** Only a time GHL stated with its zone (or as epoch ms). */
function exactDate(value: unknown): Date | null {
  const ts = readTimestamp(value);
  return ts && ts.exact ? ts.date : null;
}

// ─── Contact ───────────────────────────────────────────────────────────────────────────────

const DND_CHANNEL_BY_KEY = new Map<string, DndChannel>(DND_CHANNELS.map((c) => [c.toLowerCase(), c]));
const DND_STRICTNESS: Record<DndStatus, number> = { inactive: 0, active: 1, permanent: 2 };

function dndStatusOf(value: unknown): DndStatus | null {
  const status = str(value)?.toLowerCase();
  return status === "active" || status === "inactive" || status === "permanent" ? status : null;
}

/** 2021-07-28 keys (SMS, WhatsApp, …) or v3 ones (sms, whatsApp, …); when both appear the stricter wins. */
function parseDndChannels(raw: unknown): Partial<Record<DndChannel, DndStatus>> {
  const channels: Partial<Record<DndChannel, DndStatus>> = {};
  if (!isRecord(raw)) return channels;
  for (const [key, setting] of Object.entries(raw)) {
    const channel = DND_CHANNEL_BY_KEY.get(key.toLowerCase());
    const status = isRecord(setting) ? dndStatusOf(setting.status) : null;
    if (!channel || !status) continue;
    const current = channels[channel];
    if (!current || DND_STRICTNESS[status] > DND_STRICTNESS[current]) channels[channel] = status;
  }
  return channels;
}

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const items: unknown[] = raw;
  const tags: string[] = [];
  for (const tag of items) {
    const name = str(tag) ?? (isRecord(tag) ? str(tag.name) : null);
    if (name) tags.push(name);
  }
  return tags;
}

/** A zone `Intl` accepts, else null (a bad one would throw later, wherever times get formatted). */
function ianaZone(value: unknown): string | null {
  const zone = str(value);
  if (!zone) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

/** GET /contacts/{id} answers `{ contact: {...} }`; a bare contact object is accepted too. Null without an id. */
export function parseContact(json: unknown): ContactSnapshot | null {
  if (!isRecord(json)) return null;
  const c = isRecord(json.contact) ? json.contact : json;
  const id = str(c.id);
  if (!id) return null;
  return {
    id,
    locationId: str(c.locationId),
    firstName: str(c.firstName),
    lastName: str(c.lastName),
    phone: str(c.phone),
    email: str(c.email),
    tags: parseTags(c.tags),
    timezone: ianaZone(c.timezone),
    state: str(c.state),
    postalCode: str(c.postalCode),
    source: str(c.source),
    dnd: c.dnd === true,
    dndChannels: parseDndChannels(c.dndSettings),
    dateAdded: toDate(c.dateAdded),
  };
}

// ─── Messages ──────────────────────────────────────────────────────────────────────────────

/**
 * TYPE_RCS (RCS, the carriers' richer SMS) counts as SMS: it shares the lead's phone thread, and a
 * reply to it goes out as type "SMS". `messageType` itself stays raw ("TYPE_RCS").
 */
const TYPES_BY_CHANNEL: ReadonlyArray<[ThreadChannel, readonly string[]]> = [
  ["SMS", ["TYPE_SMS", "TYPE_RCS", "TYPE_CUSTOM_SMS", "TYPE_CUSTOM_PROVIDER_SMS"]],
  ["WhatsApp", ["TYPE_WHATSAPP"]],
  ["Email", ["TYPE_EMAIL", "TYPE_CUSTOM_EMAIL", "TYPE_CUSTOM_PROVIDER_EMAIL"]],
  ["FB", ["TYPE_FACEBOOK", "TYPE_FB_MESSENGER", "TYPE_FACEBOOK_COMMENT", "TYPE_FB"]],
  ["IG", ["TYPE_INSTAGRAM", "TYPE_INSTAGRAM_COMMENT", "TYPE_IG"]],
  ["Live_Chat", ["TYPE_LIVE_CHAT", "TYPE_WEBCHAT"]],
  ["Call", ["TYPE_CALL", "TYPE_CUSTOM_CALL", "TYPE_IVR_CALL", "TYPE_VOICEMAIL"]],
];
const CHANNEL_BY_TYPE = new Map<string, ThreadChannel>(
  TYPES_BY_CHANNEL.flatMap(([channel, types]) => types.map((type): [string, ThreadChannel] => [type, channel]))
);

/**
 * GHL `messageType` → channel. Also covers TYPE_RCS (→ SMS), TYPE_SMS_* (review / no-show
 * requests, reactions) and TYPE_ACTIVITY_*. A short webhook-style name ("SMS", "RCS", "WhatsApp",
 * "FB") is read as TYPE_<name>.
 */
export function channelOfMessageType(messageType: string): ThreadChannel {
  const upper = messageType.trim().toUpperCase();
  const type = upper.startsWith("TYPE_") ? upper : `TYPE_${upper}`;
  const known = CHANNEL_BY_TYPE.get(type);
  if (known) return known;
  if (type.startsWith("TYPE_SMS_")) return "SMS";
  if (type.startsWith("TYPE_ACTIVITY")) return "Activity";
  return "Other";
}

/**
 * GHL's numeric message `type`, in the order of its `messageType` enum (index 0 = type 1). The docs
 * pin 1 = call, 3 = email, 10 = voicemail, 11 = Facebook, 18 = Instagram. Used only when a message
 * comes back without `messageType`.
 */
const MESSAGE_TYPE_BY_NUMBER: readonly string[] = [
  // 1–5
  "TYPE_CALL", "TYPE_SMS", "TYPE_EMAIL", "TYPE_SMS_REVIEW_REQUEST", "TYPE_WEBCHAT",
  // 6–10
  "TYPE_SMS_NO_SHOW_REQUEST", "TYPE_CAMPAIGN_SMS", "TYPE_CAMPAIGN_CALL", "TYPE_CAMPAIGN_EMAIL", "TYPE_CAMPAIGN_VOICEMAIL",
  // 11–15
  "TYPE_FACEBOOK", "TYPE_CAMPAIGN_FACEBOOK", "TYPE_CAMPAIGN_MANUAL_CALL", "TYPE_CAMPAIGN_MANUAL_SMS", "TYPE_GMB",
  // 16–20
  "TYPE_CAMPAIGN_GMB", "TYPE_REVIEW", "TYPE_INSTAGRAM", "TYPE_WHATSAPP", "TYPE_CUSTOM_SMS",
  // 21–25
  "TYPE_CUSTOM_EMAIL", "TYPE_CUSTOM_PROVIDER_SMS", "TYPE_CUSTOM_PROVIDER_EMAIL", "TYPE_IVR_CALL", "TYPE_ACTIVITY_CONTACT",
  // 26–30
  "TYPE_ACTIVITY_INVOICE", "TYPE_ACTIVITY_PAYMENT", "TYPE_ACTIVITY_OPPORTUNITY", "TYPE_LIVE_CHAT",
  "TYPE_LIVE_CHAT_INFO_MESSAGE",
  // 31–36
  "TYPE_ACTIVITY_APPOINTMENT", "TYPE_FACEBOOK_COMMENT", "TYPE_INSTAGRAM_COMMENT", "TYPE_CUSTOM_CALL",
  "TYPE_INTERNAL_COMMENT", "TYPE_ACTIVITY_EMPLOYEE_ACTION_LOG",
];

function messageTypeOf(raw: Json): string {
  const named = str(raw.messageType);
  if (named) return named;
  const n = raw.type;
  if (typeof n === "number" && Number.isInteger(n) && n >= 1) return MESSAGE_TYPE_BY_NUMBER[n - 1] ?? "TYPE_UNKNOWN";
  return "TYPE_UNKNOWN";
}

const EXTENSIONS: ReadonlyArray<[AttachmentKind, ReadonlySet<string>]> = [
  ["audio", new Set(["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "amr", "weba", "flac", "caf", "3ga", "wma"])],
  ["image", new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff", "svg", "avif"])],
  ["video", new Set(["mp4", "mov", "m4v", "3gp", "3g2", "webm", "avi", "mkv", "mpeg", "mpg", "wmv"])],
  [
    "document",
    new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv", "odt", "ods", "odp", "vcf"]),
  ],
];
const KIND_WORDS = new Map<string, AttachmentKind>([
  ["audio", "audio"],
  ["image", "image"],
  ["video", "video"],
  ["document", "document"],
]);
const DOCUMENT_TYPES = new Set(["application/pdf", "application/msword", "application/rtf"]);
const DOCUMENT_TYPE_PREFIXES = [
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
  "application/vnd.oasis.opendocument",
];

/** Null when the content type says nothing useful (missing, octet-stream, unrecognized). */
function kindOfContentType(contentType: string | null | undefined): AttachmentKind | null {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!type || type.endsWith("/octet-stream")) return null;
  const word = KIND_WORDS.get(type);
  if (word) return word;
  if (type.startsWith("audio/") || type === "application/ogg") return "audio";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("text/") || DOCUMENT_TYPES.has(type)) return "document";
  return DOCUMENT_TYPE_PREFIXES.some((prefix) => type.startsWith(prefix)) ? "document" : null;
}

function extensionOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** The attachment's content type when it is telling, else the URL's file extension, else "other". */
export function attachmentKindOf(url: string, contentType?: string | null): AttachmentKind {
  const byType = kindOfContentType(contentType);
  if (byType) return byType;
  const extension = extensionOf(url);
  for (const [kind, extensions] of EXTENSIONS) {
    if (extensions.has(extension)) return kind;
  }
  return "other";
}

/** URLs as strings, or `{ url, contentType }` objects. */
function attachmentKindsOf(raw: unknown): AttachmentKind[] {
  const items: unknown[] = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  const kinds: AttachmentKind[] = [];
  for (const item of items) {
    const url = str(item) ?? (isRecord(item) ? str(item.url) : null);
    const contentType = isRecord(item) ? (str(item.contentType) ?? str(item.mimeType)) : null;
    if (url || contentType) kinds.push(attachmentKindOf(url ?? "", contentType));
  }
  return kinds;
}

/**
 * The number an INBOUND SMS / WhatsApp came from, as strict NANP E.164 (+1XXXXXXXXXX), else null.
 *
 * GET /conversations/{id}/messages documents no sender number: `GetMessageResponseDto` has none,
 * and `from` / `to` are documented only on `CallDataDTO` (the call info a conversation provider
 * posts) and on email messages (as addresses). Phone messages can still carry one, so this reads
 * the top-level `from` (the name GHL gives a sender wherever it documents one), then `meta.from`.
 * The first one present decides. The conversation's `phone` is never read: it is the contact's
 * primary phone, not the sender. `pnpm ai-setter:try --sources` prints the result, so Phase 0
 * checks it against real messages.
 *
 * Null = unknown: outbound, another channel, no such field, or not a NANP number (international,
 * short code, address). Callers do not block on null; only a known number that differs does.
 */
function senderNumberOf(raw: Json, direction: ThreadMessage["direction"], channel: ThreadChannel): string | null {
  if (direction !== "inbound" || (channel !== "SMS" && channel !== "WhatsApp")) return null;
  const meta = isRecord(raw.meta) ? raw.meta : null;
  return toE164Nanp(str(raw.from) ?? (meta ? str(meta.from) : null));
}

/** Null for internal comments and malformed items (no id, date or direction). */
function parseMessage(raw: unknown, fallbackConversationId: string): ThreadMessage | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id) ?? str(raw.messageId);
  const direction = str(raw.direction)?.toLowerCase();
  const dateAdded = toDate(raw.dateAdded);
  if (!id || !dateAdded || (direction !== "inbound" && direction !== "outbound")) return null;
  const messageType = messageTypeOf(raw);
  if (messageType.toUpperCase().includes("INTERNAL_COMMENT")) return null;
  const channel = channelOfMessageType(messageType);
  return {
    id,
    conversationId: str(raw.conversationId) ?? fallbackConversationId,
    direction,
    channel,
    messageType,
    source: str(raw.source),
    userId: str(raw.userId),
    body: typeof raw.body === "string" ? raw.body : "",
    fromNumber: senderNumberOf(raw, direction, channel),
    attachmentKinds: attachmentKindsOf(raw.attachments),
    dateAdded,
    status: str(raw.status),
  };
}

function parseMessageItems(items: unknown[], conversationId: string): ThreadMessage[] {
  const messages: ThreadMessage[] = [];
  for (const item of items) {
    const message = parseMessage(item, conversationId);
    if (message) messages.push(message);
  }
  return messages;
}

type MessagesPage = { items: unknown[]; nextPage: boolean; cursor: string | null };

/** `{ messages: { messages, nextPage, lastMessageId } }` as the API answers, or the flat shape the spec shows. */
function readMessagesPage(json: unknown): MessagesPage | null {
  if (!isRecord(json)) return null;
  const page = isRecord(json.messages) ? json.messages : json;
  if (!Array.isArray(page.messages)) return null;
  const items: unknown[] = page.messages;
  const last = items[items.length - 1];
  return {
    items,
    nextPage: page.nextPage === true,
    cursor: str(page.lastMessageId) ?? (isRecord(last) ? str(last.id) : null),
  };
}

const byDateAsc = (a: ThreadMessage, b: ThreadMessage) => a.dateAdded.getTime() - b.dateAdded.getTime();
const byDateDesc = (a: ThreadMessage, b: ThreadMessage) => b.dateAdded.getTime() - a.dateAdded.getTime();

/** First occurrence wins. */
function uniqueById(messages: ThreadMessage[]): ThreadMessage[] {
  const seen = new Set<string>();
  const unique: ThreadMessage[] = [];
  for (const message of messages) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    unique.push(message);
  }
  return unique;
}

/**
 * One GET /conversations/{id}/messages page as thread messages, oldest first and de-duplicated.
 * Internal comments and malformed items are dropped; `conversationId` fills in a missing one.
 */
export function parseMessages(json: unknown, conversationId: string): ThreadMessage[] {
  const page = readMessagesPage(json);
  if (!page) return [];
  // GHL pages are newest first: reversing before the stable sort keeps same-second messages in order.
  return uniqueById(parseMessageItems(page.items, conversationId)).reverse().sort(byDateAsc);
}

/** Activity entries ride along in the window; only conversation messages count toward the limit. */
function countsTowardLimit(message: ThreadMessage): boolean {
  return message.channel !== "Activity";
}

/**
 * All conversations merged newest first, de-duplicated, cut at `cutoffMs` and right after the
 * `limit`-th counted message, then returned oldest first.
 */
function windowThread(messages: ThreadMessage[], limit: number, cutoffMs: number): ThreadMessage[] {
  const kept: ThreadMessage[] = [];
  let counted = 0;
  for (const message of uniqueById([...messages].sort(byDateDesc))) {
    if (counted >= limit || message.dateAdded.getTime() < cutoffMs) break;
    kept.push(message);
    if (countsTowardLimit(message)) counted++;
  }
  return kept.reverse();
}

type ConversationRef = { id: string; lastMessageMs: number | null };

/** The contact's conversations, most recently active first. Null when the answer has no list. */
function readConversations(json: unknown, contactId: string): ConversationRef[] | null {
  if (!isRecord(json) || !Array.isArray(json.conversations)) return null;
  const items: unknown[] = json.conversations;
  const conversations: ConversationRef[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const id = str(item.id);
    const owner = str(item.contactId);
    if (!id || !isValidId(id) || (owner && owner !== contactId)) continue;
    const last = toDate(item.lastMessageDate) ?? toDate(item.dateUpdated) ?? toDate(item.dateAdded);
    conversations.push({ id, lastMessageMs: last ? last.getTime() : null });
  }
  return conversations.sort((a, b) => (b.lastMessageMs ?? 0) - (a.lastMessageMs ?? 0));
}

// ─── Calendars ─────────────────────────────────────────────────────────────────────────────

function slotMs(iso: string): number {
  return toDate(iso)?.getTime() ?? Number.NaN;
}

/** De-duplicated and in time order; unreadable times are dropped. */
function orderSlots(slots: string[]): string[] {
  return [...new Set(slots)].filter((iso) => Number.isFinite(slotMs(iso))).sort((a, b) => slotMs(a) - slotMs(b));
}

/**
 * GET /calendars/{id}/free-slots answers `{ "YYYY-MM-DD": { slots: [iso, …] }, traceId }`: every
 * `slots` array among the values, kept exactly as GHL wrote them (what a booking sends back).
 */
export function parseFreeSlots(json: unknown): string[] {
  if (!isRecord(json)) return [];
  const slots: string[] = [];
  for (const day of Object.values(json)) {
    if (!isRecord(day) || !Array.isArray(day.slots)) continue;
    const daySlots: unknown[] = day.slots;
    for (const slot of daySlots) {
      const iso = str(slot);
      if (iso) slots.push(iso);
    }
  }
  return orderSlots(slots);
}

type ParsedEvent = { ref: AppointmentRef; exact: boolean };

function readEventItems(json: unknown): unknown[] | null {
  const list: unknown = isRecord(json) ? (json.events ?? json.appointments) : json;
  return Array.isArray(list) ? list : null;
}

/** `appointmentStatus` (or GHL's legacy `appoinmentStatus`) over the generic `status`, lowercased. */
function statusOf(raw: Json, fallback: string): string {
  const status = str(raw.appointmentStatus) ?? str(raw.appoinmentStatus) ?? str(raw.status);
  return status ? status.toLowerCase() : fallback;
}

function readEvent(raw: unknown): ParsedEvent | null {
  if (!isRecord(raw) || raw.deleted === true) return null;
  const id = str(raw.id);
  const start = readTimestamp(raw.startTime);
  if (!id || !start) return null;
  const ref: AppointmentRef = {
    id,
    calendarId: str(raw.calendarId) ?? "",
    contactId: str(raw.contactId),
    startTime: start.date,
    endTime: toDate(raw.endTime),
    status: statusOf(raw, "unknown"),
    title: str(raw.title),
  };
  return { ref, exact: start.exact };
}

function parseEventItems(items: unknown[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  for (const item of items) {
    const event = readEvent(item);
    if (event) events.push(event);
  }
  return events;
}

const byStart = (a: AppointmentRef, b: AppointmentRef) => a.startTime.getTime() - b.startTime.getTime();

/**
 * `{ events: [...] }` from GET /calendars/events or GET /contacts/{id}/appointments (a bare array or
 * `{ appointments }` too), sorted by start. Deleted events are dropped; status is lowercased and
 * "unknown" when absent. A zone-less time is read as UTC; the port re-reads those for the exact one.
 */
export function parseEvents(json: unknown): AppointmentRef[] {
  return parseEventItems(readEventItems(json) ?? [])
    .map((event) => event.ref)
    .sort(byStart);
}

/** The appointment object, whether GHL answers it bare or under `appointment` / `event`. */
function unwrapAppointment(json: unknown): Json | null {
  if (!isRecord(json)) return null;
  if (str(json.id)) return json;
  if (isRecord(json.appointment)) return json.appointment;
  if (isRecord(json.event)) return json.event;
  return json;
}

/** What the request already says about the appointment, for fields a response leaves out. */
type AppointmentFallback = {
  id: string | null;
  calendarId: string;
  contactId: string | null;
  startIso: string | null;
  endIso: string | null;
  status: string;
  title: string | null;
};

/** Null when there is no id or no start time to report. */
function appointmentRefFrom(json: unknown, fallback: AppointmentFallback): AppointmentRef | null {
  const a = unwrapAppointment(json);
  const id = (a && str(a.id)) ?? fallback.id;
  const start = (a && exactDate(a.startTime)) ?? toDate(fallback.startIso);
  if (!id || !start) return null;
  return {
    id,
    calendarId: (a && str(a.calendarId)) ?? fallback.calendarId,
    contactId: (a && str(a.contactId)) ?? fallback.contactId,
    startTime: start,
    endTime: (a && exactDate(a.endTime)) ?? toDate(fallback.endIso),
    status: a ? statusOf(a, fallback.status) : fallback.status,
    title: (a && str(a.title)) ?? fallback.title,
  };
}

function mergeExactTime(ref: AppointmentRef, exact: AppointmentRef): AppointmentRef {
  return {
    ...ref,
    calendarId: exact.calendarId || ref.calendarId,
    contactId: exact.contactId ?? ref.contactId,
    startTime: exact.startTime,
    endTime: exact.endTime ?? ref.endTime,
    status: exact.status === "unknown" ? ref.status : exact.status,
    title: exact.title ?? ref.title,
  };
}

// ─── Error classification ──────────────────────────────────────────────────────────────────

const DND_ERROR = /\bdnd\b|do[\s_-]*not[\s_-]*disturb|opted[\s_-]*out|opt[\s_-]*out|unsubscrib/;
const SLOT_TAKEN_ERROR = /slot|not available|no longer available|unavailable|conflict/;

/** GHL's error wording, lowercased, for classification only: never returned or logged. */
function errorText(json: unknown): string {
  if (typeof json === "string") return json.toLowerCase();
  if (!isRecord(json)) return "";
  const parts: string[] = [];
  for (const key of ["message", "error", "msg"]) {
    const value = json[key];
    const items: unknown[] = Array.isArray(value) ? value : [value];
    for (const item of items) {
      const text = str(item) ?? (isRecord(item) ? str(item.message) : null);
      if (text) parts.push(text);
    }
  }
  return parts.join(" ").toLowerCase();
}

/**
 * A send that did not come back with a message id. 429 was not sent (retry later); 401/403 is the
 * token's scope; a 400/422 that names DND, do-not-disturb, opt-out or unsubscribe is the contact's
 * DND; any other 4xx is an invalid request. Everything else (no answer = 0, 5xx, a 2xx without an
 * id) may have gone out: `unknown`, so the caller reconciles against the thread before resending.
 */
export function classifySendFailure(status: number, json: unknown): SendOutcome {
  if (status === 429) return { kind: "rejected", status, reason: "rate_limited" };
  if (status === 401 || status === 403) return { kind: "rejected", status, reason: "scope" };
  if (status >= 400 && status < 500) {
    const dnd = (status === 400 || status === 422) && DND_ERROR.test(errorText(json));
    return { kind: "rejected", status, reason: dnd ? "dnd" : "invalid" };
  }
  return { kind: "unknown", status };
}

/** A 4xx (not auth / rate limit) saying the time is taken: the caller should offer new times. */
function isSlotTaken(status: number, json: unknown): boolean {
  const clientError = status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429;
  return clientError && SLOT_TAKEN_ERROR.test(errorText(json));
}

function failureOf(res: HttpResult): GhlFailure {
  const error = res.error ?? `http_${res.status}`;
  return { ok: false, status: res.status, retryable: isRetryableStatus(res.status), error };
}

/** Refused before any request: bad id, time or range. */
function localFailure(error: string): GhlFailure {
  return { ok: false, status: 0, retryable: false, error };
}

function invalidResponse(status: number): GhlFailure {
  return { ok: false, status, retryable: false, error: "invalid_response" };
}

// ─── HTTP client ───────────────────────────────────────────────────────────────────────────

/** Options for {@link createAiSetterGhlPort}. */
export type AiSetterGhlPortOptions = {
  /** The setter's own Private Integration token (AI_SETTER_GHL_PI), never AGENT_CRM_PI. */
  token: string;
  locationId: string;
  fetchImpl?: FetchLike;
  /** Reads. Default 15 s. */
  timeoutMs?: number;
  /** Writes (send, book, DND, tags, notes). Default 20 s. A write timeout means "may have landed". */
  writeTimeoutMs?: number;
};

type GhlRequest = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** Path and query, starting with "/". */
  path: string;
  version: string;
  body?: Json;
};

type GhlClient = { locationId: string; request(req: GhlRequest): Promise<HttpResult> };

function createClient(options: AiSetterGhlPortOptions): GhlClient {
  const read = { timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS, fetchImpl: options.fetchImpl };
  const write = { timeoutMs: options.writeTimeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS, fetchImpl: options.fetchImpl };
  const headers = (version: string, json = false): Record<string, string> => ({
    Accept: "application/json",
    Authorization: `Bearer ${options.token}`,
    Version: version,
    ...(json ? { "Content-Type": "application/json" } : {}),
  });

  return {
    locationId: options.locationId,
    request(req) {
      const init: RequestInit = { method: req.method, headers: headers(req.version, req.body !== undefined) };
      if (req.body !== undefined) init.body = JSON.stringify(req.body);
      return httpJson(`${AGENT_CRM_API_BASE}${req.path}`, init, req.method === "GET" ? read : write);
    },
  };
}

const seg = (id: string) => encodeURIComponent(id);

// ─── Contact & thread ──────────────────────────────────────────────────────────────────────

type ThreadOptions = Parameters<GhlPort["listMessages"]>[1];
type SendInput = Parameters<GhlPort["sendMessage"]>[0];

async function fetchContact(client: GhlClient, contactId: string): Promise<GhlResult<ContactSnapshot>> {
  if (!isValidId(contactId)) return localFailure("invalid_id");
  const path = `/contacts/${seg(contactId)}`;
  const res = await client.request({ method: "GET", path, version: CONTACTS_API_VERSION });
  if (!isOk(res.status)) return failureOf(res);
  const contact = parseContact(res.json);
  if (!contact) return invalidResponse(res.status);
  if (contact.locationId && contact.locationId !== client.locationId) {
    return { ok: false, status: res.status, retryable: false, error: "location_mismatch" };
  }
  return { ok: true, value: contact };
}

/** Pages back through one conversation until the window, the limit or the last page is reached. */
async function fetchConversation(
  client: GhlClient,
  conversationId: string,
  limit: number,
  cutoffMs: number
): Promise<GhlResult<ThreadMessage[]>> {
  const collected: ThreadMessage[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES_PER_CONVERSATION; page++) {
    const query = new URLSearchParams({ limit: String(MESSAGES_PAGE_SIZE) });
    if (cursor) query.set("lastMessageId", cursor);
    const path = `/conversations/${seg(conversationId)}/messages?${query}`;
    const res = await client.request({ method: "GET", path, version: CONVERSATIONS_API_VERSION });
    if (!isOk(res.status)) return failureOf(res);
    const parsed = readMessagesPage(res.json);
    if (!parsed) return invalidResponse(res.status);
    const messages = parseMessageItems(parsed.items, conversationId);
    collected.push(...messages);
    const counted = collected.filter((m) => countsTowardLimit(m) && m.dateAdded.getTime() >= cutoffMs).length;
    const reachedCutoff = messages.some((m) => m.dateAdded.getTime() < cutoffMs);
    if (!parsed.nextPage || !parsed.cursor || parsed.cursor === cursor || counted >= limit || reachedCutoff) break;
    cursor = parsed.cursor;
  }
  return { ok: true, value: collected };
}

/**
 * Every message of the contact's (up to 5) most recently active conversations, any type except
 * internal comments, oldest first. The window ends at `sinceDays` or right after the `limit`-th
 * counted message (activity entries inside the window come along without counting). One failed
 * page fails the whole read: a partial thread could hide a reply Isaac sent by hand.
 */
async function fetchThread(
  client: GhlClient,
  contactId: string,
  opts: ThreadOptions
): Promise<GhlResult<ThreadMessage[]>> {
  if (!isValidId(contactId)) return localFailure("invalid_id");
  const limit = Math.floor(opts.limit);
  if (!(limit > 0)) return { ok: true, value: [] };
  const days = Number.isFinite(opts.sinceDays) ? Math.max(0, opts.sinceDays) : 0;
  const cutoffMs = Date.now() - days * DAY_MS;

  const limitParam = String(CONVERSATION_SEARCH_LIMIT);
  const query = new URLSearchParams({ locationId: client.locationId, contactId, limit: limitParam });
  const path = `/conversations/search?${query}`;
  const search = await client.request({ method: "GET", path, version: CONVERSATIONS_API_VERSION });
  if (!isOk(search.status)) return failureOf(search);
  const conversations = readConversations(search.json, contactId);
  if (!conversations) return invalidResponse(search.status);

  const recent = conversations
    .filter((c) => c.lastMessageMs === null || c.lastMessageMs >= cutoffMs)
    .slice(0, MAX_CONVERSATIONS);
  const results = await Promise.all(recent.map((c) => fetchConversation(client, c.id, limit, cutoffMs)));
  const messages: ThreadMessage[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    messages.push(...result.value);
  }
  return { ok: true, value: windowThread(messages, limit, cutoffMs) };
}

/** `sent` needs a message id; anything else goes through {@link classifySendFailure}. */
async function postMessage(client: GhlClient, input: SendInput): Promise<SendOutcome> {
  if (!isValidId(input.contactId) || !SEND_CHANNELS.has(input.channel) || !input.text.trim()) {
    return { kind: "rejected", status: 0, reason: "invalid" };
  }
  const res = await client.request({
    method: "POST",
    path: "/conversations/messages",
    version: CONVERSATIONS_API_VERSION,
    body: { type: input.channel, contactId: input.contactId, message: input.text },
  });
  if (isOk(res.status) && isRecord(res.json)) {
    const messageId = str(res.json.messageId) ?? str(res.json.id);
    if (messageId) return { kind: "sent", messageId, conversationId: str(res.json.conversationId) };
  }
  return classifySendFailure(res.status, res.json);
}

// ─── Calendars ─────────────────────────────────────────────────────────────────────────────

type FreeSlotsInput = Parameters<GhlPort["getFreeSlots"]>[0];
type UserEventsInput = Parameters<GhlPort["listUserEvents"]>[0];
type CreateAppointmentInput = Parameters<GhlPort["createAppointment"]>[0];
type CreateAppointmentResult = Awaited<ReturnType<GhlPort["createAppointment"]>>;
type UpdateAppointmentInput = Parameters<GhlPort["updateAppointment"]>[0];

type MsRange = { start: number; end: number };

function msRange(startMs: number, endMs: number): MsRange | null {
  const start = Math.floor(startMs);
  const end = Math.floor(endMs);
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

/** ≤ 31-day pieces of the range; `endDate` is exclusive, so the pieces don't overlap. */
function slotChunks(range: MsRange): MsRange[] {
  const chunks: MsRange[] = [];
  let from = range.start;
  while (from < range.end && chunks.length < MAX_FREE_SLOT_CHUNKS) {
    const to = Math.min(range.end, from + FREE_SLOTS_MAX_RANGE_MS);
    chunks.push({ start: from, end: to });
    from = to;
  }
  return chunks;
}

async function fetchSlotChunk(
  client: GhlClient,
  input: FreeSlotsInput,
  userId: string | null,
  chunk: MsRange
): Promise<GhlResult<string[]>> {
  const query = new URLSearchParams({ startDate: String(chunk.start), endDate: String(chunk.end) });
  const timeZone = input.timeZone.trim();
  if (timeZone) query.set("timezone", timeZone);
  if (userId) query.set("userId", userId);
  const path = `/calendars/${seg(input.calendarId)}/free-slots?${query}`;
  const res = await client.request({ method: "GET", path, version: CALENDARS_API_VERSION });
  if (!isOk(res.status)) return failureOf(res);
  return isRecord(res.json) ? { ok: true, value: parseFreeSlots(res.json) } : invalidResponse(res.status);
}

async function fetchFreeSlots(client: GhlClient, input: FreeSlotsInput): Promise<GhlResult<string[]>> {
  const userId = str(input.userId);
  if (!isValidId(input.calendarId) || (userId !== null && !isValidId(userId))) return localFailure("invalid_id");
  const range = msRange(input.startMs, input.endMs);
  if (!range) return localFailure("invalid_range");
  const results = await Promise.all(slotChunks(range).map((chunk) => fetchSlotChunk(client, input, userId, chunk)));
  const inRange = (iso: string) => slotMs(iso) >= range.start && slotMs(iso) < range.end;
  const slots: string[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    slots.push(...result.value.filter(inRange));
  }
  return { ok: true, value: orderSlots(slots) };
}

/** Isaac's events across every calendar; GHL widens the range to whole days in the location's zone. */
async function fetchUserEvents(client: GhlClient, input: UserEventsInput): Promise<GhlResult<AppointmentRef[]>> {
  if (!isValidId(input.userId)) return localFailure("invalid_id");
  const range = msRange(input.startMs, input.endMs);
  if (!range) return localFailure("invalid_range");
  const query = new URLSearchParams({
    locationId: client.locationId,
    userId: input.userId,
    startTime: String(range.start),
    endTime: String(range.end),
  });
  const path = `/calendars/events?${query}`;
  const res = await client.request({ method: "GET", path, version: CALENDARS_API_VERSION });
  if (!isOk(res.status)) return failureOf(res);
  const items = readEventItems(res.json);
  if (!items) return invalidResponse(res.status);
  return { ok: true, value: parseEventItems(items).map((event) => event.ref).sort(byStart) };
}

/** GET /calendars/events/appointments/{id} → `{ event }`; null when GHL marks it deleted. */
async function fetchAppointment(client: GhlClient, eventId: string): Promise<GhlResult<AppointmentRef | null>> {
  const path = `/calendars/events/appointments/${seg(eventId)}`;
  const res = await client.request({ method: "GET", path, version: CALENDARS_API_VERSION });
  if (!isOk(res.status)) return failureOf(res);
  const event = unwrapAppointment(res.json);
  if (event?.deleted === true) return { ok: true, value: null };
  const parsed = readEvent(event);
  return parsed ? { ok: true, value: parsed.ref } : invalidResponse(res.status);
}

/**
 * The contacts endpoint documents zone-less times ("2021-07-16 11:00:00"). Those are re-read from
 * the calendars API, which states the offset, so matching a booking against an offered slot
 * (within a minute) holds. A transient read-back failure fails the call; a 4xx keeps the UTC read.
 */
async function resolveExactTimes(client: GhlClient, events: ParsedEvent[]): Promise<GhlResult<AppointmentRef[]>> {
  const naive = events
    .filter((event) => !event.exact)
    .sort((a, b) => byStart(b.ref, a.ref))
    .slice(0, MAX_APPOINTMENT_READBACKS);
  const reads = await Promise.all(naive.map((event) => fetchAppointment(client, event.ref.id)));
  const fresh = new Map<string, AppointmentRef | null>();
  for (const [index, read] of reads.entries()) {
    if (read.ok) fresh.set(naive[index].ref.id, read.value);
    else if (read.retryable) return read;
  }
  const refs: AppointmentRef[] = [];
  for (const { ref } of events) {
    const exact = fresh.get(ref.id);
    if (exact === null) continue;
    refs.push(exact ? mergeExactTime(ref, exact) : ref);
  }
  return { ok: true, value: refs.sort(byStart) };
}

async function fetchContactAppointments(client: GhlClient, contactId: string): Promise<GhlResult<AppointmentRef[]>> {
  if (!isValidId(contactId)) return localFailure("invalid_id");
  const path = `/contacts/${seg(contactId)}/appointments`;
  const res = await client.request({ method: "GET", path, version: CONTACTS_API_VERSION });
  if (!isOk(res.status)) return failureOf(res);
  const items = readEventItems(res.json);
  if (!items) return invalidResponse(res.status);
  return resolveExactTimes(client, parseEventItems(items));
}

/** `overrideLocationConfig` is what the docs pair with a bare `meetingLocationType`. */
function appointmentBody(locationId: string, input: CreateAppointmentInput): Json {
  return {
    calendarId: input.calendarId,
    locationId,
    contactId: input.contactId,
    startTime: input.startIso,
    ...(input.endIso ? { endTime: input.endIso } : {}),
    title: input.title,
    description: input.description,
    appointmentStatus: "confirmed",
    ...(input.assignedUserId ? { assignedUserId: input.assignedUserId } : {}),
    meetingLocationType: "phone",
    overrideLocationConfig: true,
    toNotify: true,
    ignoreFreeSlotValidation: false,
  };
}

/**
 * Books a confirmed phone appointment with GHL's free-slot validation on. A timeout (status 0) may
 * have booked it: check the contact's appointments before retrying.
 */
async function postAppointment(client: GhlClient, input: CreateAppointmentInput): Promise<CreateAppointmentResult> {
  const ids = [input.calendarId, input.contactId, ...(input.assignedUserId ? [input.assignedUserId] : [])];
  if (!ids.every(isValidId)) return { ...localFailure("invalid_id"), slotTaken: false };
  if (!toDate(input.startIso)) return { ...localFailure("invalid_time"), slotTaken: false };
  const body = appointmentBody(client.locationId, input);
  const path = "/calendars/events/appointments";
  const res = await client.request({ method: "POST", path, version: CALENDARS_API_VERSION, body });
  if (!isOk(res.status)) return { ...failureOf(res), slotTaken: isSlotTaken(res.status, res.json) };
  const ref = appointmentRefFrom(res.json, {
    id: null,
    calendarId: input.calendarId,
    contactId: input.contactId,
    startIso: input.startIso,
    endIso: input.endIso,
    status: "confirmed",
    title: input.title,
  });
  return ref ? { ok: true, value: ref } : { ...invalidResponse(res.status), slotTaken: false };
}

/** Always sends `appointmentStatus` (GHL resets it to the calendar default when only the time changes). */
async function putAppointment(client: GhlClient, input: UpdateAppointmentInput): Promise<GhlResult<AppointmentRef>> {
  if (!isValidId(input.appointmentId)) return localFailure("invalid_id");
  if (input.startIso !== undefined && !toDate(input.startIso)) return localFailure("invalid_time");
  const body: Json = {
    appointmentStatus: input.status,
    ...(input.startIso ? { startTime: input.startIso } : {}),
    ...(input.endIso ? { endTime: input.endIso } : {}),
    toNotify: true,
  };
  const path = `/calendars/events/appointments/${seg(input.appointmentId)}`;
  const res = await client.request({ method: "PUT", path, version: CALENDARS_API_VERSION, body });
  if (!isOk(res.status)) return failureOf(res);
  const ref = appointmentRefFrom(res.json, {
    id: input.appointmentId,
    calendarId: "",
    contactId: null,
    startIso: input.startIso ?? null,
    endIso: input.endIso ?? null,
    status: input.status,
    title: null,
  });
  if (ref) return { ok: true, value: ref };
  const readBack = await fetchAppointment(client, input.appointmentId);
  return readBack.ok && readBack.value ? { ok: true, value: readBack.value } : invalidResponse(res.status);
}

// ─── Contact writes ────────────────────────────────────────────────────────────────────────

/** Only `dndSettings`, with the 2021-07-28 channel keys; `inboundDndSettings` and other fields are never sent. */
async function putDnd(client: GhlClient, contactId: string, channels: DndChannel[]): Promise<boolean> {
  const selected = DND_CHANNELS.filter((channel) => channels.includes(channel));
  if (selected.length === 0) return true;
  if (!isValidId(contactId)) return false;
  const dndSettings = Object.fromEntries(selected.map((channel) => [channel, { ...DND_SETTING }]));
  const path = `/contacts/${seg(contactId)}`;
  const res = await client.request({ method: "PUT", path, version: CONTACTS_API_VERSION, body: { dndSettings } });
  return isOk(res.status);
}

async function changeTags(
  client: GhlClient,
  method: "POST" | "DELETE",
  contactId: string,
  tags: string[]
): Promise<boolean> {
  const clean = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (clean.length === 0) return true;
  if (!isValidId(contactId)) return false;
  const path = `/contacts/${seg(contactId)}/tags`;
  const res = await client.request({ method, path, version: CONTACTS_API_VERSION, body: { tags: clean } });
  return isOk(res.status);
}

/** Plain text: GHL notes don't render Markdown. */
async function postNote(client: GhlClient, contactId: string, text: string): Promise<boolean> {
  if (!isValidId(contactId) || !text.trim()) return false;
  const path = `/contacts/${seg(contactId)}/notes`;
  const res = await client.request({ method: "POST", path, version: CONTACTS_API_VERSION, body: { body: text } });
  return isOk(res.status);
}

// ─── Port ──────────────────────────────────────────────────────────────────────────────────

/**
 * The AI Setter's `GhlPort` over the GHL REST API. Never throws: reads resolve to `GhlResult`
 * (`retryable` for no answer, 429 and 5xx), sends to `SendOutcome`, and tag / note / DND writes to
 * a boolean. Reads time out after `timeoutMs` (15 s), writes after `writeTimeoutMs` (20 s).
 */
export function createAiSetterGhlPort(options: AiSetterGhlPortOptions): GhlPort {
  const client = createClient(options);
  return {
    getContact: (contactId) => fetchContact(client, contactId),
    listMessages: (contactId, opts) => fetchThread(client, contactId, opts),
    sendMessage: (input) => postMessage(client, input),
    getFreeSlots: (input) => fetchFreeSlots(client, input),
    listUserEvents: (input) => fetchUserEvents(client, input),
    listContactAppointments: (contactId) => fetchContactAppointments(client, contactId),
    createAppointment: (input) => postAppointment(client, input),
    updateAppointment: (input) => putAppointment(client, input),
    setDnd: (contactId, channels) => putDnd(client, contactId, channels),
    addTags: (contactId, tags) => changeTags(client, "POST", contactId, tags),
    removeTags: (contactId, tags) => changeTags(client, "DELETE", contactId, tags),
    addNote: (contactId, body) => postNote(client, contactId, body),
  };
}
