/**
 * Register (or inspect) the Telegram webhook.
 *
 *   pnpm telegram:webhook          show the current webhook status
 *   pnpm telegram:webhook --set    point Telegram at this deployment
 *
 * `allowed_updates` MUST name the business_* types explicitly — they are not in Telegram's default
 * set, so omitting them is the single most likely way to end up with a bot that receives nothing.
 */

import "dotenv/config";
import { getTelegramLeadsConfig } from "../lib/telegram/config";
import { TELEGRAM_ALLOWED_UPDATES, getWebhookInfo, setWebhook } from "../lib/telegram/api";

const SITE_URL =
  process.env.TELEGRAM_WEBHOOK_URL?.trim() ||
  `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com").replace(/\/$/, "")}/api/webhooks/telegram`;

async function main() {
  const config = getTelegramLeadsConfig();

  if (!config.botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set.");
    process.exit(1);
  }
  if (!config.webhookSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not set.");
    process.exit(1);
  }

  if (process.argv.includes("--set")) {
    console.log(`Pointing Telegram at: ${SITE_URL}`);
    console.log(`allowed_updates: ${TELEGRAM_ALLOWED_UPDATES.join(", ")}`);
    const ok = await setWebhook(SITE_URL, config.webhookSecret, config);
    console.log(ok ? "\nWebhook set.\n" : "\nsetWebhook FAILED — see the warning above.\n");
    if (!ok) process.exit(1);
  }

  const info = await getWebhookInfo(config);
  if (!info) {
    console.error("Could not read webhook info.");
    process.exit(1);
  }

  console.log("Current webhook");
  console.log("---------------");
  console.log(`  url:                  ${info.url || "(none)"}`);
  console.log(`  pending updates:      ${info.pending_update_count ?? 0}`);
  console.log(`  allowed_updates:      ${info.allowed_updates?.join(", ") || "(default — business_* NOT included)"}`);
  console.log(`  last error:           ${info.last_error_message || "(none)"}`);
  if (info.last_error_date) {
    console.log(`  last error at:        ${new Date(info.last_error_date * 1000).toISOString()}`);
  }

  const missing = TELEGRAM_ALLOWED_UPDATES.filter((u) => !info.allowed_updates?.includes(u));
  if (info.url && missing.length > 0) {
    console.log(`\n  ⚠ Not subscribed to: ${missing.join(", ")}`);
    console.log("    Re-run with --set, or business DMs will never arrive.");
  }

  console.log("\nPipeline config");
  console.log("---------------");
  console.log(`  enabled:              ${config.enabled}`);
  console.log(`  dry run:              ${config.dryRun}`);
  console.log(`  allowlisted chats:    ${config.allowedChatIds.length > 0 ? config.allowedChatIds.join(", ") : "(none — every chat is untrusted)"}`);
  console.log(`  tags:                 ${config.baseTags.join(", ")}`);
  console.log(`  AI fallback:          ${config.aiFallback}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
