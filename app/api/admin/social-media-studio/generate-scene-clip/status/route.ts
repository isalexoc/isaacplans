import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSceneClipStatus } from "@/lib/social-media-studio/veo";

// Re-hosting the finished clip on Cloudinary happens here, so allow headroom.
export const maxDuration = 120;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const op       = searchParams.get("op");
  const category = searchParams.get("category") ?? undefined;
  if (!op) return NextResponse.json({ success: false, error: "op (operation name) is required" }, { status: 400 });

  try {
    const result = await getSceneClipStatus(op, category);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[generate-scene-clip/status] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
