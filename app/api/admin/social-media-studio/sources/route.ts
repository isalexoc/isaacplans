import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchSourceList } from "@/lib/social-media-studio/source-fetcher";
import type { SocialStudioResponse } from "@/lib/social-media-studio/types";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" } satisfies SocialStudioResponse<never>,
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const q        = searchParams.get("q")        ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const locale   = searchParams.get("locale")   ?? "en";
  const limit    = parseInt(searchParams.get("limit") ?? "30", 10);

  try {
    const data = await fetchSourceList({ q, category, locale, limit });
    return NextResponse.json({ success: true, data } satisfies SocialStudioResponse<typeof data>);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message } satisfies SocialStudioResponse<never>,
      { status: 500 }
    );
  }
}
