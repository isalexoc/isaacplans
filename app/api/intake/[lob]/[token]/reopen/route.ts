import { NextRequest, NextResponse } from "next/server";
import { requireLineOperator } from "@/lib/auth/access";
import { forbidden, notFound, resolveConfig } from "@/lib/intake-core/route-helpers";
import { getIntakeByToken, setClientReopened, toIntakeSummary } from "@/lib/intake-core/server";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// POST /api/intake/[lob]/[token]/reopen — admin only: allow/lock client edits after submit
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const gate = await requireLineOperator(lob);
    if ("error" in gate) return gate.error;
    const { access } = gate;

    const config = resolveConfig(lob);
    if (!config) return notFound();
    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    // Only the owner re-opens a form (an admin, as before, may on any line).
    if (!access.isAdmin && row.ownerUserId !== access.userId) return forbidden();

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
