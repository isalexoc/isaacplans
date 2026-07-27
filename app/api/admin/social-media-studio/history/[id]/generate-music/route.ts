import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import { createClient } from "next-sanity";
import { createVideoJob } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline } from "@/lib/social-media-studio/video-job-processor";
import type { SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

function getReadClient() {
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

/** Kicks off a durable music-generation job; returns the jobId to poll. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: Body = await req.json().catch(() => ({}));

  try {
    const post = await getReadClient().fetch(POST_QUERY, { id });
    const durationSeconds = body.durationSeconds ?? post?.duration ?? 30;
    const category: string | undefined = post?.sourceCategory ?? undefined;

    const job = await createVideoJob({
      userId,
      sanityPostId: id,
      kind:         "music",
      category:     category ?? null,
      input:        { durationSeconds },
      jobState:     { step: "queued", progress: 0, stageLabel: "Composing music" },
    });
    const origin = new URL(req.url).origin;
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: origin });
    if (!messageId) after(() => runVideoJobInline(job.id, origin));

    const response: SocialStudioResponse<{ jobId: string }> = { success: true, data: { jobId: job.id } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-music] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
