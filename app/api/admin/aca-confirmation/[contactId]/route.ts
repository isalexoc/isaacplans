import { NextRequest, NextResponse } from "next/server";
import { readRequestEvidence } from "@/lib/aca-confirmation/evidence";
import { SAFE_ID_RE, acaConfirmationCreateSchema } from "@/lib/aca-confirmation/format";
import { NO_STORE, apiError, linkOriginOf, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import { createAndSendAcaConfirmation, getAcaConfirmationDetail } from "@/lib/aca-confirmation/server";
import type {
  AcaConfirmationCreateResponse,
  AcaConfirmationDetailResponse,
  AcaConfirmationPendingExistsResponse,
} from "@/lib/aca-confirmation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ contactId: string }> };

// GET /api/admin/aca-confirmation/[contactId]?intake=<sessionId> — admin only: the contact as the
// CRM has it, the suggested legal name, the agent, the config flags and every request so far.
export async function GET(request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params;
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;
    if (!SAFE_ID_RE.test(contactId)) return apiError(400, "Invalid contact.");

    const intake = request.nextUrl.searchParams.get("intake") ?? undefined;
    const result = await getAcaConfirmationDetail(
      contactId,
      intake && SAFE_ID_RE.test(intake) ? intake : undefined,
      linkOriginOf(request)
    );
    if (!result.ok) return apiError(result.status, result.error);
    const body: AcaConfirmationDetailResponse = { success: true, detail: result.data };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/:contactId] GET", error);
    return apiError(500, "Failed to load the confirmation.");
  }
}

// POST /api/admin/aca-confirmation/[contactId] — admin only: issue a new confirmation and email it.
// 200 whenever the request was created, even if the email then failed (emailSent: false): the
// link works, so the agent can copy it or resend. 409 when one is already waiting to be signed.
export async function POST(request: NextRequest, context: RouteContext) {
  const { contactId } = await context.params;
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;
    if (!SAFE_ID_RE.test(contactId)) return apiError(400, "Invalid contact.");

    const parsed = acaConfirmationCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const field = parsed.error.issues[0]?.path[0];
      return apiError(400, field === "consumerName" ? "Enter the client's full legal name." : "Invalid input.");
    }

    const result = await createAndSendAcaConfirmation({
      contactId,
      input: parsed.data,
      userId,
      evidence: readRequestEvidence(request),
      linkOrigin: linkOriginOf(request),
    });
    if (!result.ok) {
      if (result.code === "pending_exists" && result.record) {
        const body: AcaConfirmationPendingExistsResponse = {
          success: false,
          code: "pending_exists",
          error: result.error,
          record: result.record,
        };
        return NextResponse.json(body, { status: 409, headers: NO_STORE });
      }
      return apiError(result.status, result.error);
    }
    const body: AcaConfirmationCreateResponse = { success: true, ...result.data };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/:contactId] POST", error);
    return apiError(500, "Failed to send the confirmation.");
  }
}
