import { NextRequest, NextResponse } from "next/server";
import { saveIntakeAnswers } from "@/lib/intake-core/save";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// POST /api/intake/[lob]/[token]/patch — autosave `{ patch: { key: value } }`: only the answers the
// form changed, merged into the stored ones (encrypts sensitive at rest). An empty patch writes
// nothing and pushes nothing to the CRM. Same access, lock and claim rules as the legacy PATCH.
export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    return await saveIntakeAnswers(request, lob, token, "patch");
  } catch (error) {
    console.error(`[intake/${lob}/:token/patch] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}
