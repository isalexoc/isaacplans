/** Lightweight structured logger for the Telegram leads pipeline (same shape as the call-summary one). */

const PREFIX = "[TELEGRAM_LEADS]";

export function isTelegramDebugEnabled(): boolean {
  const v = process.env.TELEGRAM_LEADS_DEBUG?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export type TelegramLogger = {
  readonly debugEnabled: boolean;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

function emit(level: "log" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  if (meta && Object.keys(meta).length > 0) {
    console[level](PREFIX, message, meta);
  } else {
    console[level](PREFIX, message);
  }
}

export function createTelegramLogger(debugEnabled = isTelegramDebugEnabled()): TelegramLogger {
  return {
    debugEnabled,
    debug(message, meta) {
      if (!debugEnabled) return;
      emit("log", `[debug] ${message}`, meta);
    },
    info(message, meta) {
      emit("log", message, meta);
    },
    warn(message, meta) {
      emit("warn", message, meta);
    },
    error(message, meta) {
      emit("error", message, meta);
    },
  };
}
