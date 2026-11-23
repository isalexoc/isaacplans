import { NextRequest, NextResponse } from "next/server";
import {
  forbidden,
  isResponse,
  loadAuthorizedSession,
  notFound,
  resolveConfig,
} from "@/lib/intake-core/route-helpers";
import { operatorOwns, requireIntakeOperator } from "@/lib/tenancy/context";
import { deleteIntakeSession, getIntakeByToken, toIntakeSession } from "@/lib/intake-core/server";
import { saveIntakeAnswers, sessionDataForCaller } from "@/lib/intake-core/save";
import { decryptIntakeData } from "@/lib/intake-core/sensitive";
import type { IntakeData } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// GET /api/intake/[lob]/[token] — load (decrypts sensitive; claims unbound sessions to this device)
export async function GET(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const loaded = await loadAuthorizedSession(lob, token, { claim: true });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    const decrypted = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    // Isaac works his applications with the real values; the client's own browser only needs to see
    // that a value is on file, so a stolen link can never surface an SSN; and an agent sees masks
    // too, revealing one value at a time through the audited `…/reveal`.
    const shown = sessionDataForCaller(
      config,
      { role: access.role, ownerIsAgent: loaded.ownerAgent !== null },
      decrypted
    );

    return NextResponse.json({
      success: true,
      session: toIntakeSession(row, access.role, shown),
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token] GET`, error);
    return NextResponse.json({ success: false, error: "Failed to load session" }, { status: 500 });
  }
}

// PATCH /api/intake/[lob]/[token] — legacy whole-form autosave (`{ data }`), from tabs opened
// before `POST …/patch` existed. MERGE-ONLY now, through the same path: keys the body carries are
// written, keys it leaves out are kept, never dropped.
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    return await saveIntakeAnswers(request, lob, token, "data");
  } catch (error) {
    console.error(`[intake/${lob}/:token] PATCH`, error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}

// DELETE /api/intake/[lob]/[token] — owner-only; removes the intake record (CRM contact untouched)
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const op = await requireIntakeOperator(lob);
    if (isResponse(op)) return op;

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    // Only the agent who created the intake may delete it.
    if (!(await operatorOwns(op, row))) return forbidden();

    const deleted = await deleteIntakeSession(config, token, op.userId);
    if (!deleted) return notFound();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[intake/${lob}/:token] DELETE`, error);
    return NextResponse.json({ success: false, error: "Failed to delete" }, { status: 500 });
  }
}
