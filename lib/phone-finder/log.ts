/**
 * Logger for Phone Finder (same shape as lib/telegram/log.ts).
 *
 * PII rule: log contact ids, run ids, statuses, counts and MASKED phones only. Never names, emails,
 * addresses, vendor URLs (Trestle puts PII in the query string) or vendor response bodies.
 */

const PREFIX = "[PHONE_FINDER]";

export type PhoneFinderLogger = {
  readonly debugEnabled: boolean;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

function emit(level: "log" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  if (meta && Object.keys(meta).length > 0) console[level](PREFIX, message, meta);
  else console[level](PREFIX, message);
}

export function createPhoneFinderLogger(debugEnabled = false): PhoneFinderLogger {
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

/** "+13055550142" -> "305•••••42". Enough to tell numbers apart in a log, not enough to dial. */
export function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return digits ? "•••" : "";
  const last10 = digits.slice(-10);
  return `${last10.slice(0, 3)}•••••${last10.slice(-2)}`;
}
