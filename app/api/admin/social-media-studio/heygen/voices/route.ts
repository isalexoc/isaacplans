import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listHeyGenVoices } from "@/lib/social-media-studio/heygen-presenter";

// HeyGen's catalog endpoints are slow (~60s) on the first uncached fetch — give headroom.
export const maxDuration = 120;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? undefined;
  const gender   = searchParams.get("gender") ?? undefined;
  const search   = searchParams.get("search") ?? undefined;

  try {
    const { voices, languages } = await listHeyGenVoices({ language, gender, search });
    return NextResponse.json({ success: true, data: { voices, languages } });
  } catch (err) {
    console.error("[heygen/voices] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
