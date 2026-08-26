import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { searchRoutingNumbers, lookupBankByRouting } from "@/lib/iul-intake/ach-directory";

/**
 * GET /api/iul-intake/routing-lookup — admin only. Two modes:
 *   ?routingNumber=021000021        → name the bank behind a number
 *   ?bankName=Chase&state=FL[&city] → candidate ACH numbers for that bank in that state
 *
 * There is no longer a "configured" state to report. The directory is compiled into the
 * deployment, so the search either matches or it does not — it can never be switched off by a
 * missing key, and the panel no longer has to hide itself. That removed a whole failure mode:
 * the previous provider's search endpoint was premium-only, so a free key made the feature
 * silently vanish in production while looking fine in the code.
 *
 * Still behind the admin check even though the data is public and local. This answers questions
 * about a client's banking mid-application; it belongs to the agent's session, and keeping the
 * gate means the route cannot quietly become a public bank-directory API for anyone who finds it.
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);

    // Reverse mode: a routing number in, the bank's name out — the same confirmation the
    // client's own page gets, so the agent can read it back and have them agree.
    const reverse = searchParams.get("routingNumber");
    if (reverse) {
      return NextResponse.json({ success: true, bank: lookupBankByRouting(reverse) });
    }

    const bankName = searchParams.get("bankName") ?? "";
    const state = searchParams.get("state") ?? "";
    const city = searchParams.get("city") ?? "";

    if (!bankName.trim() || state.trim().length !== 2) {
      return NextResponse.json(
        { success: false, error: "Bank name and a two-letter state are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      results: searchRoutingNumbers({ bankName, state, city }),
    });
  } catch (error) {
    console.error("[iul-intake/routing-lookup] GET", error);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }
}
