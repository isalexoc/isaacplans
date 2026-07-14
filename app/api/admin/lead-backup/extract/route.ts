import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getLeadsTheWayConfig } from "@/lib/leads-the-way/config";
import { extractLeadFromScreenshot } from "@/lib/leads-the-way/extract-screenshot";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { success: false, error: "OPENAI_API_KEY is not configured" },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No screenshot provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Use a JPEG, PNG, or WebP screenshot" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "Screenshot must be 10 MB or smaller" },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    const parsed = await extractLeadFromScreenshot(dataUrl, getLeadsTheWayConfig());
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: "Could not read the lead from the screenshot. Try a clearer image." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, parsed });
  } catch (error) {
    console.error("[admin/lead-backup/extract]", error);
    return NextResponse.json(
      { success: false, error: "Failed to read the screenshot" },
      { status: 500 }
    );
  }
}
