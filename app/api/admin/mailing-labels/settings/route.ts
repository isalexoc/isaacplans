import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getMailingLabelSettings,
  saveMailingLabelSettings,
} from "@/lib/mailing-labels/settings";

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getMailingLabelSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[admin/mailing-labels/settings] GET", error);
    return NextResponse.json(
      { success: false, error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const result = await saveMailingLabelSettings({
      sender: body?.sender,
      defaults: body?.defaults,
    });

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: result });
  } catch (error) {
    console.error("[admin/mailing-labels/settings] PUT", error);
    return NextResponse.json(
      { success: false, error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
