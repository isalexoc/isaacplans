/** Env-driven settings for Kixie End Call → Whisper → OpenAI → GHL contact note. */

import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
  type CallSummaryConfig,
} from "@/lib/agent-crm-call-summary-config";

export type KixieCallSummaryConfig = {
  enabled: boolean;
  webhookSecret: string | null;
  minDurationSeconds: number;
  apiKey: string | null;
  businessId: string | null;
  /** Max bytes per Whisper upload chunk (OpenAI limit ~25MB). */
  recordingMaxBytes: number;
  /** Segment length in seconds when splitting long recordings. */
  whisperSegmentSeconds: number;
  /** Shared CRM + OpenAI settings */
  callSummary: CallSummaryConfig;
};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parseIntEnv(value: string | undefined, defaultValue: number): number {
  if (!value?.trim()) return defaultValue;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

export function getKixieCallSummaryConfig(): KixieCallSummaryConfig {
  return {
    enabled: parseBool(process.env.KIXIE_CALL_SUMMARY_ENABLED, false),
    webhookSecret: process.env.KIXIE_CALL_SUMMARY_WEBHOOK_SECRET?.trim() || null,
    minDurationSeconds: parseIntEnv(process.env.KIXIE_CALL_SUMMARY_MIN_DURATION_SECONDS, 60),
    apiKey: process.env.KIXIE_API_KEY?.trim() || null,
    businessId: process.env.KIXIE_BUSINESS_ID?.trim() || null,
    recordingMaxBytes: parseIntEnv(process.env.KIXIE_RECORDING_MAX_BYTES, 24_000_000),
    whisperSegmentSeconds: parseIntEnv(process.env.KIXIE_WHISPER_SEGMENT_SECONDS, 600),
    callSummary: getCallSummaryConfig(),
  };
}

export function isKixieCallSummaryConfigured(config: KixieCallSummaryConfig): boolean {
  return Boolean(
    config.enabled &&
      config.webhookSecret &&
      isCallSummaryConfigured(config.callSummary)
  );
}

export function isKixieRecordingHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "calls.kixie.com" || h.endsWith(".calls.kixie.com") || h.includes("calls.kixie.com");
}
