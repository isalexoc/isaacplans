import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishLeadMagnet } from "@/lib/lead-magnet-generator/sanity-publisher";
import type { LeadMagnetPublishInput } from "@/lib/lead-magnet-generator/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: LeadMagnetPublishInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { outline, generatedContent, images, pdfUrl, status, originalPromptInput } = body;

  if (!outline || !generatedContent || !images || !pdfUrl || !status || !originalPromptInput) {
    return NextResponse.json(
      { success: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    const result = await publishLeadMagnet({ outline, generatedContent, images, pdfUrl, status, originalPromptInput });
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: `Sanity publish failed: ${message}` },
      { status: 500 }
    );
  }
}
