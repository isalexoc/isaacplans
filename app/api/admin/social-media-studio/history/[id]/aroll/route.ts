import { auth } from "@clerk/nextjs/server";
import { NextResponse, after } from "next/server";
import {
  MAX_AROLL_SEC,
  arollLengthProblem,
  publicIdFromUrl,
  uploadArollFromUrl,
} from "@/lib/social-media-studio/aroll";
import { createVideoJob } from "@/lib/social-media-studio/video-job-store";
import { enqueueVideoJobTick } from "@/lib/social-media-studio/video-job-queue";
import { runVideoJobInline } from "@/lib/social-media-studio/video-job-processor";
import { getSanityWriteClient } from "@/lib/social-media-studio/history-storyboard";
import type { SocialLocale, SocialStudioResponse } from "@/lib/social-media-studio/types";

export const maxDuration = 300;

type ArollRequest = {
  /** From a signed browser upload — everything Cloudinary already told the client. */
  publicId?:      string;
  videoUrl?:      string;
  durationSec?:   number;
  width?:         number;
  height?:        number;
  /** Or a URL to copy in, Cloudinary's own or anyone else's. */
  sourceUrl?:     string;
  category?:      string;
  locale?:        SocialLocale;
  brief?:         string;
  forceCrop?:     boolean;
  /** Skip transcription and use these words instead. */
  manualTranscript?: string;
};

/**
 * Start a Real Presenter ad from a recorded take.
 *
 * Two ways in, one outcome: a take hosted in our own Cloudinary folder, and a durable `aroll` job
 * that transcribes it and plans the story. Everything slow happens in the worker, so this returns
 * a jobId immediately and the studio polls it — and survives a refresh.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: ArollRequest = await req.json().catch(() => ({}) as ArollRequest);

  try {
    const upload = await resolveUpload(body);
    if ("error" in upload) {
      return NextResponse.json({ success: false, error: upload.error }, { status: 400 });
    }

    // Checked here as well as in the worker so a clip that can never work is refused while he is
    // still looking at the upload form, not two minutes into a job.
    const lengthProblem = arollLengthProblem(upload.durationSec);
    if (lengthProblem) {
      return NextResponse.json({ success: false, error: lengthProblem }, { status: 400 });
    }

    const job = await createVideoJob({
      userId,
      sanityPostId:  id,
      kind:          "aroll",
      category:      body.category ?? null,
      voiceLanguage: body.locale ?? null,
      input: {
        aRollUpload:      upload,
        brief:            body.brief,
        forceCrop:        body.forceCrop,
        manualTranscript: body.manualTranscript,
      },
      jobState: { step: "queued", progress: 0, stageLabel: "Preparing your clip" },
    });

    const origin = new URL(req.url).origin;
    const messageId = await enqueueVideoJobTick(job.id, { delaySeconds: 1, requestOrigin: origin });
    if (!messageId) after(() => runVideoJobInline(job.id, origin));

    const response: SocialStudioResponse<{ jobId: string }> = {
      success: true,
      data: { jobId: job.id },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/aroll] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

/**
 * Save hand edits to a planned ad — a nudged cut point, a rewritten concept, a different hook.
 *
 * A partial patch of the storyboard rather than a whole-document write, so an edit made while a
 * clip job is finishing cannot clobber the clip URL that job just wrote.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    hookText?: string;
    ctaText?:  string;
    scenes?:   {
      index:         number;
      startSec?:     number;
      lengthSec?:    number;
      imageConcept?: string;
      onScreenText?: string;
    }[];
  };

  try {
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.hookText !== undefined) patch["videoStoryboard.hookText"] = body.hookText.trim();
    if (body.ctaText !== undefined) patch["videoStoryboard.ctaText"] = body.ctaText.trim();

    for (const scene of body.scenes ?? []) {
      const at = `videoStoryboard.scenes[_key=="sc_${scene.index}"]`;
      if (scene.startSec !== undefined) patch[`${at}.startSec`] = scene.startSec;
      if (scene.lengthSec !== undefined) patch[`${at}.lengthSec`] = scene.lengthSec;
      if (scene.imageConcept !== undefined) patch[`${at}.imageConcept`] = scene.imageConcept.trim();
      if (scene.onScreenText !== undefined) patch[`${at}.onScreenText`] = scene.onScreenText.trim();
    }

    await getSanityWriteClient().patch(id).set(patch).commit();
    return NextResponse.json({ success: true, data: { saved: true } });
  } catch (err) {
    console.error("[history/aroll] PATCH error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}

/** Normalise both entry paths into the one record the job needs. */
async function resolveUpload(
  body: ArollRequest
): Promise<
  | { publicId: string; videoUrl: string; durationSec: number; width?: number; height?: number }
  | { error: string }
> {
  // The browser uploaded it directly and Cloudinary already answered with everything we need.
  if (body.publicId && body.videoUrl && body.durationSec) {
    return {
      publicId:    body.publicId,
      videoUrl:    body.videoUrl,
      durationSec: body.durationSec,
      width:       body.width,
      height:      body.height,
    };
  }

  const sourceUrl = body.sourceUrl?.trim();
  if (!sourceUrl) return { error: "No video was uploaded, and no URL was given to fetch one from." };
  if (!/^https?:\/\//i.test(sourceUrl)) return { error: "That doesn't look like a video URL." };

  try {
    // Copied into our own folder even when it is already a Cloudinary URL. A public id we own is
    // one that cannot be moved or deleted out from under a render, and it is what the audio and
    // 9:16 renditions are derived from.
    return await uploadArollFromUrl(sourceUrl);
  } catch (err) {
    const known = publicIdFromUrl(sourceUrl) ? "" : " Cloudinary could not fetch it.";
    return {
      error: `Could not import that video: ${(err as Error).message}.${known} It has to be a publicly reachable video file under ${MAX_AROLL_SEC / 60} minutes.`,
    };
  }
}
