import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { fireMeetingWorkflow, syncMeetingLinkToCrm } from "@/lib/crankwheel/crm";
import { getMeetingById, markMeetingSent, toMeetingView } from "@/lib/crankwheel/meetings";

/**
 * POST — hand the meeting link to the CRM so a GHL workflow texts or emails it.
 *
 * Isaac builds the two workflows once, keyed on `meeting_now_sent` and `meeting_scheduled_sent`.
 * Until then the copy-link button is the working path, which is why this route failing is
 * inconvenient rather than fatal to the feature.
 */

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
    const row = await getMeetingById(id);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "This meeting has no linked CRM contact." },
        { status: 400 }
      );
    }
    if (row.status !== "active") {
      return NextResponse.json(
        { success: false, error: "This link is no longer active." },
        { status: 400 }
      );
    }
    if (!agentCrmGetBaseCredentials()) {
      return NextResponse.json({ success: false, error: "CRM is not configured." }, { status: 400 });
    }

    const synced = await syncMeetingLinkToCrm(row);
    if (!synced) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not write the link to the CRM. Run `pnpm iul:fields` to create the meeting link field, then retry.",
        },
        { status: 502 }
      );
    }

    const tagged = await fireMeetingWorkflow(row);
    if (!tagged) {
      return NextResponse.json({ success: false, error: "Could not tag the contact." }, { status: 502 });
    }

    await markMeetingSent(row.id);
    return NextResponse.json({ success: true, meeting: toMeetingView({ ...row, sentAt: new Date() }) });
  } catch (error) {
    console.error("[crankwheel/meetings/:id/send] POST", error);
    return NextResponse.json({ success: false, error: "Failed to send link" }, { status: 500 });
  }
}
