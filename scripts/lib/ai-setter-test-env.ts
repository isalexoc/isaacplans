/**
 * The FIRST import of scripts/test-ai-setter.ts: it runs before any other module can read the
 * environment, so keep it first.
 *
 * Offline (default): every credential the AI Setter, or anything it could pull in, might use is
 * removed. No database, CRM, Telegram, QStash or Anthropic call can happen, even by mistake.
 *
 * `--live`: loads `.env` for ANTHROPIC_API_KEY (the DEVELOPMENT key, see AI_SETTER_SETUP.md §6) and
 * still removes the database, CRM, Telegram and QStash credentials. Live mode talks to Claude on its
 * default endpoint and to nothing else.
 */

import { config as loadDotenv } from "dotenv";

export const LIVE_MODE = process.argv.includes("--live");

/** Never needed by either mode. */
const ALWAYS_REMOVED = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL",
  "AI_SETTER_GHL_PI",
  "AGENT_CRM_PI",
  "AI_SETTER_WEBHOOK_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
  // Live calls go to the default Anthropic endpoint with the dev key, exactly like production.
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
];

if (LIVE_MODE) loadDotenv({ quiet: true });

for (const name of ALWAYS_REMOVED) delete process.env[name];
if (!LIVE_MODE) delete process.env.ANTHROPIC_API_KEY;
