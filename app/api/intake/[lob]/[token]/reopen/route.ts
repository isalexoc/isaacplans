import { NextRequest, NextResponse } from "next/server";
import { forbidden, isResponse, notFound, resolveConfig } from "@/lib/intake-core/route-helpers";
import { getIntakeByToken, setClientReopened, toIntakeSummary } from "@/lib/intake-core/server";
import { operatorOwns, requireIntakeOperator } from "@/lib/tenancy/context";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// POST /api/intake/[lob]/[token]/reopen — the owner only: allow/lock client edits after submit
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const op = await requireIntakeOperator(lob);
    if (isResponse(op)) return op;

    const config = resolveConfig(lob);
    if (!config) return notFound();
    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    if (!(await operatorOwns(op, row))) return forbidden();

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
