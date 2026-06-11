import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishSocialPost } from "@/lib/social-media-studio/sanity-publisher";
import type {
  SocialPostPublishRequest,
  PublishedSocialPost,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: SocialPostPublishRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json(
      { success: false, error: "source.title is required" },
      { status: 400 }
    );
  }
  if (!body.copies?.length) {
    return NextResponse.json(
      { success: false, error: "copies array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json(
      { success: false, error: "SANITY_API_WRITE_TOKEN is not configured" },
      { status: 400 }
    );
  }

  try {
    const result = await publishSocialPost(body);
    const response: SocialStudioResponse<PublishedSocialPost> = {
      success: true,
      data:    result,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[social-media-studio/publish] Error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
