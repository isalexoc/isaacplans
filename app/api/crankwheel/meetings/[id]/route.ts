import { NextRequest, NextResponse } from "next/server";
import { getStaffAccess } from "@/lib/auth/access";
import { deleteMeetingLink } from "@/lib/crankwheel/client";
import { crankwheelConfigForPresenter } from "@/lib/crankwheel/config";
import { getMeetingById, markMeetingRevoked, toMeetingView } from "@/lib/crankwheel/meetings";

/**
 * One meeting: the agent's poll, and revoke.
 *
 * Staff (admin, or a scoped agent such as Legal Shield's) AND owner-scoped: an agent only ever
 * reaches meetings they minted. Nothing here is reachable from a client's phone — the client only
 * ever sees the CrankWheel URL itself.
 */

type RouteContext = { params: Promise<{ id: string }> };

async function requireOwnedMeeting(id: string) {
  const { userId, role } = await getStaffAccess();
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!role) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  const row = await getMeetingById(id);
  if (!row) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (row.ownerUserId !== userId) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { row };
}

/** GET — the panel's poll: has the agent started sharing, has the client turned up. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guard = await requireOwnedMeeting(id);
    if (guard.error) return guard.error;

    return NextResponse.json({ success: true, meeting: toMeetingView(guard.row!) });
  } catch (error) {
    console.error("[crankwheel/meetings/:id] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * DELETE — revoke the link at CrankWheel, then locally.
 *
 * The local row is marked revoked even when the remote call fails. A link the agent believes is
 * dead but is not would be the worse of the two failures, so the panel stops offering it either
 * way and the error is surfaced rather than swallowed.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const guard = await requireOwnedMeeting(id);
    if (guard.error) return guard.error;
    const row = guard.row!;

    // On the account the link lives on. A row whose account left the env can only be retired here.
    const config = crankwheelConfigForPresenter(row.presenterEmail);
    const remoteOk = row.uid && config ? await deleteMeetingLink(row.uid, config) : false;
    await markMeetingRevoked(row.id);

    return NextResponse.json({ success: true, remoteRevoked: remoteOk });
  } catch (error) {
    console.error("[crankwheel/meetings/:id] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to revoke" }, { status: 500 });
  }
}
