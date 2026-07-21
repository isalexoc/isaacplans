import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getOpenLoopCalls } from "@/lib/call-dashboard";
import { agentCrmContactUrl } from "@/lib/agent-crm-contacts";
import { LOB_META, DISPOSITION_META } from "@/lib/call-summary-note-format";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  try {
    const calls = await getOpenLoopCalls();

    const items = calls.map((call) => ({
      contactId: call.contactId,
      locationId: call.locationId,
      noteId: call.noteId,
      disposition: call.disposition,
      dispositionMeta: DISPOSITION_META[call.disposition],
      lineOfBusiness: call.lineOfBusiness,
      lobMeta: LOB_META[call.lineOfBusiness],
      followUpDate: call.followUpDate,
      followUpDateIso: call.followUpDateIso ? call.followUpDateIso.toISOString() : null,
      processedAt: call.processedAt.toISOString(),
      contactName: call.structuredSummary?.clientProfile?.name || "Unknown — check CRM",
      nextStepsPreview: (call.structuredSummary?.nextSteps ?? []).slice(0, 2).map((step) => step.action),
      crmUrl: agentCrmContactUrl(call.locationId, call.contactId),
    }));

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("[admin/call-dashboard]", error);
    return NextResponse.json({ success: false, error: "Failed to load call dashboard" }, { status: 500 });
  }
}
