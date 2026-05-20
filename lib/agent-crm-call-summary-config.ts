/** Env-driven settings for Agent CRM call → OpenAI → contact note pipeline. */

export type CallSummaryConfig = {
  enabled: boolean;
  debug: boolean;
  webhookSecret: string | null;
  notePrefix: string;
  includeVoicemail: boolean;
  openaiApiKey: string | null;
  openaiModel: string;
  whisperModel: string;
  maxTranscriptChars: number;
  backfillDays: number;
  backfillMaxPerRun: number;
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

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value?.trim()) return defaultValue;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export function getCallSummaryConfig(): CallSummaryConfig {
  const notePrefixRaw = process.env.AGENT_CRM_CALL_SUMMARY_NOTE_PREFIX?.trim();
  return {
    enabled: parseBool(process.env.AGENT_CRM_CALL_SUMMARY_ENABLED, false),
    debug: parseBool(process.env.AGENT_CRM_CALL_SUMMARY_DEBUG, false),
    webhookSecret: process.env.AGENT_CRM_CALL_SUMMARY_WEBHOOK_SECRET?.trim() || null,
    notePrefix: stripQuotes(notePrefixRaw || "AI Call Summary"),
    includeVoicemail: parseBool(process.env.AGENT_CRM_CALL_SUMMARY_INCLUDE_VOICEMAIL, false),
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || null,
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    whisperModel: process.env.OPENAI_WHISPER_MODEL?.trim() || "whisper-1",
    maxTranscriptChars: parseIntEnv(process.env.AGENT_CRM_CALL_SUMMARY_MAX_TRANSCRIPT_CHARS, 120_000),
    backfillDays: parseIntEnv(process.env.AGENT_CRM_CALL_SUMMARY_BACKFILL_DAYS, 30),
    backfillMaxPerRun: parseIntEnv(process.env.AGENT_CRM_CALL_SUMMARY_BACKFILL_MAX_PER_RUN, 15),
    locationId: process.env.AGENT_CRM_LOCATION_ID?.trim() || null,
    piToken: process.env.AGENT_CRM_PI?.trim() || null,
  };
}

export function isCallSummaryConfigured(config: CallSummaryConfig): boolean {
  return Boolean(config.enabled && config.openaiApiKey && config.piToken && config.locationId);
}
