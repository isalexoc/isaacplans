import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  fetchBlogPostContent,
  fetchLeadMagnetContent,
} from "@/lib/social-media-studio/source-fetcher";
import type {
  SocialPostSource,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" } satisfies SocialStudioResponse<never>,
      { status: 401 }
    );
  }

  const { type, id } = await params;

  try {
    let source: SocialPostSource;

    if (type === "blog_post") {
      source = await fetchBlogPostContent(id);
    } else if (type === "lead_magnet") {
      source = await fetchLeadMagnetContent(id);
    } else {
      return NextResponse.json(
        { success: false, error: `Unknown source type: ${type}` } satisfies SocialStudioResponse<never>,
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: true, data: source } satisfies SocialStudioResponse<SocialPostSource>
    );
  } catch (err) {
    const message = (err as Error).message;
    const status  = message.includes("not found") ? 404 : 500;
    return NextResponse.json(
      { success: false, error: message } satisfies SocialStudioResponse<never>,
      { status }
    );
  }
}
