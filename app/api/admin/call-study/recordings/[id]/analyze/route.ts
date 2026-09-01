import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { analyzeCall } from "@/lib/call-study/analysis";
import {
  getRecording,
  replaceSnippets,
  saveAnalysis,
  setStatus,
  toDetail,
} from "@/lib/call-study/store";

/**
 * Run (or re-run) the anatomy analysis and refill this call's snippets.
 *
 * Synchronous on purpose. A long call is several model calls and can take a couple of minutes, but
 * the agent has explicitly asked for it and is watching — a background job here would add a status
 * machine and a poll to save nothing.
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
    if (!row.turns || row.turns.length === 0) {
      return NextResponse.json(
        { success: false, error: "This call has not been transcribed yet." },
        { status: 400 }
      );
    }

    await setStatus(id, "analyzing");

    const result = await analyzeCall(row.turns, row.speakerMap ?? null);
    if (!result.ok) {
      // Back to "transcribed", not "failed": the transcript is intact and still the main artifact,
      // so the agent should see a working call with a retryable analysis, not a broken one.
      await setStatus(id, "transcribed", result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    await saveAnalysis(id, result.analysis);
    // Replace rather than append: re-analysing a call must not double its entries in the library.
    const snippetCount = await replaceSnippets(id, userId, result.snippets, row.speakerMap ?? null);

    const updated = await getRecording(id);
    return NextResponse.json({
      success: true,
      snippetCount,
      recording: updated ? toDetail(updated) : null,
    });
  } catch (error) {
    console.error("[call-study/recordings/:id/analyze] POST", error);
    return NextResponse.json({ success: false, error: "Analysis failed" }, { status: 500 });
  }
}
