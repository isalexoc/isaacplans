/**
 * Alerts to Isaac for the AI Setter.
 *
 * Primary channel: a Telegram card with buttons, sent by the bot the Telegram-leads feature
 * already runs (same token) to TELEGRAM_ADMIN_CHAT_ID and nowhere else. Never to a chat the bot
 * learned (a `/start` DM, a business connection): anyone can DM the bot, and any Telegram Premium
 * user can connect it as a business bot to THEIR account, which would hand them the cards and
 * their buttons. A tap comes back as a `callback_query` → app/api/webhooks/telegram/route.ts
 * (presses from that same env chat only) → `handleAiSetterTelegramCallback` (actions.ts).
 *
 * Fallback, when Telegram isn't configured or the send fails: remove and re-add AI_ALERT_TAG on
 * the contact, so Isaac's GHL workflow "AI Setter – Aviso" (Tag added → internal notification)
 * fires. Not with `allowTagFallback: false` (shadow mode): that workflow is real, so an alert
 * Telegram didn't carry is only logged. Events without a contact are only logged.
 *
 * Spanish (Isaac reads Spanish) and PII-minimal: first name, product, state and the lead's local
 * time. Never the lead's message text, phone or email; a draft card quotes the AI's own draft (our
 * outbound words), so Isaac reads what [Enviar] sends. `notify` never throws.
 */

import "server-only";

import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { sendTelegramMessageWithButtons, type TelegramButton } from "@/lib/telegram/api";
import { getTelegramLeadsConfig, type TelegramLeadsConfig } from "@/lib/telegram/config";
import { getTelegramSetting, setTelegramSetting } from "@/lib/telegram/settings";
import { localCalendarDateKey } from "@/lib/timezone";

import { AI_ALERT_TAG, getAiSetterConfig } from "./config";
import { createAiSetterLogger } from "./log";
import { PRODUCT_LABELS } from "./product";
import type { AiSetterLogger, GhlPort, HandoffReason, NotifyEvent, NotifyPort, ProductLine } from "./types";

/** Same day bucket as the daily budget (turn.ts). */
const AGENT_TZ = "America/New_York";
const PANEL_PATH = "/es/admin/ai-setter";
/** Ids actions.ts accepts, capped so "ais:x:<id>" stays inside Telegram's 64-byte callback_data. */
const CALLBACK_ID = /^[A-Za-z0-9_-]{6,58}$/;
const MAX_REMEMBERED_DRAFTS = 500;
/** The draft quoted on its card (NotifyEvent caps it at 500 too). */
const MAX_PREVIEW_CHARS = 500;

/** Drafts this process already sent a card for (one card per draft). */
const alertedDrafts = new Set<string>();
/** "TELEGRAM_ADMIN_CHAT_ID not set" is logged once per process, not on every alert. */
let warnedNoAdminChat = false;

const HANDOFF_LABELS: Record<HandoffReason, string> = {
  asked_for_person: "pidió hablar con una persona",
  pricing_detail: "pregunta de precios",
  health: "tema de salud",
  medicare: "Medicare",
  existing_client: "es cliente",
  complaint: "queja",
  legal: "tema legal",
  confused: "no se entiende",
  media: "mandó audio o foto",
  stale_message: "mensaje viejo",
  model_refused: "la IA no pudo responder",
  guard_failed: "la IA no pasó la revisión",
  other: "otro",
};

type TagPort = Pick<GhlPort, "addTags" | "removeTags">;
type Alert = { text: string; rows: TelegramButton[][] };
type Links = { panel: (messageId?: string) => string; crm: (contactId: string) => string | null };
/** How the Telegram card went (a log value). */
type TelegramStatus = "sent" | "not_configured" | "no_admin_chat" | "send_failed";
type TelegramTarget =
  | { ok: true; config: TelegramLeadsConfig; chatId: string }
  | { ok: false; status: Extract<TelegramStatus, "not_configured" | "no_admin_chat"> };
/** What delivery needs besides the event; fixed per notifier. */
type Delivery = {
  log: AiSetterLogger;
  /** Only for the CRM alert-tag fallback. */
  ghl: TagPort | null;
  /** False in shadow mode: the alert tag is never toggled (it fires a real GHL workflow). */
  allowTagFallback: boolean;
};
type CallbackOp = "a" | "t" | "c" | "n";

// ─── Text ──────────────────────────────────────────────────────────────────────────────────

/** Cut to `max` UTF-16 units without splitting an emoji (a lone surrogate is invalid UTF-8). */
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const last = head.charCodeAt(head.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? head.slice(0, -1) : head;
}

/** Collapse whitespace, trim and cut to `max` UTF-16 units without splitting an emoji. */
function fit(text: string, max: number): string {
  return cut(text.replace(/\s+/g, " ").trim(), max).trim();
}

/**
 * The name is typed by the lead and lands in Isaac's chat: letters only (a phone, an email or a
 * link typed into the name field never gets through), first two words, 30 characters at most.
 */
function cleanFirstName(value: string | null): string | null {
  if (!value || value.includes("@")) return null;
  const words = value
    .replace(/[^\p{L}\p{M}'’-]+/gu, " ")
    .split(" ")
    .filter((w) => /\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return fit(words.join(" "), 30) || null;
}

/** "tx" → "TX"; a full state name keeps its letters. */
function cleanState(value: string | null): string | null {
  if (!value) return null;
  const letters = fit(value.replace(/[^\p{L}\p{M}]+/gu, " "), 20);
  if (!letters) return null;
  return letters.length === 2 ? letters.toUpperCase() : letters;
}

function productLabel(product: ProductLine | null): string | null {
  const label = product ? PRODUCT_LABELS[product] : undefined;
  return label ? label.es : null;
}

function nameOr(firstName: string | null, fallback: string): string {
  return cleanFirstName(firstName) ?? fallback;
}

/** " (IUL, TX; son las 3:15 p. m. para el lead)" from whatever is known; "" when nothing is. */
function parenthetical(parts: Array<string | null>, tail = ""): string {
  const known = parts.filter((p): p is string => Boolean(p)).join(", ");
  const inner = [known, tail].filter(Boolean).join("; ");
  return inner ? ` (${inner})` : "";
}

/** One o'clock is singular in Spanish: "es la 1:05", "son las 3:15". */
const ONE_OCLOCK = /^1(?!\d)/;

function leadTimePhrase(leadLocalTime: string): string {
  const t = fit(leadLocalTime, 40);
  if (!t) return "";
  return `${ONE_OCLOCK.test(t) ? "es la" : "son las"} ${t} para el lead`;
}

/** `sendsAt` is "ahora" (or "now") or a time in the lead's zone. */
function sendsAtPhrase(sendsAt: string): string {
  const t = fit(sendsAt, 40);
  if (!t || /^(ahora|now)$/i.test(t)) return "Sale ahora";
  if (!/^\d/.test(t)) return `Sale ${t}`;
  return `Sale ${ONE_OCLOCK.test(t) ? "a la" : "a las"} ${t} (hora del lead)`;
}

/**
 * The draft as [Enviar] sends it, line breaks kept, at most MAX_PREVIEW_CHARS. Control and bidi
 * characters are dropped: they are invisible, and a bidi override could make the card read
 * differently from the text that goes out. Null when there is nothing to show (template drafts).
 */
function draftPreview(preview: string | null): string | null {
  if (!preview) return null;
  const text = preview
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\p{Bidi_Control}/gu, "")
    .replace(/\p{Cc}/gu, (c) => (c === "\n" ? c : ""))
    .trim();
  if (text.length <= MAX_PREVIEW_CHARS) return text || null;
  return `${cut(text, MAX_PREVIEW_CHARS - 1).trimEnd()}…`;
}

// ─── Buttons ───────────────────────────────────────────────────────────────────────────────

function buildLinks(): Links {
  const { siteUrl, locationId } = getAiSetterConfig();
  const panel = `${siteUrl}${PANEL_PATH}`;
  return {
    panel: (messageId) => (messageId ? `${panel}?m=${encodeURIComponent(messageId)}` : panel),
    crm: (contactId) => (locationId ? agentCrmContactUrl(locationId, contactId) : null),
  };
}

/** A callback button, or none when the id doesn't have the shape actions.ts accepts. */
function actionButton(text: string, op: CallbackOp, id: string): TelegramButton[] {
  return CALLBACK_ID.test(id) ? [{ text, callbackData: `ais:${op}:${id}` }] : [];
}

function crmButton(contactId: string, links: Links): TelegramButton[] {
  const url = links.crm(contactId);
  return url ? [{ text: "Abrir en CRM", url }] : [];
}

function panelButton(links: Links, text = "Abrir panel", messageId?: string): TelegramButton[] {
  return [{ text, url: links.panel(messageId) }];
}

function keyboard(...rows: TelegramButton[][]): TelegramButton[][] {
  return rows.filter((row) => row.length > 0);
}

function contactRows(contactId: string, links: Links): TelegramButton[][] {
  return keyboard(crmButton(contactId, links), panelButton(links));
}

// ─── Cards ─────────────────────────────────────────────────────────────────────────────────

function renderDraft(event: Extract<NotifyEvent, { kind: "draft_ready" }>, links: Links): Alert {
  const facts = parenthetical([productLabel(event.product), cleanState(event.state)]);
  const header = `📝 Borrador para ${nameOr(event.firstName, "un lead")}${facts}. ${sendsAtPhrase(event.sendsAt)} si lo apruebas.`;
  const preview = draftPreview(event.preview);
  return {
    text: preview ? `${header}\n\n"${preview}"` : header,
    rows: keyboard(
      actionButton("✅ Enviar", "a", event.messageId),
      actionButton("🙋 Lo tomo yo", "t", event.contactId),
      panelButton(links, "✏️ Abrir", event.messageId)
    ),
  };
}

function renderCallNow(event: Extract<NotifyEvent, { kind: "call_now" }>, links: Links): Alert {
  const facts = parenthetical(
    [productLabel(event.product), cleanState(event.state)],
    leadTimePhrase(event.leadLocalTime)
  );
  return {
    text: `📞 ${nameOr(event.firstName, "Un lead")} quiere hablar AHORA${facts}.`,
    rows: keyboard(
      [
        ...actionButton("📞 Estoy llamando", "c", event.contactId),
        ...actionButton("⏰ No puedo", "n", event.contactId),
      ],
      crmButton(event.contactId, links)
    ),
  };
}

function renderHandoff(event: Extract<NotifyEvent, { kind: "handoff" }>, links: Links): Alert {
  const facts = parenthetical([productLabel(event.product), cleanState(event.state)]);
  const reason = HANDOFF_LABELS[event.reason] ?? HANDOFF_LABELS.other;
  const urgent = event.urgent ? "⚠️ URGENTE: " : "";
  return {
    text: `${urgent}🙋 ${nameOr(event.firstName, "Un lead")}${facts} necesita a Isaac: ${reason}`,
    rows: contactRows(event.contactId, links),
  };
}

function renderBooked(event: Extract<NotifyEvent, { kind: "booked" }>, links: Links): Alert {
  const when = fit(event.whenLabel, 80);
  const facts = parenthetical([productLabel(event.product)]);
  return {
    text: `📅 Cita agendada: ${nameOr(event.firstName, "un lead")}${facts}${when ? ` — ${when}` : ""}`,
    rows: keyboard(crmButton(event.contactId, links)),
  };
}

/**
 * `aiManaged` false: the contact isn't the AI's (not enrolled, or excluded), so the app only put
 * the number on its own suppression list; whether the CRM sets DND is Isaac's call.
 */
function renderOptedOut(event: Extract<NotifyEvent, { kind: "opted_out" }>, links: Links): Alert {
  const name = nameOr(event.firstName, "Un lead");
  return {
    text: event.aiManaged
      ? `🚫 ${name} se dio de baja: la IA no le vuelve a escribir`
      : `🚫 ${name} pidió no recibir mensajes. La IA no maneja este contacto: revisa el DND en el CRM.`,
    rows: keyboard(crmButton(event.contactId, links)),
  };
}

function renderAlert(event: NotifyEvent, links: Links): Alert {
  switch (event.kind) {
    case "draft_ready":
      return renderDraft(event, links);
    case "call_now":
      return renderCallNow(event, links);
    case "handoff":
      return renderHandoff(event, links);
    case "booked":
      return renderBooked(event, links);
    case "opted_out":
      return renderOptedOut(event, links);
    case "optout_ambiguous":
      return {
        text: `❓ Baja ambigua de ${nameOr(event.firstName, "un lead")}: la IA congeló el contacto y pidió aclaración`,
        rows: contactRows(event.contactId, links),
      };
    case "loop_paused":
      return {
        text: `🔁 La IA pausó a ${nameOr(event.firstName, "un lead")}: parece una autorespuesta o un bucle`,
        rows: contactRows(event.contactId, links),
      };
    case "budget":
      return { text: `💸 Presupuesto diario de la IA al ${event.percent}%`, rows: keyboard(panelButton(links)) };
    case "error":
      return { text: `⚠️ AI Setter: ${fit(event.detail, 500)}`, rows: keyboard(panelButton(links)) };
  }
}

// ─── Delivery ──────────────────────────────────────────────────────────────────────────────

/**
 * TELEGRAM_ADMIN_CHAT_ID, never a learned chat (see the header). Without it the alert skips
 * Telegram; the first time that happens it is logged.
 */
function telegramTarget(log: AiSetterLogger): TelegramTarget {
  const config = getTelegramLeadsConfig();
  if (!config.botToken) return { ok: false, status: "not_configured" };
  if (!config.adminChatId) {
    if (!warnedNoAdminChat) {
      warnedNoAdminChat = true;
      log.warn("TELEGRAM_ADMIN_CHAT_ID not set", { effect: "AI Setter alerts skip Telegram" });
    }
    return { ok: false, status: "no_admin_chat" };
  }
  return { ok: true, config, chatId: config.adminChatId };
}

async function sendTelegramCard(event: NotifyEvent, log: AiSetterLogger): Promise<TelegramStatus> {
  const target = telegramTarget(log);
  if (!target.ok) return target.status;
  const alert = renderAlert(event, buildLinks());
  const sent = await sendTelegramMessageWithButtons(target.chatId, alert.text, alert.rows, target.config);
  return sent.ok ? "sent" : "send_failed";
}

async function settle(task: () => Promise<boolean>): Promise<boolean> {
  try {
    return await task();
  } catch {
    return false;
  }
}

/** Remove, then add: GHL fires "Tag added" only when the tag wasn't already on the contact. */
async function toggleAlertTag(ghl: TagPort, contactId: string): Promise<boolean> {
  await settle(() => ghl.removeTags(contactId, [AI_ALERT_TAG]));
  return settle(() => ghl.addTags(contactId, [AI_ALERT_TAG]));
}

/**
 * Telegram first; then the CRM tag when the event names a contact and the tag fallback is
 * allowed. True = Isaac was reached.
 */
async function deliver(event: NotifyEvent, delivery: Delivery): Promise<boolean> {
  const { log, ghl, allowTagFallback } = delivery;
  const telegram = await sendTelegramCard(event, log);
  if (telegram === "sent") {
    log.info("Alert sent", { kind: event.kind, via: "telegram" });
    return true;
  }
  const contactId = "contactId" in event ? event.contactId : null;
  if (contactId && ghl && allowTagFallback) {
    const tagged = await toggleAlertTag(ghl, contactId);
    log.warn("Telegram alert not delivered; toggled the CRM alert tag", { kind: event.kind, contactId, telegram, tagged });
    return tagged;
  }
  // `detail` is PII-free by contract; keep it, since nothing else records this alert.
  const detail = event.kind === "error" ? { detail: fit(event.detail, 200) } : {};
  const fallback = allowTagFallback ? {} : { tagFallback: "off" };
  log.warn("Alert not delivered", { kind: event.kind, telegram, ...fallback, ...detail });
  return false;
}

function rememberDraft(messageId: string): void {
  alertedDrafts.add(messageId);
  if (alertedDrafts.size <= MAX_REMEMBERED_DRAFTS) return;
  const oldest = alertedDrafts.values().next();
  if (!oldest.done) alertedDrafts.delete(oldest.value);
}

function budgetKey(percent: number, now: Date): string {
  return `ai_setter_budget_${localCalendarDateKey(now, AGENT_TZ)}_${percent}`;
}

/**
 * De-duplication: a draft gets one card per process, and each budget threshold one alert per day
 * (turn.ts reports 100% on every refused turn). Null = already alerted. Otherwise the returned
 * function frees the claim, so an alert that reached nobody can go out on the next try.
 */
async function claim(event: NotifyEvent): Promise<(() => Promise<void>) | null> {
  if (event.kind === "draft_ready") {
    const id = event.messageId;
    if (alertedDrafts.has(id)) return null;
    rememberDraft(id);
    return async () => {
      alertedDrafts.delete(id);
    };
  }
  if (event.kind === "budget") {
    const key = budgetKey(event.percent, new Date());
    if (await getTelegramSetting(key)) return null;
    await setTelegramSetting(key, new Date().toISOString());
    return () => setTelegramSetting(key, "");
  }
  return async () => {};
}

async function notifyOnce(event: NotifyEvent, delivery: Delivery): Promise<void> {
  const release = await claim(event);
  if (!release) {
    delivery.log.debug("Alert already sent; skipped", { kind: event.kind });
    return;
  }
  let delivered = false;
  try {
    delivered = await deliver(event, delivery);
  } finally {
    if (!delivered) await release();
  }
}

/**
 * The AI Setter's NotifyPort: a Telegram card to TELEGRAM_ADMIN_CHAT_ID first, the CRM alert tag
 * as fallback. `ghl` is only used for that fallback; without it, an undelivered alert is logged.
 * `allowTagFallback` (default true) false is for shadow mode: the tag fires a real GHL workflow,
 * so it is never toggled; Telegram only, else the alert is logged.
 */
export function createAiSetterNotifier(deps?: {
  log?: AiSetterLogger;
  ghl?: Pick<GhlPort, "addTags" | "removeTags">;
  allowTagFallback?: boolean;
}): NotifyPort {
  const log = deps?.log ?? createAiSetterLogger(getAiSetterConfig().debug);
  const delivery: Delivery = { log, ghl: deps?.ghl ?? null, allowTagFallback: deps?.allowTagFallback ?? true };
  return {
    async notify(event) {
      try {
        await notifyOnce(event, delivery);
      } catch (err) {
        log.warn("Alert threw (non-fatal)", { kind: event.kind, error: err instanceof Error ? err.name : "unknown" });
      }
    },
  };
}
