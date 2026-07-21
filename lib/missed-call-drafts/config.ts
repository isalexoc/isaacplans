/** Env-driven settings for the missed-call → SMS/WhatsApp draft-note generator. */

import {
  getCallSummaryConfig,
  isCallSummaryConfigured,
  type CallSummaryConfig,
} from "@/lib/agent-crm-call-summary-config";
import { getAgentLocalTimezone } from "@/lib/timezone";

export type MissedCallDraftsConfig = {
  enabled: boolean;
  notePrefix: string;
  timezone: string;
  /** Skip drafting for calls older than this (avoids backfill/reconcile spam). */
  maxAgeMs: number;
  /** Shared CRM + OpenAI settings. */
  callSummary: CallSummaryConfig;
};

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function stripQuotes(value: string): string {
  const t = value.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

export function getMissedCallDraftsConfig(): MissedCallDraftsConfig {
  const notePrefixRaw = process.env.MISSED_CALL_DRAFTS_NOTE_PREFIX?.trim();
  return {
    enabled: parseBool(process.env.MISSED_CALL_DRAFTS_ENABLED, false),
    notePrefix: stripQuotes(notePrefixRaw || "📱 Follow-Up Drafts"),
    timezone: getAgentLocalTimezone(),
    maxAgeMs: 48 * 60 * 60 * 1000,
    callSummary: getCallSummaryConfig(),
  };
}

export function isMissedCallDraftsConfigured(config: MissedCallDraftsConfig): boolean {
  return Boolean(config.enabled && isCallSummaryConfigured(config.callSummary));
}
