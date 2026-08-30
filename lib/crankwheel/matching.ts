/**
 * Deciding which CrankWheel session was which meeting.
 *
 * Pure, and split out of `note-job.ts` (which is `server-only`) precisely so it can be tested
 * directly — this is the one piece of the feature whose failure mode is a note landing on the
 * wrong contact.
 */

import type { CrankwheelUsageSession } from "./types";

/**
 * How far either side of the anchor a CrankWheel session may start and still be this meeting.
 *
 * Generous because the anchor is imprecise for scheduled links (the meeting could be any time
 * after the link was sent) and tight enough to matter for instant ones, where `create_hook` fires
 * within seconds of the session opening.
 */
const MATCH_WINDOW_MS = 15 * 60 * 1000;

/**
 * Pick the CrankWheel session that is this meeting.
 *
 * Matching is by presenter and time because CrankWheel's usage records carry no reference to the
 * link they came from. With a single presenter on the account and a `create_hook` timestamp this
 * is exact; for a scheduled link it is a nearest-match, which is why `cwSessionId` is uniquely
 * indexed — the database is what actually stops one session being claimed twice.
 */
export function matchUsageSession(
  sessions: CrankwheelUsageSession[],
  params: { presenterEmail: string; anchor: Date; instant: boolean }
): CrankwheelUsageSession | null {
  const anchorMs = params.anchor.getTime();
  const candidates = sessions
    .filter((s) => s.email?.toLowerCase() === params.presenterEmail.toLowerCase())
    .filter((s) => s.session_ended !== false)
    .map((s) => ({ s, delta: new Date(s.start_date).getTime() - anchorMs }))
    .filter(({ delta }) => Number.isFinite(delta));

  const inWindow = params.instant
    ? candidates.filter(({ delta }) => Math.abs(delta) <= MATCH_WINDOW_MS)
    // A scheduled meeting happens after the link went out, never before it.
    : candidates.filter(({ delta }) => delta >= -MATCH_WINDOW_MS);

  if (inWindow.length === 0) return null;
  inWindow.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));
  return inWindow[0].s;
}
