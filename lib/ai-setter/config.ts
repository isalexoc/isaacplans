/**
 * Env-driven settings for the AI Setter: an assistant that answers leads over the CRM's SMS /
 * WhatsApp and books calls with Isaac into the GHL calendar of the lead's product + language.
 *
 * Env is the CEILING. `app_settings` (lib/ai-setter/settings.ts) can only tighten (pause, busy,
 * hours, approved templates) — never loosen anything set here.
 *
 * Pure: no DB, no server-only. Imported by the CLI and the offline tests.
 */

export type AiSetterConfig = {
  /** Master switch. Off: the webhook answers 200 `skipped: disabled` and stores nothing. */
  enabled: boolean;
  /** Shadow mode: everything runs, nothing is sent — every reply lands in the inbox as `shadow`. */
  dryRun: boolean;
  debug: boolean;
  /** Bearer secret the GHL workflows' Custom Webhook sends. The webhook fails closed without it. */
  webhookSecret: string | null;
  /** Dedicated Private Integration token for the setter (AI_SETTER_GHL_PI), never AGENT_CRM_PI. */
  ghlToken: string | null;
  locationId: string | null;
  anthropicApiKey: string | null;
  model: string;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  dailyBudgetUsd: number;
  /** Isaac's GHL user id: appointment owner + "is this outbound message his?" */
  isaacUserId: string | null;
  agentFirstName: string;
  agentFullName: string;
  brandName: string;
  /** Shown to leads as the number Isaac calls from. */
  agentPhoneDisplay: string;
  siteUrl: string;
  /** Contacts the CLI may WRITE to (send/book) with --yes. Empty: the CLI never writes. */
  testContactIds: string[];
  /** create-contact adds the `ai_setter` tag to new web leads (enables replies only). */
  tagNewLeads: boolean;
  maxTurnsPerContactPerDay: number;
  maxTurnsPerThread: number;
  maxTurnsPerHour: number;
  /** A human reply from Isaac pauses the AI for this long (then it resumes answering). */
  humanPauseHours: number;
  /** Inbound messages older than this go to the inbox, never to the AI. */
  inboundMaxAgeHours: number;
  /** Wait this long after an inbound before the turn runs, so a burst becomes one reply. */
  debounceSeconds: number;
  /** "Call now": if Isaac hasn't tapped a button by then, the lead gets two times instead. */
  callNowTimeoutSeconds: number;
  /** Free-text drafts expire after this many hours. */
  draftTtlHours: number;
  /**
   * Append "Reply STOP to opt out" to the AI's first message on a channel. Turn off only if the
   * Phase 0 test shows GHL's own SMS compliance setting already appends it (no duplicate line).
   */
  appendStopFooter: boolean;
  /** Length of a booked call. Must be one of the calendar's durations (`ai-setter:try --calendars`). */
  appointmentMinutes: number;
  /** Answer HELP/AYUDA with the fixed help text. Turn off if the carrier / GHL already answers HELP. */
  replyToHelp: boolean;
};

export const AI_SETTER_QUEUE_PATH = "/api/queue/ai-setter";

/** Contacts carrying this tag are the ones the AI answers. */
export const AI_SETTER_TAG = "ai_setter";
/** Added when the AI books; a plain CRM label (no workflow needed). */
export const AI_BOOKED_TAG = "ai_booked";
export const OUT_OF_LICENSE_STATE_TAG = "out_of_license_state";
/** Toggled (removed, then re-added) to fire Isaac's GHL internal-notification workflow. */
export const AI_ALERT_TAG = "ai_setter_alert";
/** Isaac can put this on any contact to keep the AI out of it for good. */
export const AI_OFF_TAG = "ai_setter_off";

/** Contacts with any of these tags are never answered by the AI. */
export const EXCLUSION_TAGS = [
  "legal_shield",
  // A Legal Shield client of Isaac's dad, from the LS intake: not an insurance lead.
  "legal_shield_intake",
  "agent_crm_affiliate",
  "tcpa_litigator_risk",
  AI_OFF_TAG,
] as const;

/**
 * Never more than this many Claude API calls in one turn: up to two tool steps (e.g. set the
 * state, find times), the reply, and one regeneration when the guard rejects a free-text draft.
 */
export const MAX_LLM_CALLS_PER_TURN = 4;

/** Stay well inside the queue route's maxDuration (300 s). */
export const TURN_BUDGET_MS = 240_000;

/**
 * Budget reservation per turn (before Claude runs; replaced by the real cost after). A realistic
 * worst case, not max_tokens on every call: a turn's prompt is ~6-10k tokens and replies are
 * short, so 12k in / 3k out per call at fallback rates. Real usage is metered and settled.
 */
export const RESERVE_INPUT_TOKENS_PER_CALL = 12_000;
export const RESERVE_OUTPUT_TOKENS_PER_CALL = 3_000;

/** Pricing used for the budget (micro-USD per token). Opus 5.5: $4 / $20 per MTok, cache read $0.20, write $5. */
export const PRICE_MICROS = {
  input: 4,
  output: 20,
  cacheRead: 0.2,
  cacheWrite: 5,
  /** Fallback models (Opus 5 / 4.8) bill higher; reservations use this worst case. */
  fallbackInput: 5,
  fallbackOutput: 25,
} as const;

export type ModelRates = { input: number; output: number; cacheRead: number; cacheWrite: number };

/**
 * Micro-USD per token by model id, for pricing each attempt in `usage.iterations` (a declined
 * attempt and the fallback that served it are billed separately, each at its own model's rates).
 * Cache writes are the 5-minute TTL (1.25x input). An unlisted model is priced at
 * `UNKNOWN_MODEL_RATES`, the highest of the family, so the daily cap never under-counts.
 */
export const PRICE_BY_MODEL: Record<string, ModelRates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
};
export const UNKNOWN_MODEL_RATES: ModelRates = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };

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

function parseIntInRange(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseFloatInRange(value: string | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number.parseFloat(value.trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function secret(value: string | undefined): string | null {
  if (!value) return null;
  const v = stripQuotes(value);
  return v || null;
}

function text(value: string | undefined, fallback: string): string {
  const v = value ? stripQuotes(value) : "";
  return v || fallback;
}

function parseEffort(value: string | undefined): AiSetterConfig["effort"] {
  const v = (value ?? "").trim().toLowerCase();
  return v === "medium" || v === "high" ? v : "low";
}

function parseIdList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9]{10,40}$/.test(s));
}

export function getAiSetterConfig(env: NodeJS.ProcessEnv = process.env): AiSetterConfig {
  return {
    enabled: parseBool(env.AI_SETTER_ENABLED, false),
    dryRun: parseBool(env.AI_SETTER_DRY_RUN, true),
    debug: parseBool(env.AI_SETTER_DEBUG, false),
    webhookSecret: secret(env.AI_SETTER_WEBHOOK_SECRET),
    ghlToken: secret(env.AI_SETTER_GHL_PI),
    locationId: secret(env.AGENT_CRM_LOCATION_ID),
    anthropicApiKey: secret(env.ANTHROPIC_API_KEY),
    model: text(env.AI_SETTER_MODEL, "claude-opus-5-5"),
    effort: parseEffort(env.AI_SETTER_EFFORT),
    maxTokens: parseIntInRange(env.AI_SETTER_MAX_TOKENS, 8000, 1024, 32_000),
    dailyBudgetUsd: parseFloatInRange(env.AI_SETTER_DAILY_BUDGET_USD, 10, 0, 1000),
    isaacUserId: secret(env.AI_SETTER_GHL_USER_ID),
    agentFirstName: text(env.AI_SETTER_AGENT_FIRST_NAME, "Isaac"),
    agentFullName: text(env.AI_SETTER_AGENT_FULL_NAME, "Isaac Orraiz"),
    brandName: text(env.AI_SETTER_BRAND_NAME, "Isaac Plans Insurance"),
    agentPhoneDisplay: text(env.AI_SETTER_AGENT_PHONE, "(540) 426-1804"),
    siteUrl: text(env.NEXT_PUBLIC_SITE_URL, "https://www.isaacplans.com").replace(/\/$/, ""),
    testContactIds: parseIdList(env.AI_SETTER_TEST_CONTACT_IDS),
    tagNewLeads: parseBool(env.AI_SETTER_TAG_NEW_LEADS, false),
    maxTurnsPerContactPerDay: parseIntInRange(env.AI_SETTER_MAX_TURNS_PER_CONTACT_DAY, 8, 1, 50),
    maxTurnsPerThread: parseIntInRange(env.AI_SETTER_MAX_TURNS_PER_THREAD, 40, 1, 200),
    maxTurnsPerHour: parseIntInRange(env.AI_SETTER_MAX_TURNS_PER_HOUR, 60, 1, 1000),
    humanPauseHours: parseIntInRange(env.AI_SETTER_HUMAN_PAUSE_HOURS, 48, 1, 24 * 30),
    inboundMaxAgeHours: parseIntInRange(env.AI_SETTER_INBOUND_MAX_AGE_HOURS, 12, 1, 72),
    debounceSeconds: parseIntInRange(env.AI_SETTER_DEBOUNCE_SECONDS, 20, 0, 120),
    callNowTimeoutSeconds: parseIntInRange(env.AI_SETTER_CALL_NOW_TIMEOUT_SECONDS, 180, 60, 900),
    draftTtlHours: parseIntInRange(env.AI_SETTER_DRAFT_TTL_HOURS, 2, 1, 24),
    appendStopFooter: parseBool(env.AI_SETTER_APPEND_STOP, true),
    appointmentMinutes: parseIntInRange(env.AI_SETTER_APPOINTMENT_MINUTES, 30, 10, 120),
    replyToHelp: parseBool(env.AI_SETTER_REPLY_HELP, true),
  };
}

/**
 * Names of the settings a live turn needs. Empty means ready. QStash must both publish and
 * verify: a Claude turn never runs inline inside a webhook.
 */
export function missingAiSetterConfig(
  config: AiSetterConfig,
  qstash: { publish: boolean; receive: boolean }
): string[] {
  const missing: string[] = [];
  if (!config.webhookSecret) missing.push("AI_SETTER_WEBHOOK_SECRET");
  if (!config.ghlToken) missing.push("AI_SETTER_GHL_PI");
  if (!config.locationId) missing.push("AGENT_CRM_LOCATION_ID");
  if (!config.anthropicApiKey) missing.push("ANTHROPIC_API_KEY");
  if (!config.isaacUserId) missing.push("AI_SETTER_GHL_USER_ID");
  if (!qstash.publish) missing.push("QSTASH_ENABLED + QSTASH_TOKEN");
  if (!qstash.receive) missing.push("QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY");
  return missing;
}

/** Isaac's default weekly hours (ET), editable in /admin/ai-setter → Ajustes. */
export const DEFAULT_SCHEDULE_TIMEZONE = "America/New_York";
