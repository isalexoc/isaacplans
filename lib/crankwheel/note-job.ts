/**
 * Turning a finished CrankWheel session into a note on the CRM contact.
 *
 * Runs from two places for the same reason the Kixie pipeline does: a QStash job fired when the
 * session actually started (prompt, the common case), and the existing daily reconcile as a
 * backstop for anything that missed — scheduled links, which have no `create_hook` to fire from,
 * and hooks CrankWheel never delivered.
 *
 * Server-only.
 */

import "server-only";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { listUsage } from "./client";
import { getCrankwheelConfig } from "./config";
import { formatMeetingNote, MEETING_NOTE_TITLE } from "./note";
import { getMeetingById, markNotePosted, type MeetingRow } from "./meetings";
import { matchUsageSession } from "./matching";
import type { CrankwheelUsageSession } from "./types";

export type NoteJobResult = {
  posted: boolean;
  /** Why not, when not. `pending` means "try again later"; anything else is terminal for now. */
  reason?: "already_posted" | "not_found" | "no_contact" | "no_session_yet" | "crm_failed" | "pending";
};

/** Did anyone actually watch? CrankWheel reports both a live and a high-water count. */
function clientJoined(session: CrankwheelUsageSession): boolean {
  const info = session.viewer_info;
  return Boolean((info?.max_viewer_count ?? 0) > 0 || (info?.viewer_count ?? 0) > 0);
}

export async function postMeetingNote(meetingIdOrRow: string | MeetingRow): Promise<NoteJobResult> {
  const meeting =
    typeof meetingIdOrRow === "string" ? await getMeetingById(meetingIdOrRow) : meetingIdOrRow;
  if (!meeting) return { posted: false, reason: "not_found" };
  if (meeting.notePostedAt) return { posted: false, reason: "already_posted" };
  if (!meeting.crmContactId) return { posted: false, reason: "no_contact" };

  const creds = agentCrmGetBaseCredentials();
  if (!creds) return { posted: false, reason: "crm_failed" };

  const config = getCrankwheelConfig();
  const anchor = meeting.sessionStartedAt ?? meeting.createdAt;

  const sessions = await listUsage({
    // A little before the anchor, because clock skew between us and CrankWheel is not zero.
    from: new Date(anchor.getTime() - 30 * 60 * 1000),
    to: new Date(),
    config,
  });

  const match = matchUsageSession(sessions, {
    presenterEmail: config.presenterEmail,
    anchor,
    instant: meeting.kind === "now",
  });

  // No session yet does not mean no meeting: it may still be running, or CrankWheel may not have
  // written it out. Leave the row untouched so the daily reconcile tries again.
  if (!match) return { posted: false, reason: "no_session_yet" };

  const joined = clientJoined(match);
  const body = formatMeetingNote({
    kind: meeting.kind === "scheduled" ? "scheduled" : "now",
    durationSeconds: match.duration ?? null,
    clientJoined: joined,
    viewerLocations: match.viewer_info?.locations,
    startedAt: new Date(match.start_date),
    locale: meeting.locale === "es" ? "es" : "en",
  });

  try {
    await createContactNote({
      contactId: meeting.crmContactId,
      token: creds.token,
      title: MEETING_NOTE_TITLE,
      body,
    });
  } catch (e) {
    console.error("[CRANKWHEEL] Failed to post meeting note:", e);
    return { posted: false, reason: "crm_failed" };
  }

  try {
    await markNotePosted(meeting.id, {
      cwSessionId: match.session_id ?? null,
      durationSeconds: match.duration ?? null,
    });
  } catch (e) {
    // The unique index on cw_session_id rejected it: another meeting already claimed this session.
    // The note is out and cannot be recalled, but the row must stop being retried.
    console.warn("[CRANKWHEEL] Session already claimed by another meeting:", e);
    await markNotePosted(meeting.id, { cwSessionId: null, durationSeconds: match.duration ?? null });
  }

  return { posted: true };
}
