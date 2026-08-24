import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { searchRoutingNumbers, isRoutingLookupConfigured } from "@/lib/iul-intake/routing-lookup";

/**
 * GET /api/iul-intake/routing-lookup?bankName=&state=&city= — admin only.
 *
 * Deliberately NOT reachable from the client capture link. The client already knows their own
 * bank, and exposing a metered third-party API to an unauthenticated token is free rate-limit
 * abuse waiting to happen. It also keeps `API_NINJAS_KEY` server-side, which is the whole reason
 * this route exists instead of the component calling the provider directly.
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
    if (!isRoutingLookupConfigured()) {
      // Not an error: the panel simply does not render, and the agent types the number.
      return NextResponse.json({ success: true, configured: false, results: [] });
    }

    const { searchParams } = new URL(request.url);
    const bankName = searchParams.get("bankName") ?? "";
    const state = searchParams.get("state") ?? "";
    const city = searchParams.get("city") ?? "";

    if (!bankName.trim() || state.trim().length !== 2) {
      return NextResponse.json(
        { success: false, error: "Bank name and a two-letter state are required." },
        { status: 400 }
      );
    }

    const results = await searchRoutingNumbers({ bankName, state, city });
    return NextResponse.json({ success: true, configured: true, results });
  } catch (error) {
    console.error("[iul-intake/routing-lookup] GET", error);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }
}
