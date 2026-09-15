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

async function telegramApi<T>(
  method: string,
  params: Record<string, unknown>,
  config: TelegramLeadsConfig
): Promise<T | null> {
  if (!config.botToken) return null;
  try {
    const res = await fetch(`${API_BASE}/bot${config.botToken}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
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
 */
export const TELEGRAM_ALLOWED_UPDATES = [
  "message",
  "business_connection",
  "business_message",
  "edited_business_message",
  "deleted_business_messages",
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
