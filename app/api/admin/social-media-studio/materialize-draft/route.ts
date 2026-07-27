import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { materializeSocialPostDraft } from "@/lib/social-media-studio/sanity-publisher";
import type { SocialPostSource, VideoScript, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 30;

interface Body {
  source?: SocialPostSource;
  videoScript?: VideoScript;
}

/**
 * Create a minimal draft socialPost so a wizard-initiated video generation has a stable
 * document id to key durable jobs on. The wizard's final Save updates this same draft
 * (via publish `existingId`), so no duplicate document is created.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const body: Body = await req.json();
  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: "SANITY_API_WRITE_TOKEN is not configured" }, { status: 400 });
  }

  try {
    const { id } = await materializeSocialPostDraft({ source: body.source, videoScript: body.videoScript });
    const response: SocialStudioResponse<{ id: string }> = { success: true, data: { id } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[social-media-studio/materialize-draft] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
