import { NextRequest, NextResponse } from "next/server";
import { forbidden, isResponse, notFound, resolveConfig } from "@/lib/intake-core/route-helpers";
import {
  getIntakeByToken,
  resetIntakeLink,
  syncIntakeLinkToCrm,
  toIntakeSummary,
} from "@/lib/intake-core/server";
import { operatorCrmOptions, operatorOwns, requireIntakeOperator } from "@/lib/tenancy/context";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

/**
 * POST /api/intake/[lob]/[token]/reset — the owner only (an admin, or an agent on their line):
 * rotate the share link.
 *
 * The old link dies immediately and the device binding clears, so the next browser to open the new
 * link claims it. This is both the "link leaked" response and the recovery path when a client
 * loses the phone they started on.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const op = await requireIntakeOperator(lob);
    if (isResponse(op)) return op;

    const config = resolveConfig(lob);
    if (!config) return notFound();
    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    if (!(await operatorOwns(op, row))) return forbidden();

    const updated = await resetIntakeLink(token);
    if (!updated) return notFound();

    // Push the rotated link to the CRM so the agent can resend it (best-effort).
    await syncIntakeLinkToCrm(config, updated, undefined, operatorCrmOptions(op));

    return NextResponse.json({ success: true, session: toIntakeSummary(updated) });
  } catch (error) {
    console.error(`[intake/${lob}/:token/reset] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to reset link" }, { status: 500 });
  }
}
