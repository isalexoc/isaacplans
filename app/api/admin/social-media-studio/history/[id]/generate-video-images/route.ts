import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "next-sanity";
import { buildVideoStoryboard, generateVideoSceneImages } from "@/lib/social-media-studio/video-generator";
import type {
  VideoImagesRequest,
  VideoImagesResult,
  VideoScript,
  SocialPostSource,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 300;

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

const POST_QUERY = `*[_type == "socialPost" && _id == $id][0]{
  sourceTitle, sourceCategory, sourceLocale, sourceUrl, sourceImageUrl, videoScript
}`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: VideoImagesRequest = await req.json();

  try {
    const sanity = getWriteClient();

    // Always build from the LATEST saved content so edits on the history page are honored.
    const post = await sanity.fetch(POST_QUERY, { id });
    if (!post) {
      return NextResponse.json({ success: false, error: "Post not found" }, { status: 404 });
    }
    if (!post.videoScript?.fullScript) {
      return NextResponse.json(
        { success: false, error: "This post has no video script. Add one first." },
        { status: 400 }
      );
    }

    const locale: "en" | "es" = body.locale ?? (post.sourceLocale === "es" ? "es" : "en");
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

    const storyboard = await buildVideoStoryboard(source, videoScript, locale);
    const images = await generateVideoSceneImages(storyboard, source);

    // Persist the active storyboard (used for rendering) + stack images into the library.
    const imageKeys = images.map((img, i) => ({ _key: `${Date.now().toString(36)}_${i}`, ...img }));
    await sanity
      .patch(id)
      .setIfMissing({ videoImages: [] })
      .append("videoImages", imageKeys)
      .set({
        videoStoryboard: {
          voiceLanguage:   storyboard.voiceLanguage,
          durationSeconds: storyboard.durationSeconds,
          category:        storyboard.category ?? null,
          scenes: storyboard.scenes.map((s, i) => ({
            _key:         `sc_${i}`,
            narration:    s.narration,
            onScreenText: s.onScreenText,
            imageConcept: s.imageConcept,
            imageUrl:     s.imageUrl,
          })),
        },
        updatedAt: new Date().toISOString(),
      })
      .commit();

    const response: SocialStudioResponse<VideoImagesResult> = {
      success: true,
      data: { storyboard, images },
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[history/generate-video-images] Error:", err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
