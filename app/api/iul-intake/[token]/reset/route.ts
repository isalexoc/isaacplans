import { NextRequest, NextResponse } from "next/server";
import { cancelPendingCaptures } from "@/lib/iul-intake/secure-capture";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  getIntakeByToken,
  resetIntakeLink,
  syncIntakeLinkToCrm,
  toIntakeSummary,
} from "@/lib/iul-intake/server";

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/iul-intake/[token]/reset — admin only: rotate token + clear the bound client
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { token } = await context.params;
    const existing = await getIntakeByToken(token);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const updated = await resetIntakeLink(token);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Rotating the intake link is a deliberate revocation, so any live secure-capture link goes
    // with it — leaving one alive would mean "reset" only revoked half the access.
    try {
      await cancelPendingCaptures(updated.id);
    } catch (captureError) {
      console.warn("[iul-intake/reset] capture cleanup failed:", captureError);
    }

    // The token changed — keep the CRM link field current.
    await syncIntakeLinkToCrm(updated);

    return NextResponse.json({ success: true, session: toIntakeSummary(updated) });
  } catch (error) {
    console.error("[iul-intake/:token/reset] POST", error);
    return NextResponse.json({ success: false, error: "Failed to reset link" }, { status: 500 });
  }
}
