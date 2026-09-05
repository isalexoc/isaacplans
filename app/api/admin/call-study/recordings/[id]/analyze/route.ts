import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { runAnalysis } from "@/lib/call-study/run-analysis";
import { getRecording, toDetail } from "@/lib/call-study/store";

/**
 * Run (or re-run) the anatomy analysis and refill this call's snippets.
 *
 * Synchronous on purpose. A long call is several model calls and can take a couple of minutes, but
 * the agent has explicitly asked for it and is watching — a background job here would add a status
 * machine and a poll to save nothing. The automatic pass that runs when a transcript first lands is
 * the one that goes through QStash (`/api/queue/call-study-analyze`), because nobody is watching it.
 *
 * The work itself lives in `lib/call-study/run-analysis.ts` so both callers do the same thing.
 */

export const runtime = "nodejs";
export const maxDuration = 600;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const row = await getRecording(id);
    if (!row) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await runAnalysis(id);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    const updated = await getRecording(id);
    return NextResponse.json({
      success: true,
      snippetCount: result.snippetCount,
      objectionCount: result.objectionCount,
      recording: updated ? toDetail(updated) : null,
    });
  } catch (error) {
    console.error("[call-study/recordings/:id/analyze] POST", error);
    return NextResponse.json({ success: false, error: "Analysis failed" }, { status: 500 });
  }
}
