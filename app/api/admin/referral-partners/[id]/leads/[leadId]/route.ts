import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { deleteLead, updateLead } from "@/lib/referral-partners/server";
import { REFERRAL_LEAD_STATUSES } from "@/lib/referral-partners/types";

/** Move a referral through its pipeline, or delete a junk submission. Admin only. */

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  return null;
}

type RouteParams = { params: Promise<{ id: string; leadId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId, leadId } = await params;
    const body = await request.json();
    const updates: Parameters<typeof updateLead>[2] = {};

    if (body.status !== undefined) {
      if (!REFERRAL_LEAD_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.notes !== undefined) updates.notes = String(body.notes).trim();

    const lead = await updateLead(leadId, partnerId, updates);
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, lead });
  } catch (error) {
    console.error("[admin/referral-partners/:id/leads/:leadId] update", error);
    return NextResponse.json({ success: false, error: "Failed to update lead" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId, leadId } = await params;
    await deleteLead(leadId, partnerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/referral-partners/:id/leads/:leadId] delete", error);
    return NextResponse.json({ success: false, error: "Failed to remove lead" }, { status: 500 });
  }
}
