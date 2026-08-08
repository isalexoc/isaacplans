import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteMailingLabels, updateMailingLabel } from "@/lib/mailing-labels/server";

type RouteContext = { params: Promise<{ id: string }> };

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const label = await updateMailingLabel(id, body?.label ?? {});
    if (!label) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not save. Check that the street address, city, state, and ZIP code are all filled in.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, label });
  } catch (error) {
    console.error("[admin/mailing-labels/:id] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to update label" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const deleted = await deleteMailingLabels([id]);
    if (deleted === 0) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/mailing-labels/:id] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to delete label" }, { status: 500 });
  }
}
