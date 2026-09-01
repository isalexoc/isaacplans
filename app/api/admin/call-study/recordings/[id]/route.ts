import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  deleteRecording,
  getRecording,
  toDetail,
  updateRecordingMeta,
  updateSpeakerMap,
} from "@/lib/call-study/store";
import { LINES_OF_BUSINESS, type CallOutcome, type SpeakerMap, type SpeakerRole } from "@/lib/call-study/types";

/**
 * One recording: poll it, correct it, delete it.
 *
 * Admin-only and owner-scoped, the same pair of checks every other agent-facing route in this
 * codebase uses.
 */

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

async function requireOwned(id: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await getIsAdmin())) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  const row = await getRecording(id);
  if (!row) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (row.ownerUserId !== userId) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { row, userId };
}

const OUTCOMES: CallOutcome[] = ["sold", "not_sold", "follow_up", "unknown"];
const ROLES: SpeakerRole[] = ["agent", "client", "other"];

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guard = await requireOwned(id);
    if (guard.error) return guard.error;
    return NextResponse.json({ success: true, recording: toDetail(guard.row!) });
  } catch (error) {
    console.error("[call-study/recordings/:id] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * PATCH — rename speakers, retitle, tag the outcome and line of business.
 *
 * Renaming rewrites only the speaker map, never the turns, so a correction is instant on an
 * hour-long transcript and cannot damage the dialogue itself.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guard = await requireOwned(id);
    if (guard.error) return guard.error;
    const row = guard.row!;

    const body = await request.json().catch(() => ({}));

    if (body?.speakerMap && typeof body.speakerMap === "object") {
      const incoming = body.speakerMap as Record<string, { name?: unknown; role?: unknown }>;
      const next: SpeakerMap = { ...(row.speakerMap ?? {}) };
      for (const [speakerId, value] of Object.entries(incoming)) {
        // Only speakers this transcript actually has: the map keys the rendered dialogue, and an
        // invented id would be dead weight carried forever.
        if (!next[speakerId]) continue;
        const name = typeof value?.name === "string" ? value.name.trim().slice(0, 40) : "";
        const role = ROLES.includes(value?.role as SpeakerRole)
          ? (value!.role as SpeakerRole)
          : next[speakerId].role;
        next[speakerId] = { name: name || next[speakerId].name, role };
      }
      await updateSpeakerMap(id, next);
    }

    const patch: { title?: string; outcome?: CallOutcome; lineOfBusiness?: string | null } = {};
    if (typeof body?.title === "string" && body.title.trim()) {
      patch.title = body.title.trim().slice(0, 200);
    }
    if (OUTCOMES.includes(body?.outcome)) patch.outcome = body.outcome as CallOutcome;
    if (typeof body?.lineOfBusiness === "string") {
      patch.lineOfBusiness = (LINES_OF_BUSINESS as readonly string[]).includes(body.lineOfBusiness)
        ? body.lineOfBusiness
        : null;
    }
    if (Object.keys(patch).length > 0) await updateRecordingMeta(id, patch);

    const updated = await getRecording(id);
    return NextResponse.json({ success: true, recording: updated ? toDetail(updated) : null });
  } catch (error) {
    console.error("[call-study/recordings/:id] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guard = await requireOwned(id);
    if (guard.error) return guard.error;

    // The Cloudinary original is deliberately left in place: it is the only copy of the recording,
    // and losing it to a mis-click would be unrecoverable. Housekeeping is a separate decision.
    const deleted = await deleteRecording(id, guard.userId!);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error("[call-study/recordings/:id] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
