"use client";

/** Live length of the text being edited: SMS segments (GSM-7 / UCS-2) or plain characters. */

import { smsSegments } from "@/lib/ai-setter/guard";
import type { Channel } from "@/lib/ai-setter/types";
import { cn } from "@/lib/utils";

/** The reviewer's SMS ceiling (lib/ai-setter/guard.ts). */
const MAX_SMS_SEGMENTS = 3;
/** The action route's limit for an edited text. */
export const MAX_EDIT_CHARS = 1600;

export function SegmentCounter({ channel, text }: { channel: Channel; text: string }) {
  const tooLongToSave = text.length > MAX_EDIT_CHARS;
  if (channel !== "SMS") {
    return (
      <p className={cn("text-xs", tooLongToSave ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
        {text.length} caracteres · WhatsApp
      </p>
    );
  }
  const info = smsSegments(text);
  const tooMany = info.segments > MAX_SMS_SEGMENTS;
  return (
    <p
      className={cn(
        "text-xs",
        tooMany || tooLongToSave ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"
      )}
      aria-live="polite"
    >
      {info.segments} {info.segments === 1 ? "segmento" : "segmentos"} · {info.units} caracteres · {info.encoding}
      {tooMany && ` · máximo ${MAX_SMS_SEGMENTS}`}
    </p>
  );
}
