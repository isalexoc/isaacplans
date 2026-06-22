import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  getIntakeByToken,
  setClientReopened,
  toIntakeSummary,
} from "@/lib/iul-intake/server";

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/iul-intake/[token]/reopen — admin only: allow/lock client edits after submit
export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = await request.json().catch(() => ({}));
    const allow = body?.allow !== false; // default to true (allow editing)

    const updated = await setClientReopened(token, allow);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, session: toIntakeSummary(updated) });
  } catch (error) {
    console.error("[iul-intake/:token/reopen] POST", error);
    return NextResponse.json({ success: false, error: "Failed to update edit access" }, { status: 500 });
  }
}
