import { NextRequest, NextResponse } from "next/server";
import { SAFE_ID_RE } from "@/lib/aca-confirmation/format";
import { NO_STORE, apiError, requireAdminUser } from "@/lib/aca-confirmation/route-helpers";
import { listAcaConfirmationBadges } from "@/lib/aca-confirmation/server";
import type { AcaConfirmationBadgesResponse } from "@/lib/aca-confirmation/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS = 100;

// GET /api/admin/aca-confirmation?contactIds=a,b,c — admin only: the newest confirmation of each
// contact on screen, for the ACA dashboard's badges.
export async function GET(request: NextRequest) {
  try {
    const userId = await requireAdminUser();
    if (userId instanceof NextResponse) return userId;

    const contactIds = (request.nextUrl.searchParams.get("contactIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => SAFE_ID_RE.test(id))
      .slice(0, MAX_IDS);

    const body: AcaConfirmationBadgesResponse = { success: true, badges: await listAcaConfirmationBadges(contactIds) };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation] GET badges", error);
    return apiError(500, "Failed to load the confirmations.");
  }
}
