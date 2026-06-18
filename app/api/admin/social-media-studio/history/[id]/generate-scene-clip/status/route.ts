import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { getSceneClipStatus } from "@/lib/social-media-studio/veo";

export const maxDuration = 120;

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const op         = searchParams.get("op");
  const category   = searchParams.get("category") ?? undefined;
  const sceneIndex = searchParams.get("sceneIndex");
  if (!op) return NextResponse.json({ success: false, error: "op (operation name) is required" }, { status: 400 });

  try {
    const result = await getSceneClipStatus(op, category);

    // Persist the finished clip onto the saved storyboard scene so a re-render / reload uses it.
    if (result.status === "done" && result.videoUrl && sceneIndex !== null) {
      await getWriteClient()
        .patch(id)
        .set({ [`videoStoryboard.scenes[_key=="sc_${sceneIndex}"].videoClipUrl`]: result.videoUrl, updatedAt: new Date().toISOString() })
        .commit()
        .catch((e) => console.warn("[history/generate-scene-clip/status] persist failed:", (e as Error).message));
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[history/generate-scene-clip/status] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
