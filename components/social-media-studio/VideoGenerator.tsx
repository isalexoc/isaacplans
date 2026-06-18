"use client";

import { VideoImageStudio } from "./VideoImageStudio";
import { runPresenterPhase } from "./runPresenterPhase";
import type {
  SocialPostSource,
  VideoScript,
  VideoStoryboard,
  GeneratedVideo,
  SocialLocale,
} from "@/lib/social-media-studio/types";

interface Props {
  source: SocialPostSource;
  videoScript?: VideoScript;
  defaultLocale: SocialLocale;
  initialVideoUrl?: string;
  initialStoryboard?: VideoStoryboard;
  onVideoReady: (video: GeneratedVideo) => void;
  /** Lifts the active storyboard so it persists on Save to Sanity. */
  onStoryboardChange: (storyboard: VideoStoryboard) => void;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Request failed");
  return data.data;
}

export function VideoGenerator({
  source,
  videoScript,
  defaultLocale,
  initialVideoUrl,
  initialStoryboard,
  onVideoReady,
  onStoryboardChange,
}: Props) {
  const category = source.category;

  return (
    <VideoImageStudio
      defaultLocale={defaultLocale}
      initialStoryboard={initialStoryboard}
      initialVideoUrl={initialVideoUrl}
      canGenerate={Boolean(videoScript?.fullScript)}
      disabledHint="Generate a video script first to enable AI video."
      onStoryboardChange={onStoryboardChange}
      generateImages={async (locale) => {
        const data = await postJson("/api/admin/social-media-studio/generate-video-images", {
          source, videoScript, locale,
        });
        return data.storyboard as VideoStoryboard;
      }}
      regenerateImage={async (concept, _sceneIndex, locale) => {
        const data = await postJson("/api/admin/social-media-studio/generate-video-image", {
          concept, category, locale,
        });
        return data.url as string;
      }}
      renderVideo={async (storyboard) => {
        // Presenter on → render the HeyGen clip first, then composite it in JSON2Video.
        const presenter = storyboard.presenter
          ? await runPresenterPhase(storyboard, storyboard.voiceLanguage)
          : {};
        const data = await postJson("/api/admin/social-media-studio/generate-video", {
          storyboard, ...presenter,
        });
        return { projectId: data.projectId as string, durationSeconds: data.durationSeconds as number };
      }}
      pollStatus={async (projectId) => {
        const url = `/api/admin/social-media-studio/generate-video/status?projectId=${encodeURIComponent(projectId)}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Render failed");
        return { status: data.data.status as string, videoUrl: data.data.videoUrl as string | undefined };
      }}
      onVideoReady={(videoUrl, projectId, durationSeconds, voiceLanguage) =>
        onVideoReady({ url: videoUrl, projectId, durationSeconds, voiceLanguage })
      }
      submitClip={async (imageUrl, imageConcept, _sceneIndex, tier, durationSec) => {
        const data = await postJson("/api/admin/social-media-studio/generate-scene-clip", {
          imageUrl, imageConcept, tier, durationSec,
        });
        return { operationName: data.operationName as string };
      }}
      pollClip={async (operationName) => {
        const url = `/api/admin/social-media-studio/generate-scene-clip/status?op=${encodeURIComponent(operationName)}${category ? `&category=${encodeURIComponent(category)}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Clip failed");
        return { status: data.data.status as string, videoUrl: data.data.videoUrl as string | undefined };
      }}
    />
  );
}
