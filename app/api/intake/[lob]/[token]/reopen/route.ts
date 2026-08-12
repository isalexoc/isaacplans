import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { forbidden, notFound, resolveConfig, unauthorized } from "@/lib/intake-core/route-helpers";
import { getIntakeByToken, setClientReopened, toIntakeSummary } from "@/lib/intake-core/server";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// POST /api/intake/[lob]/[token]/reopen — admin only: allow/lock client edits after submit
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return unauthorized();
    if (!(await getIsAdmin())) return forbidden();

    const config = resolveConfig(lob);
    if (!config) return notFound();
    if (!(await getIntakeByToken(config, token))) return notFound();

    const body = await request.json().catch(() => ({}));
    const allow = body?.allow !== false; // default to true (allow editing)

    const updated = await setClientReopened(token, allow);
    if (!updated) return notFound();

    return NextResponse.json({ success: true, session: toIntakeSummary(updated) });
  } catch (error) {
    console.error(`[intake/${lob}/:token/reopen] POST`, error);
    return NextResponse.json(
      { success: false, error: "Failed to update edit access" },
      { status: 500 }
    );
  }
}
