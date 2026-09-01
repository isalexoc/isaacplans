/**
 * Settings for Call Study (ElevenLabs Scribe transcription of recorded sales calls).
 */

export type CallStudyConfig = {
  apiKey: string | null;
  /** HMAC secret from the ElevenLabs dashboard webhook, used to verify inbound transcripts. */
  webhookSecret: string | null;
  model: string;
  /** Refuse anything longer than this. Scribe allows 10h; this is a cost guard, not a limit. */
  maxDurationSeconds: number;
};

const DEFAULT_MODEL = "scribe_v2";
const DEFAULT_MAX_DURATION_SECONDS = 4 * 60 * 60;

/**
 * Entity types Scribe should detect and mask.
 *
 * **This list is deliberately narrow, and the reason matters.** Passing the `pii` *category*
 * redacts `name` and `name_given` too — verified live, it turns "Hi, this is Will" into
 * "Hi, this is {NAME_0}" and destroys the one thing this whole feature exists to produce.
 *
 * Two more that are deliberately absent: `money` and `age`. A premium figure and a client's age
 * are the substance of a life insurance call, not incidental PII, and redacting them would gut the
 * transcript for the exact purpose it is being made.
 *
 * Valid values come from the API's own validation error, which enumerates them.
 */
export const REDACTED_ENTITY_TYPES = [
  "ssn",
  "credit_card",
  "credit_card_expiration",
  "cvv",
  "bank_account",
  "routing_number",
  "account_number",
  "passport_number",
  "driver_license",
  "password",
  "healthcare_number",
  "numerical_pii",
] as const;

export function getCallStudyConfig(): CallStudyConfig {
  const parsedMax = Number(process.env.CALL_STUDY_MAX_DURATION_SECONDS);
  return {
    apiKey: process.env.ELEVENLABS_API_KEY?.trim() || null,
    webhookSecret: process.env.ELEVENLABS_WEBHOOK_SECRET?.trim() || null,
    model: process.env.ELEVENLABS_STT_MODEL?.trim() || DEFAULT_MODEL,
    maxDurationSeconds:
      Number.isFinite(parsedMax) && parsedMax > 0 ? Math.floor(parsedMax) : DEFAULT_MAX_DURATION_SECONDS,
  };
}

/** Transcription needs only the API key; the webhook secret is checked where it is used. */
export function isCallStudyConfigured(config: CallStudyConfig = getCallStudyConfig()): boolean {
  return Boolean(config.apiKey);
}
