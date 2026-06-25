import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { publishScript } from "@/lib/script-generator/sanity-publisher";
import {
  isLineOfBusiness,
  type GeneratedScript,
} from "@/lib/script-generator/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    en?: GeneratedScript;
    es?: GeneratedScript;
    lineOfBusiness?: unknown;
    title?: unknown;
    description?: unknown;
    status?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const { en, es, lineOfBusiness, title, description, status } = body;

  if (!en?.sections || !es?.sections) {
    return NextResponse.json(
      { success: false, error: "Both English and Spanish script content are required" },
      { status: 400 }
    );
  }
  if (!isLineOfBusiness(lineOfBusiness)) {
    return NextResponse.json({ success: false, error: "Invalid lineOfBusiness" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ success: false, error: "title is required" }, { status: 400 });
  }

  const publishStatus = status === "published" ? "published" : "draft";

  try {
    const data = await publishScript({
      en,
      es,
      lineOfBusiness,
      title,
      description: typeof description === "string" ? description : "",
      status: publishStatus,
    });
    // Bust the /presentations 1-hour cache so a published script shows immediately.
    revalidateTag("presentation-scripts");
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during publish";
    console.error("[script-generator/publish]", err);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
