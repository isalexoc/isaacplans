import { NextRequest, NextResponse } from "next/server";
import { publishJob } from "@/lib/qstash/client";
import {
  getMeetingByHookSecret,
  markSessionStarted,
  markViewerJoined,
} from "@/lib/crankwheel/meetings";

/**
 * CrankWheel's lifecycle callbacks for a "meet now" link.
 *
 * CrankWheel calls `create_hook` when the agent starts sharing and `viewer_hook` when the first
 * viewer joins. Both are plain unauthenticated GETs with no signature and no body — the 32-char
 * secret in the path is the entire credential, which is why it is a nanoid and not the meeting id.
 *
 * The blast radius of a forged hit is deliberately tiny: it can stamp one of two timestamps on a
 * row whose id it would have to already know, and nothing else. No data is read back out, so a
 * wrong "client joined" badge is the worst it can do.
 *
 * Deliberately excluded from the Clerk middleware matcher — see middleware.ts.
 */

type RouteContext = { params: Promise<{ hookSecret: string; event: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { hookSecret, event } = await context.params;
    if (event !== "created" && event !== "viewer") {
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const meeting = await getMeetingByHookSecret(hookSecret);
    // 200 on an unknown secret on purpose: a 404 would tell a prober which secrets exist, and
    // CrankWheel has nothing useful to do with the distinction either way.
    if (!meeting) return NextResponse.json({ ok: true });

    if (event === "viewer") {
      await markViewerJoined(meeting.id);
      return NextResponse.json({ ok: true });
    }

    await markSessionStarted(meeting.id);

    // The session actually started, so there will be something to write a note about. Queue it
    // now rather than at mint time — a link nobody used should not produce a note.
    //
    // Only on the first `created` for this meeting: `markSessionStarted` is a first-write-wins
    // update, so re-reading the row tells us whether this call was the one that stamped it.
    if (!meeting.sessionStartedAt) {
      await publishJob({
        path: "/api/queue/crankwheel-meeting-note",
        body: { meetingId: meeting.id },
        // Long enough that a normal consultation has finished and CrankWheel's usage API has the
        // completed session. The daily reconcile is the backstop if this misses.
        delaySeconds: 45 * 60,
        requestOrigin: new URL(request.url).origin,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // Never surface a 500 to CrankWheel: it would retry a callback whose only job is bookkeeping.
    console.error("[crankwheel/hook] GET", error);
    return NextResponse.json({ ok: true });
  }
}
