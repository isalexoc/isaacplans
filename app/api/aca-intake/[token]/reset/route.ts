import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  getAcaIntakeByToken,
  resetAcaIntakeLink,
  syncAcaIntakeLinkToCrm,
  toAcaIntakeSummary,
} from "@/lib/aca-intake/server";

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/aca-intake/[token]/reset — admin only: rotate token + clear the bound client
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
    const existing = await getAcaIntakeByToken(token);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const updated = await resetAcaIntakeLink(token);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // The token changed — keep the CRM link field current.
    await syncAcaIntakeLinkToCrm(updated);

    return NextResponse.json({ success: true, session: toAcaIntakeSummary(updated) });
  } catch (error) {
    console.error("[aca-intake/:token/reset] POST", error);
    return NextResponse.json({ success: false, error: "Failed to reset link" }, { status: 500 });
  }
}
