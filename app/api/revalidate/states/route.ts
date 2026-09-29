import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-demand revalidation for licensed states.
 *
 * Called by a Sanity webhook filtered to `_type == "state"` whenever a state
 * document is created/updated/deleted.
 *
 * Without this, every state edit in Studio waits out the 1 hour `revalidate`
 * on the `states`-tagged fetches in `lib/licensed-states.ts` before it shows
 * up anywhere — the admin license picker, the state landing pages, the map,
 * and the "{count}+ states" copy in the hero and footer.
 *
 * Usage:
 * POST /api/revalidate/states
 * Headers: Authorization: Bearer <REVALIDATION_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.REVALIDATION_SECRET;

    if (!expectedToken) {
      console.error("[REVALIDATE] REVALIDATION_SECRET is not set in environment variables");
      return NextResponse.json(
        { error: "Revalidation secret not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Every state consumer (getLicensedStates, getLicensedStateCount,
    // getStatesWithPages) shares this one tag, so a single call covers them all.
    revalidateTag("states");

    // The state landing pages are `force-dynamic` and pick the new data up on
    // the next request; the sitemap is statically cached, so bust it directly.
    revalidatePath("/sitemap.xml");

    console.log("[REVALIDATE] Licensed states revalidated", {
      tags: ["states"],
      paths: ["/sitemap.xml"],
    });

    return NextResponse.json({
      revalidated: true,
      tags: ["states"],
      paths: ["/sitemap.xml"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[REVALIDATE] Error revalidating licensed states:", error);
    return NextResponse.json(
      {
        error: "Error revalidating",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
