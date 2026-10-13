import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteIllustrationSummary, updateIllustrationPresentation } from "@/lib/illustration-studio/store";
import { firstIssue, updateRequestSchema } from "@/lib/illustration-studio/validate";

type RouteContext = { params: Promise<{ id: string }> };

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const parsed = updateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: firstIssue(parsed.error) }, { status: 400 });
    }

    const { id } = await context.params;
    const summary = await updateIllustrationPresentation(id, parsed.data.presentation);
    if (!summary) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error("[admin/illustration-studio/:id] PATCH", error);
    return NextResponse.json({ success: false, error: "Couldn't save your changes." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!(await deleteIllustrationSummary(id, userId))) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/illustration-studio/:id] DELETE", error);
    return NextResponse.json({ success: false, error: "Couldn't delete this summary." }, { status: 500 });
  }
}
