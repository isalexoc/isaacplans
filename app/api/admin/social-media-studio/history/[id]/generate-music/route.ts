import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { generateCategoryMusic } from "@/lib/social-media-studio/music-generator";

export const maxDuration = 60;

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

const POST_QUERY = `*[_type == "socialPost" && _id == $id][0]{
  sourceCategory, "duration": videoStoryboard.durationSeconds
}`;

interface Body {
  durationSeconds?: number;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: Body = await req.json().catch(() => ({}));

  try {
    const sanity = getWriteClient();
    const post = await sanity.fetch(POST_QUERY, { id });
    const durationSeconds = body.durationSeconds ?? post?.duration ?? 30;

    const { musicUrl } = await generateCategoryMusic({
      category: post?.sourceCategory,
      durationSeconds,
    });

    await sanity
      .patch(id)
      .set({ "videoStoryboard.musicUrl": musicUrl, updatedAt: new Date().toISOString() })
      .commit()
      .catch((e) => console.warn("[history/generate-music] persist failed:", (e as Error).message));

    return NextResponse.json({ success: true, data: { musicUrl } });
  } catch (err) {
    console.error("[history/generate-music] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
