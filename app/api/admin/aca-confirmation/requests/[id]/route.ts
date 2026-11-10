import { NextRequest, NextResponse } from "next/server";
import { readRequestEvidence } from "@/lib/aca-confirmation/evidence";
import { SAFE_ID_RE, acaConfirmationActionSchema } from "@/lib/aca-confirmation/format";
import { NO_STORE, apiError, linkOriginOf, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import {
  cancelAcaConfirmation,
  getAcaConfirmationRecord,
  resendAcaConfirmation,
} from "@/lib/aca-confirmation/server";
import type { AcaConfirmationRecordResponse } from "@/lib/aca-confirmation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/aca-confirmation/requests/[id] — admin only: one request's live status. Polled by
// the dialog only while it is open and the request is still moving.
export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;
    if (!SAFE_ID_RE.test(id)) return apiError(400, "Invalid confirmation.");

    const record = await getAcaConfirmationRecord(id, linkOriginOf(request));
    if (!record) return apiError(404, "Confirmation not found.");
    const body: AcaConfirmationRecordResponse = { success: true, record };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/requests/:id] GET", error);
    return apiError(500, "Failed to load the confirmation.");
  }
}

// POST /api/admin/aca-confirmation/requests/[id] {"action":"resend"|"cancel"} — admin only.
export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;
    if (!SAFE_ID_RE.test(id)) return apiError(400, "Invalid confirmation.");

    const parsed = acaConfirmationActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(400, "Invalid action.");

    const params = { id, userId, evidence: readRequestEvidence(request), linkOrigin: linkOriginOf(request) };
    if (parsed.data.action === "cancel") {
      const result = await cancelAcaConfirmation(params);
      if (!result.ok) return apiError(result.status, result.error);
      const body: AcaConfirmationRecordResponse = { success: true, record: result.data.record };
      return NextResponse.json(body, { headers: NO_STORE });
    }

    const result = await resendAcaConfirmation(params);
    if (!result.ok) return apiError(result.status, result.error);
    const body: AcaConfirmationRecordResponse = { success: true, ...result.data };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/requests/:id] POST", error);
    return apiError(500, "Failed to update the confirmation.");
  }
}
