/**
 * Plain-text note describing a finished CrankWheel meeting, for the CRM contact timeline.
 *
 * GoHighLevel notes render plain text only — no Markdown, no HTML — so the structure comes from
 * emoji, `Key: Value` rows and a unicode rule, exactly as `lib/call-summary-note-format.ts` does.
 * `toBoldSans` is reused from there so both note types look like they came from the same system.
 */

import { NOTE_SEPARATOR, toBoldSans } from "@/lib/call-summary-note-format";
import type { CrankwheelMeetingKind } from "./types";

/** Prefix that identifies these notes in the timeline, and lets a human scan for them. */
export const MEETING_NOTE_TITLE = "🖥️ Screen share";

export type MeetingNoteInput = {
  kind: CrankwheelMeetingKind;
  /** Seconds of screen share, from the CrankWheel usage API. */
  durationSeconds: number | null;
  /** True when a viewer actually connected. */
  clientJoined: boolean;
  /** Coarse geo strings CrankWheel reports for the viewer, e.g. "Stafford, United States*". */
  viewerLocations?: string[];
  startedAt: Date | null;
  locale: "en" | "es";
};

function formatDuration(seconds: number | null, locale: "en" | "es"): string {
  if (seconds === null || seconds <= 0) return locale === "es" ? "menos de un minuto" : "under a minute";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return locale === "es" ? `${secs} segundos` : `${secs} seconds`;
  const minLabel = locale === "es" ? (mins === 1 ? "minuto" : "minutos") : mins === 1 ? "minute" : "minutes";
  return secs > 0 ? `${mins} ${minLabel} ${secs}s` : `${mins} ${minLabel}`;
}

function formatWhen(startedAt: Date | null, locale: "en" | "es"): string | null {
  if (!startedAt) return null;
  // Fixed to the agency's operating timezone so the note reads the same wherever it is opened.
  return startedAt.toLocaleString(locale === "es" ? "es-US" : "en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Build the note body.
 *
 * A meeting the client never joined still gets a note, and says so plainly — "sent a link, nobody
 * turned up" is exactly the kind of thing that is worth seeing on a timeline later.
 */
export function formatMeetingNote(input: MeetingNoteInput): string {
  const es = input.locale === "es";
  const lines: string[] = [];

  const heading = es ? "Reunión de pantalla compartida" : "Screen share meeting";
  lines.push(`🖥️ ${toBoldSans(heading)}`);
  lines.push(NOTE_SEPARATOR);

  const when = formatWhen(input.startedAt, input.locale);
  if (when) lines.push(`📅 ${toBoldSans(es ? "Fecha" : "When")}: ${when}`);

  const kindLabel = input.kind === "now"
    ? es ? "Enlace inmediato" : "Instant link"
    : es ? "Enlace agendado" : "Scheduled link";
  lines.push(`🔗 ${toBoldSans(es ? "Tipo" : "Type")}: ${kindLabel}`);

  if (input.clientJoined) {
    lines.push(`✅ ${toBoldSans(es ? "Cliente" : "Client")}: ${es ? "se conectó" : "joined"}`);
    lines.push(
      `⏱️ ${toBoldSans(es ? "Duración" : "Duration")}: ${formatDuration(input.durationSeconds, input.locale)}`
    );
    const location = input.viewerLocations?.[0]?.replace(/\*$/, "").trim();
    if (location) lines.push(`📍 ${toBoldSans(es ? "Ubicación" : "Location")}: ${location}`);
  } else {
    lines.push(
      `⚠️ ${toBoldSans(es ? "Cliente" : "Client")}: ${
        es ? "no se conectó a la reunión" : "did not join the meeting"
      }`
    );
  }

  return lines.join("\n");
}
