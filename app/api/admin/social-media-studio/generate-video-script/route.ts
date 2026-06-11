import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateVideoScript } from "@/lib/social-media-studio/script-generator";
import type {
  VideoScriptRequest,
  VideoScript,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: VideoScriptRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json(
      { success: false, error: "source.title is required" },
      { status: 400 }
    );
  }

  if (body.duration !== 30 && body.duration !== 60) {
    return NextResponse.json(
      { success: false, error: "duration must be 30 or 60" },
      { status: 400 }
    );
  }

  try {
    const script = await generateVideoScript(body);
    const response: SocialStudioResponse<{ script: VideoScript }> = {
      success: true,
      data:    { script },
    };
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
