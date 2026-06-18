import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { submitPresenterVideo } from "@/lib/social-media-studio/heygen-presenter";
import type {
  VideoStoryboard,
  SocialLocale,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 60;

interface Body {
  narration?: string;       // full narration text (preferred)
  storyboard?: VideoStoryboard; // fallback: concatenate scene narration server-side
  locale?: SocialLocale;
  avatarId?: string;        // in-app picked avatar (overrides env default)
  voiceId?: string;         // in-app picked voice (overrides env default)
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: Body = await req.json();
  const locale: SocialLocale = body.locale ?? body.storyboard?.voiceLanguage ?? "en";
  const narration =
    body.narration?.trim() ||
    body.storyboard?.scenes.map((s) => s.narration.trim()).filter(Boolean).join(" ");

  if (!narration) {
    return NextResponse.json(
      { success: false, error: "No narration provided for the presenter." },
      { status: 400 }
    );
  }

  const avatarId = body.avatarId || body.storyboard?.presenterAvatarId;
  const voiceId  = body.voiceId  || body.storyboard?.presenterVoiceId;

  try {
    const { videoId } = await submitPresenterVideo(narration, locale, { avatarId, voiceId });
    const response: SocialStudioResponse<{ presenterVideoId: string }> = {
      success: true,
      data: { presenterVideoId: videoId },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[generate-presenter] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
