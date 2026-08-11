import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { deleteClient, updateClient } from "@/lib/referral-partners/server";
import { parsePremiumToCents, REFERRAL_CLIENT_STATUSES } from "@/lib/referral-partners/types";

/** Edit or remove one credited client. Admin only. */

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

type RouteParams = { params: Promise<{ id: string; clientId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId, clientId } = await params;
    const body = await request.json();
    const updates: Parameters<typeof updateClient>[2] = {};

    if (body.firstName !== undefined) updates.firstName = String(body.firstName).trim();
    if (body.lastName !== undefined) updates.lastName = String(body.lastName).trim();
    if (body.notes !== undefined) updates.notes = String(body.notes).trim();
    if (body.effectiveDate !== undefined) {
      updates.effectiveDate = String(body.effectiveDate).trim() || null;
    }

    if (body.monthlyPremium !== undefined) {
      const cents = parsePremiumToCents(body.monthlyPremium);
      if (cents === null) {
        return NextResponse.json(
          { success: false, error: "Enter the monthly premium as a number, e.g. 485 or 485.50" },
          { status: 400 }
        );
      }
      updates.monthlyPremiumCents = cents;
    }

    if (body.memberCount !== undefined) {
      const memberCount = Number(body.memberCount);
      if (!Number.isInteger(memberCount) || memberCount < 1 || memberCount > 30) {
        return NextResponse.json(
          { success: false, error: "Members must be a whole number from 1 to 30" },
          { status: 400 }
        );
      }
      updates.memberCount = memberCount;
    }

    if (body.status !== undefined) {
      if (!REFERRAL_CLIENT_STATUSES.includes(body.status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }

    const client = await updateClient(clientId, partnerId, updates);
    if (!client) {
      return NextResponse.json({ success: false, error: "Client not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, client });
  } catch (error) {
    console.error("[admin/referral-partners/:id/clients/:clientId] update", error);
    return NextResponse.json({ success: false, error: "Failed to update client" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId, clientId } = await params;
    await deleteClient(clientId, partnerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/referral-partners/:id/clients/:clientId] delete", error);
    return NextResponse.json({ success: false, error: "Failed to remove client" }, { status: 500 });
  }
}
