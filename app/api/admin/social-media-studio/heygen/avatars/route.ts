import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listHeyGenAvatars } from "@/lib/social-media-studio/heygen-presenter";

export const maxDuration = 30;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
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
