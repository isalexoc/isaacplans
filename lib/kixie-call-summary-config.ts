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
