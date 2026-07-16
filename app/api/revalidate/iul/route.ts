import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-demand revalidation for the IUL presentation content.
 *
 * Called by a Sanity webhook filtered to
 * `_type in ["iulPresentation", "agentLicense"]` whenever the presentation
 * document or a license is created/updated/deleted.
 *
 * Usage:
 * POST /api/revalidate/iul
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

    revalidateTag("iul-presentation");
    revalidateTag("agent-licenses");

    const paths = ["/en/iul/presentation", "/es/iul/presentacion"];
    for (const path of paths) {
      revalidatePath(path);
    }

    console.log("[REVALIDATE] IUL presentation revalidated", {
      tags: ["iul-presentation", "agent-licenses"],
      paths,
    });

    return NextResponse.json({
      revalidated: true,
      tags: ["iul-presentation", "agent-licenses"],
      paths,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[REVALIDATE] Error revalidating IUL presentation:", error);
    return NextResponse.json(
      {
        error: "Error revalidating",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
