/**
 * Env-driven settings for the "Leads the Way" (Senior Life) inbound-email → GHL contact sync.
 *
 * Order-confirmation emails from Senior Life land at isaac@isaacplans.com, get forwarded to an
 * inbound-parse endpoint, and are upserted into Agent CRM (LeadConnector). Mirrors the config
 * pattern in `lib/agent-crm-call-summary-config.ts`.
 */

export type LeadsTheWayConfig = {
  enabled: boolean;
  debug: boolean;
  webhookSecret: string | null;
  /** Domains/addresses the confirmation email is allowed to come from. */
  allowedSenders: string[];
  /** Tags applied to every synced lead (base tags). */
  baseTags: string[];
  /** Lowercased substring → tag, matched against the email's "Lead Type". */
  tagMap: Array<{ match: string; tag: string }>;
  /** Fall back to OpenAI extraction when the deterministic parser can't find a phone. */
  aiFallback: boolean;
  openaiApiKey: string | null;
  openaiModel: string;
  locationId: string | null;
  piToken: string | null;
};

function stripQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
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

/** "spanish=fe_senior_life_spanish, english=fe_senior_life_english" → [{match,tag}] */
function parseTagMap(value: string | undefined): Array<{ match: string; tag: string }> {
  if (!value?.trim()) {
    return [
      { match: "spanish", tag: "fe_senior_life_spanish" },
    ];
  }
  const out: Array<{ match: string; tag: string }> = [];
  for (const pair of value.split(",")) {
    const [rawMatch, rawTag] = pair.split("=");
    const match = rawMatch ? stripQuotes(rawMatch).toLowerCase() : "";
    const tag = rawTag ? stripQuotes(rawTag) : "";
    if (match && tag) out.push({ match, tag });
  }
  return out;
}

export function getLeadsTheWayConfig(): LeadsTheWayConfig {
  return {
    enabled: parseBool(process.env.LEADS_THE_WAY_ENABLED, false),
    debug: parseBool(process.env.LEADS_THE_WAY_DEBUG, false),
    webhookSecret: process.env.LEADS_THE_WAY_WEBHOOK_SECRET?.trim() || null,
    allowedSenders: parseList(process.env.LEADS_THE_WAY_ALLOWED_SENDERS, [
      "srlife.net",
      "seniorlifeinsurancecompany.com",
    ]).map((s) => s.toLowerCase()),
    baseTags: parseList(process.env.LEADS_THE_WAY_TAGS, ["Leads the Way", "Senior Life Lead"]),
    tagMap: parseTagMap(process.env.LEADS_THE_WAY_TAG_MAP),
    aiFallback: parseBool(process.env.LEADS_THE_WAY_AI_FALLBACK, true),
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    locationId: process.env.AGENT_CRM_LOCATION_ID?.trim() || null,
    piToken: process.env.AGENT_CRM_PI?.trim() || null,
  };
}

/** CRM + secret are required to run; OpenAI only required when AI fallback is on. */
export function isLeadsTheWayConfigured(config: LeadsTheWayConfig): boolean {
  return Boolean(
    config.enabled &&
      config.piToken &&
      config.locationId &&
      config.webhookSecret &&
      (!config.aiFallback || config.openaiApiKey)
  );
}

/** Resolve the tags to apply for a given "Lead Type" string (base tags + any mapped tags). */
export function resolveLeadTags(config: LeadsTheWayConfig, leadType?: string | null): string[] {
  const tags = new Set(config.baseTags);
  const lt = (leadType ?? "").toLowerCase();
  if (lt) {
    for (const { match, tag } of config.tagMap) {
      if (lt.includes(match)) tags.add(tag);
    }
  }
  return [...tags];
}
