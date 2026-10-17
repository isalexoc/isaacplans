/**
 * Env-driven settings for Phone Finder: tick "Find More Phones" on a GHL contact and the person's
 * other phone numbers are written into the "Additional Possible Phones" text field.
 *
 * Vendors (Isaac's choice): EnformionGO Contact Enrichment finds the numbers, Trestle Real Contact
 * checks them (registered to this name? active? TCPA litigator?). Nothing is ever added to GHL's
 * phone list — see context/current-feature.md for why.
 *
 * Pure: no DB, no server-only. Imported by the CLI and the offline tests.
 */

export type PhoneFinderConfig = {
  /** Master switch. Off: the webhook answers 200 and does nothing. */
  enabled: boolean;
  debug: boolean;
  /** Bearer secret the GHL workflow's Custom Webhook sends. The webhook fails closed without it. */
  webhookSecret: string | null;
  trestleApiKey: string | null;
  enformionApName: string | null;
  enformionApPassword: string | null;
  piToken: string | null;
  locationId: string | null;
  /** Searches per agent-local day that may spend money. 0 blocks every search. */
  dailyLimit: number;
  /** EnformionGO attempts per search (name variants). Misses are free but count toward the monthly search cap. */
  maxSearches: number;
  /** Below this EnformionGO identityScore the result is labelled a weak match. */
  minIdentityScore: number;
  /** A re-tick with the same search inputs inside this window does nothing (the field already has the answer). */
  rerunCooldownHours: number;
  /** Cost estimate per EnformionGO match, in mills (1/1000 USD). Starter plan is $0.25. */
  enformionPriceMills: number;
};

/** Trestle self-serve prices in mills (trestleiq.com/pricing): Real Contact $0.03 + litigator add-on $0.005. */
export const TRESTLE_REAL_CONTACT_MILLS = 35;

export const PHONE_FINDER_QUEUE_PATH = "/api/queue/phone-finder";

/** Applied when the number ON FILE belongs to a TCPA litigator. Never removed automatically. */
export const PHONE_FINDER_LITIGATOR_TAG = "tcpa_litigator_risk";

/** Attempts per run before it is marked failed (QStash redelivers on 500). */
export const PHONE_FINDER_MAX_ATTEMPTS = 4;

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

function secret(value: string | undefined): string | null {
  if (!value) return null;
  const v = stripQuotes(value);
  return v || null;
}

export function getPhoneFinderConfig(env: NodeJS.ProcessEnv = process.env): PhoneFinderConfig {
  return {
    enabled: parseBool(env.PHONE_FINDER_ENABLED, false),
    debug: parseBool(env.PHONE_FINDER_DEBUG, false),
    webhookSecret: secret(env.PHONE_FINDER_WEBHOOK_SECRET),
    trestleApiKey: secret(env.TRESTLE_API_KEY),
    enformionApName: secret(env.ENFORMION_AP_NAME),
    enformionApPassword: secret(env.ENFORMION_AP_PASSWORD),
    piToken: secret(env.AGENT_CRM_PI),
    locationId: secret(env.AGENT_CRM_LOCATION_ID),
    dailyLimit: parseIntInRange(env.PHONE_FINDER_DAILY_LIMIT, 100, 0, 10_000),
    maxSearches: parseIntInRange(env.PHONE_FINDER_MAX_SEARCHES, 4, 1, 6),
    minIdentityScore: parseIntInRange(env.PHONE_FINDER_MIN_IDENTITY_SCORE, 75, 0, 100),
    rerunCooldownHours: parseIntInRange(env.PHONE_FINDER_RERUN_COOLDOWN_HOURS, 24, 0, 24 * 30),
    enformionPriceMills: parseIntInRange(env.PHONE_FINDER_ENFORMION_PRICE_MILLS, 250, 0, 10_000),
  };
}

/** Names of the settings a search needs. Empty means ready. */
export function missingPhoneFinderConfig(config: PhoneFinderConfig, resultsFieldId: string): string[] {
  const missing: string[] = [];
  if (!config.trestleApiKey) missing.push("TRESTLE_API_KEY");
  if (!config.enformionApName) missing.push("ENFORMION_AP_NAME");
  if (!config.enformionApPassword) missing.push("ENFORMION_AP_PASSWORD");
  if (!config.piToken) missing.push("AGENT_CRM_PI");
  if (!config.locationId) missing.push("AGENT_CRM_LOCATION_ID");
  if (!resultsFieldId) missing.push("results field id (pnpm phone-finder:fields)");
  return missing;
}
