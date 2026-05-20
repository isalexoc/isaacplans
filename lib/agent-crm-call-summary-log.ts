const PREFIX = "[AGENT_CRM_CALL_SUMMARY]";

/** Minimal call payload shape for debug logging (avoids circular imports). */
export type CallPayloadForLog = {
  type?: string;
  locationId?: string;
  contactId?: string;
  messageId?: string;
  conversationId?: string;
  messageType?: string;
  messageTypeString?: string;
  direction?: string;
  callDuration?: number | string;
  callStatus?: string;
  status?: string;
  dateAdded?: string;
  attachments?: unknown;
  userId?: string;
  from?: string;
  to?: string;
  transcript?: string;
};

export function isCallSummaryDebugEnabled(): boolean {
  const v = process.env.AGENT_CRM_CALL_SUMMARY_DEBUG?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export type CallSummaryLogger = {
  readonly debugEnabled: boolean;
  debug: (message: string, meta?: Record<string, unknown>) => void;
  step: (step: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  elapsed: (label: string, startMs: number, meta?: Record<string, unknown>) => void;
};

function emit(
  level: "log" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  if (meta && Object.keys(meta).length > 0) {
    console[level](PREFIX, message, meta);
  } else {
    console[level](PREFIX, message);
  }
}

export function createCallSummaryLogger(debugEnabled = isCallSummaryDebugEnabled()): CallSummaryLogger {
  return {
    debugEnabled,

    debug(message, meta) {
      if (!debugEnabled) return;
      emit("log", `[debug] ${message}`, meta);
    },

    step(step, meta) {
      if (!debugEnabled) return;
      emit("log", `→ ${step}`, meta);
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

    elapsed(label, startMs, meta) {
      if (!debugEnabled) return;
      emit("log", `[debug] ${label}`, { ms: Date.now() - startMs, ...meta });
    },
  };
}

/** Safe webhook/call fields for logs (no tokens, no full recordings). */
export function sanitizeCallPayload(payload: CallPayloadForLog): Record<string, unknown> {
  const attachments = payload.attachments;
  let attachmentInfo: unknown = attachments;
  if (Array.isArray(attachments)) {
    attachmentInfo = attachments.map((a) => {
      if (typeof a === "string") {
        return { type: "url", length: a.length, hasRecording: a.startsWith("http") };
      }
      return a;
    });
  }

  const transcript =
    typeof payload.transcript === "string" && payload.transcript.trim()
      ? previewText(payload.transcript, 120)
      : undefined;

  return {
    type: payload.type,
    locationId: payload.locationId,
    contactId: payload.contactId,
    messageId: payload.messageId,
    conversationId: payload.conversationId,
    messageType: payload.messageType,
    messageTypeString: payload.messageTypeString,
    direction: payload.direction,
    callDuration: payload.callDuration,
    callStatus: payload.callStatus,
    status: payload.status,
    dateAdded: payload.dateAdded,
    userId: payload.userId,
    from: payload.from,
    to: payload.to,
    attachments: attachmentInfo,
    transcript,
  };
}

export function previewText(
  text: string,
  maxChars = 300
): { length: number; preview: string; truncated: boolean } {
  const length = text.length;
  if (length <= maxChars) {
    return { length, preview: text, truncated: false };
  }
  return {
    length,
    preview: `${text.slice(0, maxChars)}…`,
    truncated: true,
  };
}
