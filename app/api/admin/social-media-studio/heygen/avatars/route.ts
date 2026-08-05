import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listHeyGenAvatars, findHeyGenAvatarById } from "@/lib/social-media-studio/heygen-presenter";

// HeyGen's /v2/avatars can take ~60s+ to respond (server-side, not payload size), so the
// first uncached fetch needs generous headroom. Subsequent calls hit the cached catalog.
export const maxDuration = 120;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  // ?id= → resolve one avatar by its exact HeyGen id (for "I made my own avatar").
  const id = searchParams.get("id")?.trim();
  if (id) {
    try {
      const avatar = await findHeyGenAvatarById(id);
      return NextResponse.json({ success: true, data: { avatar } });
    } catch (err) {
      console.error("[heygen/avatars] id lookup error:", err);
      return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
    }
  }

  const search = searchParams.get("search") ?? undefined;
  const gender = searchParams.get("gender") ?? undefined;
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit  = Math.min(80, Math.max(1, Number(searchParams.get("limit") ?? 40) || 40));

  try {
    const { avatars, total } = await listHeyGenAvatars(search, gender, offset, limit);
    return NextResponse.json({ success: true, data: { avatars, total, offset, limit } });
  } catch (err) {
    console.error("[heygen/avatars] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
