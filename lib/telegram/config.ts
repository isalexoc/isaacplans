/**
 * Env-driven settings for the Telegram → Agent CRM IUL lead sync.
 *
 * The provider ("Empiregrowth Leads") forwards each lead from their channel as a private DM to
 * Isaac's personal Telegram account. A plain bot cannot read those, so a **connected business bot**
 * (Telegram Business → Chatbots) is attached to his account and scoped to that one chat; the DMs
 * then arrive as `business_message` updates.
 *
 * Mirrors the config pattern in `lib/leads-the-way/config.ts`, with two deliberate differences —
 * see REQUIRED_TAGS and `allowedChatIds` below.
 */

export type TelegramLeadsConfig = {
  /** Gates the CRM write ONLY. Inbound messages are always persisted so nothing is lost. */
  enabled: boolean;
  debug: boolean;
  /** Perform every CRM read for real, log the writes instead of sending them. */
  dryRun: boolean;
  botToken: string | null;
  /** Must equal the `secret_token` passed to setWebhook. */
  webhookSecret: string | null;
  /** Chats whose CONTENT we are allowed to store. No default — see below. */
  allowedChatIds: string[];
  /** Fallback target for alerts; the id learned from `business_connection` wins. */
  adminChatId: string | null;
  /** Always applied, in this order. Env may only ADD. */
  baseTags: string[];
  /** Fall back to OpenAI extraction when the deterministic parser can't find a phone/name. */
  aiFallback: boolean;
  openaiApiKey: string | null;
  openaiModel: string;
  locationId: string | null;
  piToken: string | null;
  /** Keep the whole update payload, not just the text. */
  storeRawPayload: boolean;
};

function stripQuotes(value: string): string {
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1";
}

/** "a, b ,c" → ["a","b","c"] (trimmed, de-quoted, empties dropped). */
function parseList(value: string | undefined, defaults: string[]): string[] {
  if (!value?.trim()) return defaults;
  const out = value
    .split(",")
    .map((s) => stripQuotes(s))
    .filter(Boolean);
  return out.length > 0 ? out : defaults;
}

/**
 * The two tags Isaac asked for. They are ALWAYS applied and env can only ADD to them, following
 * the `REQUIRED_BASE_TAGS` precedent in `lib/leads-the-way/config.ts` — a stale env override must
 * never be able to drop the tag that fires the CRM automation.
 *
 * There is deliberately no conditional tag map: the rule is exactly these two, unconditionally.
 */
export const TELEGRAM_REQUIRED_TAGS = ["spanish", "iul_empire_growth"] as const;

/** The tag whose ADDITION starts the IUL follow-up cadence. */
export const TELEGRAM_CADENCE_TAG = "iul_empire_growth";

export function getTelegramLeadsConfig(): TelegramLeadsConfig {
  return {
    enabled: parseBool(process.env.TELEGRAM_LEADS_ENABLED, false),
    debug: parseBool(process.env.TELEGRAM_LEADS_DEBUG, false),
    dryRun: parseBool(process.env.TELEGRAM_LEADS_DRY_RUN, false),
    botToken: process.env.TELEGRAM_BOT_TOKEN?.trim() || null,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    // No default on purpose. `allowedSenders` in the email pipeline can default to the vendor's
    // domains safely; a CHAT allowlist cannot, because this bot can see personal DMs. An empty
    // list means every chat is untrusted → metadata-only rows → an alert carrying the chat id
    // Isaac needs to paste in. Fail closed, and self-documenting.
    allowedChatIds: parseList(process.env.TELEGRAM_ALLOWED_CHAT_IDS, []),
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID?.trim() || null,
    baseTags: [...TELEGRAM_REQUIRED_TAGS, ...parseList(process.env.TELEGRAM_LEADS_TAGS, [])],
    aiFallback: parseBool(process.env.TELEGRAM_LEADS_AI_FALLBACK, true),
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    locationId: process.env.AGENT_CRM_LOCATION_ID?.trim() || null,
    piToken: process.env.AGENT_CRM_PI?.trim() || null,
    storeRawPayload: parseBool(process.env.TELEGRAM_LEADS_STORE_RAW, true),
  };
}

/** Everything needed to actually write a lead into the CRM. */
export function isTelegramLeadsConfigured(config: TelegramLeadsConfig): boolean {
  return Boolean(
    config.enabled &&
      config.botToken &&
      config.webhookSecret &&
      config.allowedChatIds.length > 0 &&
      config.piToken &&
      config.locationId &&
      (!config.aiFallback || config.openaiApiKey)
  );
}

/** Whether we may store this chat's message CONTENT (not just its ids). */
export function isAllowlistedChat(config: TelegramLeadsConfig, chatId: string | null): boolean {
  if (!chatId) return false;
  return config.allowedChatIds.includes(chatId.trim());
}

/** De-duplicated, lower-cased tag list to apply to a synced lead. */
export function resolveTelegramTags(config: TelegramLeadsConfig): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of config.baseTags) {
    const key = tag.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(tag.trim());
  }
  return out;
}
