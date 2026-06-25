import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { distillVideo } from "@/lib/script-generator/youtube-distiller";
import { isLineOfBusiness } from "@/lib/script-generator/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let url: unknown;
  let lineOfBusiness: unknown;
  try {
    const body = await request.json();
    url = body?.url;
    lineOfBusiness = body?.lineOfBusiness;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: false, error: "url is required" }, { status: 400 });
  }
  if (!isLineOfBusiness(lineOfBusiness)) {
    return NextResponse.json({ success: false, error: "Invalid lineOfBusiness" }, { status: 400 });
  }

  try {
    const data = await distillVideo(url, lineOfBusiness);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected error during distillation";
    console.error("[script-generator/distill]", err);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
