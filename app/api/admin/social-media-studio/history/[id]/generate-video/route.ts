import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { buildVideoStoryboard, submitVideoRender } from "@/lib/social-media-studio/video-generator";
import type {
  VideoRenderRequest,
  VideoStoryboard,
  VideoScript,
  SocialPostSource,
  SocialStudioResponse,
  SocialLocale,
} from "@/lib/social-media-studio/types";

// Decoupled render prep (ElevenLabs TTS + Whisper captions + Cloudinary uploads for every
// scene) runs synchronously before the render is submitted, so allow the longer window.
export const maxDuration = 300;

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
  sourceTitle, sourceCategory, sourceLocale, sourceUrl, videoScript
}`;

// Rebuild scene narration from the latest saved script while KEEPING the curated images
// (mapped by index, reused cyclically if the scene count changed). This guarantees the
// video always speaks the user's most recently edited script.
async function rebuildFromLatestScript(
  id: string,
  current: VideoStoryboard
): Promise<VideoStoryboard> {
  const sanity = getWriteClient();
  const post = await sanity.fetch(POST_QUERY, { id });
  if (!post?.videoScript?.fullScript) return current; // nothing saved → keep as-is

  const locale: SocialLocale = current.voiceLanguage;
  const source: SocialPostSource = {
    type:      "direct_topic",
    title:     post.sourceTitle ?? "",
    category:  post.sourceCategory,
    locale,
    publicUrl: post.sourceUrl,
  };
  const videoScript: VideoScript = {
    duration:                post.videoScript.duration === 60 ? 60 : 30,
    hookScript:              post.videoScript.hookScript ?? "",
    fullScript:              post.videoScript.fullScript ?? "",
    onScreenTextSuggestions: post.videoScript.onScreenText ?? [],
    brollSuggestions:        [],
    voiceoverTips:           "",
    suggestedCaption:        post.videoScript.suggestedCaption ?? "",
  };

  const fresh = await buildVideoStoryboard(source, videoScript, locale);
  const images = current.scenes.map((s) => s.imageUrl).filter(Boolean);
  if (images.length === 0) return current;
  const clips = current.scenes.map((s) => s.videoClipUrl);

  // Fresh narration + concepts, but reuse the existing images (and cinematic clips) by index.
  fresh.scenes = fresh.scenes.map((scene, i) => ({
    ...scene,
    imageUrl:     images[i] ?? images[i % images.length],
    videoClipUrl: clips[i],
  }));
  fresh.musicUrl = current.musicUrl;
  fresh.presenter = current.presenter;
  fresh.presenterPlacement = current.presenterPlacement;
  fresh.presenterAvatarId = current.presenterAvatarId;
  fresh.presenterAvatarName = current.presenterAvatarName;
  fresh.presenterVoiceId = current.presenterVoiceId;
  fresh.presenterVoiceName = current.presenterVoiceName;
  fresh.cinematic = current.cinematic;
  fresh.veoTier = current.veoTier;
  fresh.veoDurationSec = current.veoDurationSec;

  // Persist the refreshed active storyboard.
  await sanity.patch(id).set({ videoStoryboard: toStoryboardDoc(fresh), updatedAt: new Date().toISOString() }).commit();

  return fresh;
}

// Full Sanity representation of a storyboard (used to persist faceless rebuilds + presenter renders).
function toStoryboardDoc(sb: VideoStoryboard) {
  return {
    voiceLanguage:       sb.voiceLanguage,
    durationSeconds:     sb.durationSeconds,
    category:            sb.category ?? null,
    musicUrl:            sb.musicUrl ?? null,
    presenter:           sb.presenter ?? false,
    presenterPlacement:  sb.presenterPlacement ?? null,
    presenterAvatarId:   sb.presenterAvatarId ?? null,
    presenterAvatarName: sb.presenterAvatarName ?? null,
    presenterVoiceId:    sb.presenterVoiceId ?? null,
    presenterVoiceName:  sb.presenterVoiceName ?? null,
    cinematic:           sb.cinematic ?? false,
    veoTier:             sb.veoTier ?? null,
    veoDurationSec:      sb.veoDurationSec ?? null,
    scenes: sb.scenes.map((s, i) => ({
      _key:         `sc_${i}`,
      narration:    s.narration,
      onScreenText: s.onScreenText,
      imageConcept: s.imageConcept,
      imageUrl:     s.imageUrl,
      videoClipUrl: s.videoClipUrl ?? null,
    })),
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: VideoRenderRequest = await req.json();
  let storyboard = body.storyboard;

  if (!storyboard?.scenes?.length) {
    return NextResponse.json(
      { success: false, error: "A storyboard with scenes is required. Generate the video images first." },
      { status: 400 }
    );
  }
  if (storyboard.scenes.some((s) => !s.imageUrl)) {
    return NextResponse.json(
      { success: false, error: "Every scene needs an image. Re-run the image step." },
      { status: 400 }
    );
  }

  const presenter =
    storyboard.presenter && body.presenterVideoUrl && body.presenterDurationSec
      ? { url: body.presenterVideoUrl, durationSec: body.presenterDurationSec }
      : undefined;

  try {
    // Faceless renders rebuild narration from the latest saved script (presenter renders
    // already have their HeyGen audio generated from the client storyboard, so keep as-is).
    if (!storyboard.presenter) {
      storyboard = await rebuildFromLatestScript(id, storyboard);
    } else {
      // Presenter render keeps the client narration (HeyGen audio matches it) — persist the
      // full storyboard so the presenter pick, cinematic clips, and images all survive a reload.
      await getWriteClient()
        .patch(id)
        .set({ videoStoryboard: toStoryboardDoc(storyboard), updatedAt: new Date().toISOString() })
        .commit()
        .catch((e) => console.warn("[history/generate-video] presenter persist failed:", (e as Error).message));
    }

    const { projectId } = await submitVideoRender(storyboard, presenter);

    const response: SocialStudioResponse<{
      projectId: string;
      durationSeconds: number;
      voiceLanguage: SocialLocale;
    }> = {
      success: true,
      data: { projectId, durationSeconds: storyboard.durationSeconds, voiceLanguage: storyboard.voiceLanguage },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
