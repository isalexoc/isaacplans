import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { listObjectionTypes, listSnippets } from "@/lib/call-study/store";
import type { CallOutcome } from "@/lib/call-study/types";

/**
 * The cross-call snippet library.
 *
 * This is the endpoint the script actually gets written from: filter every call's best lines down
 * to one category, one objection type, or only the calls that closed, and read them side by side.
 */

export const runtime = "nodejs";

const OUTCOMES = ["sold", "not_sold", "follow_up", "unknown"];

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const outcome = params.get("outcome");

    const snippets = await listSnippets(userId, {
      category: params.get("category") || undefined,
      objectionType: params.get("objectionType") || undefined,
      outcome: outcome && OUTCOMES.includes(outcome) ? (outcome as CallOutcome) : undefined,
      lineOfBusiness: params.get("lineOfBusiness") || undefined,
    });

    return NextResponse.json({
      success: true,
      snippets,
      objectionTypes: await listObjectionTypes(userId),
    });
  } catch (error) {
    console.error("[call-study/snippets] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}
