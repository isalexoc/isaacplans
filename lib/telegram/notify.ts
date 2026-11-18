/**
 * Alerts for the Telegram lead pipeline.
 *
 * Primary channel is the bot DMing Isaac — no new email plumbing, and it lands on the phone he is
 * already holding. The target is TELEGRAM_ADMIN_CHAT_ID; while that is unset, the chat learned
 * during setup (the first `/start` DM or business connection, see `rememberAdminChatId`). The AI
 * Setter's cards never use a learned chat: lib/ai-setter/notify.ts sends to the env value only.
 *
 * Never throws: an alert failing must not fail a lead sync.
 */

import { sendTelegramMessage } from "@/lib/telegram/api";
import type { TelegramLeadsConfig } from "@/lib/telegram/config";
import type { TelegramLogger } from "@/lib/telegram/log";
import { getTelegramSetting, setTelegramSetting } from "@/lib/telegram/settings";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.isaacplans.com";
const REVIEW_URL = `${SITE_URL}/en/admin/telegram-leads`;

export type TelegramNotifyEvent =
  | { kind: "needs_review"; leadKey: string; reason: string | null; preview?: string }
  | { kind: "crm_failed"; leadKey: string; error: string }
  | { kind: "unknown_chat"; chatId: string }
  | { kind: "connection_lost" }
  | { kind: "reconcile_summary"; found: number; processed: number };

/**
 * Resolve the chat for the Telegram-leads alerts: the env value TELEGRAM_ADMIN_CHAT_ID wins, then
 * the learned id. Never use it to authorize anything: a learned chat is first come, first served
 * during setup. The AI Setter's cards and button presses trust `config.adminChatId` alone.
 */
export async function resolveAdminChatId(config: TelegramLeadsConfig): Promise<string | null> {
  if (config.adminChatId) return config.adminChatId;
  const learned = await getTelegramSetting("admin_chat_id");
  return learned || null;
}

/**
 * Remember Isaac's chat from a `/start` DM or a `business_connection` update's `user_chat_id`.
 * Neither is trusted by itself: anyone can DM the bot, and any Telegram Premium user can connect
 * it as a business bot to THEIR account (the update then names THEIR chat).
 * - TELEGRAM_ADMIN_CHAT_ID set (`envAdminChatId`): only that chat counts, and it replaces any
 *   learned one; any other chat changes nothing.
 * - Unset: first come, first served during setup. The first chat is stored; afterwards only that
 *   one counts.
 * Returns whether `chatId` is (now) the admin chat.
 */
export async function rememberAdminChatId(
  chatId: string,
  opts: { envAdminChatId: string | null }
): Promise<boolean> {
  if (opts.envAdminChatId) {
    if (opts.envAdminChatId !== chatId) return false;
    await setTelegramSetting("admin_chat_id", chatId);
    return true;
  }
  const learned = await getTelegramSetting("admin_chat_id");
  if (learned) return learned === chatId;
  await setTelegramSetting("admin_chat_id", chatId);
  return true;
}

function renderEvent(event: TelegramNotifyEvent): string {
  switch (event.kind) {
    case "needs_review":
      return [
        "⚠️ A lead needs review",
        event.reason ? `Reason: ${event.reason}` : "",
        event.preview ? `\n${event.preview.slice(0, 500)}` : "",
        `\n${REVIEW_URL}`,
      ]
        .filter(Boolean)
        .join("\n");
    case "crm_failed":
      return `❌ A lead failed to reach the CRM after repeated attempts.\nLead: ${event.leadKey}\n${event.error}\n\n${REVIEW_URL}`;
    case "unknown_chat":
      // Metadata only — never the message content. This chat is not allowlisted, so we have
      // deliberately not stored what it said.
      return `ℹ️ A message arrived from a chat that is not on the allowlist.\nChat id: ${event.chatId}\n\nIf this is the lead provider, add the id to TELEGRAM_ALLOWED_CHAT_IDS.`;
    case "connection_lost":
      return "🔌 The Telegram business connection was disabled. Leads will stop arriving until it is reconnected in Settings → Telegram Business → Chatbots.";
    case "reconcile_summary":
      return `🧹 Daily reconcile drained stuck Telegram leads.\nFound: ${event.found}, processed: ${event.processed}\n\n${REVIEW_URL}`;
  }
}

/** Rate-limit noisy events to once per key per day. */
async function shouldSuppress(key: string): Promise<boolean> {
  const last = await getTelegramSetting(key);
  if (!last) return false;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return false;
  return Date.now() - lastMs < 24 * 60 * 60 * 1000;
}

export async function notifyTelegramLeadEvent(
  event: TelegramNotifyEvent,
  config: TelegramLeadsConfig,
  log: TelegramLogger
): Promise<void> {
  try {
    if (event.kind === "unknown_chat") {
      const key = `notified_unknown_chat_${event.chatId}`;
      if (await shouldSuppress(key)) return;
      await setTelegramSetting(key, new Date().toISOString());
    }

    const chatId = await resolveAdminChatId(config);
    if (!chatId) {
      log.warn("No admin chat id yet — alert not delivered", { event: event.kind });
      return;
    }

    const sent = await sendTelegramMessage(chatId, renderEvent(event), config);
    if (!sent) {
      log.warn("Alert send failed", { event: event.kind, chatId });
    }
  } catch (err) {
    log.warn("notifyTelegramLeadEvent threw (non-fatal)", { error: String(err) });
  }
}
