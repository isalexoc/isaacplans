import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import type { VeoTier } from "@/lib/social-media-studio/veo";
import { createVideoJob } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline } from "@/lib/social-media-studio/video-job-processor";
import type { SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 60;

interface Body {
  imageUrl?: string;
  imageConcept?: string;
  tier?: VeoTier;
  durationSec?: 4 | 6 | 8;
  sceneIndex?: number;
  category?: string;
}

/** Kicks off a durable Veo animation job for one scene; returns the jobId to poll. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: Body = await req.json();
  if (!body.imageUrl) {
    return NextResponse.json({ success: false, error: "imageUrl is required" }, { status: 400 });
  }

  try {
    const job = await createVideoJob({
      userId,
      sanityPostId: id,
      kind:         "clip",
      category:     body.category ?? null,
      sceneIndex:   body.sceneIndex ?? 0,
      input: {
        imageUrl:        body.imageUrl,
        imageConcept:    body.imageConcept ?? "",
        tier:            body.tier,
        clipDurationSec: body.durationSec,
      },
      jobState: { step: "queued", progress: 0, stageLabel: `Animating scene ${(body.sceneIndex ?? 0) + 1}` },
    });
    const origin = new URL(req.url).origin;
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: origin });
    if (!messageId) after(() => runVideoJobInline(job.id, origin));

    const response: SocialStudioResponse<{ jobId: string }> = { success: true, data: { jobId: job.id } };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-scene-clip] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
