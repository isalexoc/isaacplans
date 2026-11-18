/**
 * Minimal Telegram Bot API client. No SDK — a handful of POSTs.
 *
 * SAFETY RULE, deliberately enforced by the type signature: no function here accepts a
 * `business_connection_id`. Passing one would make the bot send AS Isaac into whatever chat is
 * targeted — i.e. a notification meant for him could land in the provider's DM. Every send in this
 * module is an ordinary bot → user message in the bot's own chat.
 */

import type { TelegramLeadsConfig } from "@/lib/telegram/config";

const API_BASE = "https://api.telegram.org";

/** Bot API limits: message text (with headroom under 4096), callback data, toast text. */
const MAX_MESSAGE_CHARS = 4000;
const MAX_CALLBACK_DATA_BYTES = 64;
const MAX_TOAST_CHARS = 200;
const MAX_BUTTON_LABEL_CHARS = 64;

/** The button helpers run inside webhooks and queue jobs; a hung Bot API call must not hold them. */
const BUTTON_CALL_TIMEOUT_MS = 8_000;

async function telegramApi<T>(
  method: string,
  params: Record<string, unknown>,
  config: TelegramLeadsConfig,
  timeoutMs?: number
): Promise<T | null> {
  if (!config.botToken) return null;
  try {
    const res = await fetch(`${API_BASE}/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      console.warn("[TELEGRAM_LEADS] Bot API call failed", {
        method,
        status: res.status,
        description: data?.description,
      });
      return null;
    }
    return data.result as T;
  } catch (err) {
    console.warn("[TELEGRAM_LEADS] Bot API call threw", { method, error: String(err) });
    return null;
  }
}

/** Plain bot → user message. Never business-scoped; see the safety rule above. */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  config: TelegramLeadsConfig
): Promise<boolean> {
  const result = await telegramApi<unknown>(
    "sendMessage",
    {
      chat_id: chatId,
      text: text.slice(0, 4000),
      disable_web_page_preview: true,
    },
    config
  );
  return result !== null;
}

/**
 * One inline-keyboard button: `callbackData` (comes back as a `callback_query`, at most 64 bytes)
 * or a public `url`. When both are set, `callbackData` wins.
 */
export type TelegramButton = { text: string; callbackData?: string; url?: string };

type InlineKeyboardButton = { text: string; callback_data: string } | { text: string; url: string };

/** Cut to `max` UTF-16 units without splitting an emoji (a lone surrogate is invalid UTF-8). */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

/** Telegram refuses the WHOLE message over one URL it dislikes, e.g. http://localhost in dev. */
function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && /\.[a-z]{2,}$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function toInlineButton(button: TelegramButton): InlineKeyboardButton | null {
  const text = clip(button.text.trim(), MAX_BUTTON_LABEL_CHARS);
  if (!text) return null;
  if (button.callbackData !== undefined) {
    // Dropped, never truncated: a shortened callback_data would name a different action or id.
    const bytes = new TextEncoder().encode(button.callbackData).length;
    return bytes > 0 && bytes <= MAX_CALLBACK_DATA_BYTES ? { text, callback_data: button.callbackData } : null;
  }
  return button.url && isPublicUrl(button.url) ? { text, url: button.url } : null;
}

/** Buttons Telegram would reject are dropped (and so are rows left empty) instead of failing the send. */
function toInlineKeyboard(rows: TelegramButton[][]): InlineKeyboardButton[][] {
  return rows
    .map((row) => row.map(toInlineButton).filter((b): b is InlineKeyboardButton => b !== null))
    .filter((row) => row.length > 0);
}

function messageIdOf(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const id = (result as { message_id?: unknown }).message_id;
  return typeof id === "number" && Number.isSafeInteger(id) ? String(id) : null;
}

/**
 * Bot → user message with an inline keyboard, one inner array per row. `messageId` is what
 * `editTelegramMessageText` needs later. Never business-scoped; see the safety rule above.
 */
export async function sendTelegramMessageWithButtons(
  chatId: string,
  text: string,
  rows: TelegramButton[][],
  config: TelegramLeadsConfig
): Promise<{ ok: boolean; messageId: string | null }> {
  const keyboard = toInlineKeyboard(rows);
  const result = await telegramApi<unknown>(
    "sendMessage",
    {
      chat_id: chatId,
      text: clip(text, MAX_MESSAGE_CHARS),
      disable_web_page_preview: true,
      ...(keyboard.length > 0 ? { reply_markup: { inline_keyboard: keyboard } } : {}),
    },
    config,
    BUTTON_CALL_TIMEOUT_MS
  );
  if (result === null) return { ok: false, messageId: null };
  return { ok: true, messageId: messageIdOf(result) };
}

/**
 * Answers a button press: stops the button's spinner and shows `text` as a toast (Telegram caps it
 * at 200 characters). Every callback_query should be answered, even a refused one.
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  text: string,
  config: TelegramLeadsConfig
): Promise<boolean> {
  const result = await telegramApi<unknown>(
    "answerCallbackQuery",
    { callback_query_id: callbackQueryId, text: clip(text, MAX_TOAST_CHARS) },
    config,
    BUTTON_CALL_TIMEOUT_MS
  );
  return result !== null;
}

/**
 * Replaces the text of a message the bot sent. No `reply_markup` is passed, which removes the
 * inline keyboard, so a card that was acted on can't be tapped again.
 */
export async function editTelegramMessageText(
  chatId: string,
  messageId: string,
  text: string,
  config: TelegramLeadsConfig
): Promise<boolean> {
  const body = clip(text.trim(), MAX_MESSAGE_CHARS);
  if (!/^\d{1,15}$/.test(messageId) || !body) return false;
  const result = await telegramApi<unknown>(
    "editMessageText",
    { chat_id: chatId, message_id: Number(messageId), text: body, disable_web_page_preview: true },
    config,
    BUTTON_CALL_TIMEOUT_MS
  );
  return result !== null;
}

export type TelegramWebhookInfo = {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  allowed_updates?: string[];
  max_connections?: number;
};

export async function getWebhookInfo(
  config: TelegramLeadsConfig
): Promise<TelegramWebhookInfo | null> {
  return telegramApi<TelegramWebhookInfo>("getWebhookInfo", {}, config);
}

/**
 * `allowed_updates` MUST name the business_* types explicitly — they are not in Telegram's default
 * set, so omitting them means the DMs we exist to read never arrive.
 *
 * `callback_query` carries the button presses on the AI Setter cards (lib/ai-setter/notify.ts).
 */
export const TELEGRAM_ALLOWED_UPDATES = [
  "message",
  "business_connection",
  "business_message",
  "edited_business_message",
  "deleted_business_messages",
  // Isaac must re-run "pnpm telegram:webhook --set" after deploy so Telegram starts sending button presses.
  "callback_query",
] as const;

export async function setWebhook(
  url: string,
  secretToken: string,
  config: TelegramLeadsConfig
): Promise<boolean> {
  const result = await telegramApi<unknown>(
    "setWebhook",
    {
      url,
      secret_token: secretToken,
      allowed_updates: TELEGRAM_ALLOWED_UPDATES,
      drop_pending_updates: false,
    },
    config
  );
  return result !== null;
}
