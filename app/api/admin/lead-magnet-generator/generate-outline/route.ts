import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateLeadMagnetOutline } from "@/lib/lead-magnet-generator/outline-generator";
import type {
  LeadMagnetApiResponse,
  LeadMagnetOutline,
  LeadMagnetPromptInput,
} from "@/lib/lead-magnet-generator/types";

export const maxDuration = 300;

export async function POST(
  request: NextRequest
): Promise<NextResponse<LeadMagnetApiResponse<LeadMagnetOutline>>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let promptInput: LeadMagnetPromptInput;
  try {
    const body = await request.json();
    promptInput = body?.promptInput;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (
    !promptInput ||
    !promptInput.topic ||
    !promptInput.category ||
    !promptInput.targetAudience ||
    !Array.isArray(promptInput.keyTopics) ||
    promptInput.keyTopics.length === 0 ||
    !promptInput.tone
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "promptInput is required and must include topic, category, targetAudience, keyTopics, and tone",
      },
      { status: 400 }
    );
  }

  try {
    const data = await generateLeadMagnetOutline(promptInput);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected error during outline generation";
    console.error("[lead-magnet-generator/generate-outline]", err);
    const status = message.includes("not configured") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
