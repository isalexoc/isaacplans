/**
 * Logger for the AI Setter (same shape as lib/phone-finder/log.ts).
 *
 * PII rule: contact ids, run ids, statuses, counts, template ids and MASKED phones only. Never
 * message bodies, names, emails, prompts, tool inputs, or GHL / Anthropic error bodies.
 */

import type { AiSetterLogger } from "./types";

const PREFIX = "[AI_SETTER]";

function emit(level: "log" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  if (meta && Object.keys(meta).length > 0) console[level](PREFIX, message, meta);
  else console[level](PREFIX, message);
}

export function createAiSetterLogger(debugEnabled = false): AiSetterLogger {
  return {
    debugEnabled,
    debug(message, meta) {
      if (debugEnabled) emit("log", `[debug] ${message}`, meta);
    },
    info: (message, meta) => emit("log", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
  };
}

/** A logger that records lines in memory — for the offline tests. */
export function createMemoryLogger(): AiSetterLogger & { lines: string[] } {
  const lines: string[] = [];
  const push = (level: string) => (message: string, meta?: Record<string, unknown>) => {
    lines.push(`${level} ${message}${meta ? ` ${JSON.stringify(meta)}` : ""}`);
  };
  return { debugEnabled: true, lines, debug: push("debug"), info: push("info"), warn: push("warn"), error: push("error") };
}

/** "+13055550142" -> "305•••••42". Enough to tell numbers apart in a log, not enough to dial. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return digits ? "•••" : "";
  const last10 = digits.slice(-10);
  return `${last10.slice(0, 3)}•••••${last10.slice(-2)}`;
}
