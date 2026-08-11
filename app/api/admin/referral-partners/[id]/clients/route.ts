import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  createClient,
  getPartnerById,
  updateLead,
} from "@/lib/referral-partners/server";
import { parsePremiumToCents, REFERRAL_CLIENT_STATUSES } from "@/lib/referral-partners/types";
import type { ReferralClientStatus } from "@/lib/referral-partners/types";

/** Credit a closed, paying client to a partner. Admin only — this is what drives commission. */

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId } = await params;
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json({ success: false, error: "Partner not found" }, { status: 404 });
    }

    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "First and last name are required" },
        { status: 400 }
      );
    }

    const monthlyPremiumCents = parsePremiumToCents(body.monthlyPremium ?? "");
    if (monthlyPremiumCents === null) {
      return NextResponse.json(
        { success: false, error: "Enter the monthly premium as a number, e.g. 485 or 485.50" },
        { status: 400 }
      );
    }

    const memberCount = Number(body.memberCount);
    if (!Number.isInteger(memberCount) || memberCount < 1 || memberCount > 30) {
      return NextResponse.json(
        { success: false, error: "Members must be a whole number from 1 to 30" },
        { status: 400 }
      );
    }

    const status: ReferralClientStatus = REFERRAL_CLIENT_STATUSES.includes(body.status)
      ? body.status
      : "active";

    const client = await createClient({
      partnerId,
      firstName,
      lastName,
      memberCount,
      monthlyPremiumCents,
      // Snapshot the partner's CURRENT rate — a later rate change must not rewrite this client.
      commissionBps: partner.commissionBps,
      status,
      effectiveDate: String(body.effectiveDate ?? "").trim() || null,
      leadId: String(body.leadId ?? "").trim() || null,
      notes: String(body.notes ?? "").trim(),
    });

    // Converting from a lead closes that lead, so it stops showing as "in progress" on the
    // partner's dashboard the moment it appears in their paid list.
    if (client.leadId) {
      await updateLead(client.leadId, partnerId, { status: "closed" });
    }

    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error("[admin/referral-partners/:id/clients] create", error);
    return NextResponse.json({ success: false, error: "Failed to add client" }, { status: 500 });
  }
}
