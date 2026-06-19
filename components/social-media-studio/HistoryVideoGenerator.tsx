"use client";

import { VideoImageStudio } from "./VideoImageStudio";
import { runPresenterPhase } from "./runPresenterPhase";
import type { SocialLocale, VideoStoryboard } from "@/lib/social-media-studio/types";

/** Sanity-shaped video script (uses `onScreenText`, optional fields). */
export interface SanityVideoScript {
  duration?: number;
  hookScript?: string;
  fullScript?: string;
  onScreenText?: string[];
  suggestedCaption?: string;
}

interface Props {
  postId: string;
  sourceCategory?: string;
  sourceLocale: SocialLocale;
  videoScript?: SanityVideoScript;
  initialVideoUrl?: string;
  initialStoryboard?: VideoStoryboard;
  /** Lifts the finished video URL up so the publish section can auto-fill YouTube. */
  onVideoReady: (url: string) => void;
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

export function HistoryVideoGenerator({
  postId,
  sourceCategory,
  sourceLocale,
  videoScript,
  initialVideoUrl,
  initialStoryboard,
  onVideoReady,
}: Props) {
  const base = `/api/admin/social-media-studio/history/${postId}`;

  return (
    <VideoImageStudio
      defaultLocale={sourceLocale}
      initialStoryboard={initialStoryboard}
      initialVideoUrl={initialVideoUrl}
      canGenerate={Boolean(videoScript?.fullScript)}
      disabledHint="This post has no video script yet."
      generateImages={async (locale) => {
        // Server fetches the latest saved script/source from Sanity.
        const data = await postJson(`${base}/generate-video-images`, { locale });
        return data.storyboard as VideoStoryboard;
      }}
      regenerateImage={async (concept, sceneIndex, locale) => {
        const data = await postJson(`${base}/generate-video-image`, {
          concept, category: sourceCategory, locale, sceneIndex,
        });
        return data.url as string;
      }}
      renderVideo={async (storyboard) => {
        // Presenter on → render the HeyGen clip first, then composite it in JSON2Video.
        // If the presenter render fails (e.g. HeyGen plan time quota), fall back to a faceless
        // render so the user never loses the whole video — and report why via `notice`.
        let presenter: { presenterVideoUrl?: string; presenterDurationSec?: number } = {};
        let notice: string | undefined;
        if (storyboard.presenter) {
          try {
            presenter = await runPresenterPhase(storyboard, storyboard.voiceLanguage);
          } catch (err) {
            notice = `${err instanceof Error ? err.message : "Presenter render failed"} — rendered the video without the avatar.`;
            presenter = {}; // no presenter clip → server renders faceless (images + voiceover + captions + music)
          }
        }
        const data = await postJson(`${base}/generate-video`, { storyboard, ...presenter });
        return { projectId: data.projectId as string, durationSeconds: data.durationSeconds as number, notice };
      }}
      pollStatus={async (projectId) => {
        const url = `${base}/generate-video/status?projectId=${encodeURIComponent(projectId)}${sourceCategory ? `&category=${encodeURIComponent(sourceCategory)}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Render failed");
        return { status: data.data.status as string, videoUrl: data.data.videoUrl as string | undefined };
      }}
      onVideoReady={(videoUrl) => onVideoReady(videoUrl)}
      submitClip={async (imageUrl, imageConcept, _sceneIndex, tier, durationSec) => {
        const data = await postJson(`${base}/generate-scene-clip`, { imageUrl, imageConcept, tier, durationSec });
        return { operationName: data.operationName as string };
      }}
      pollClip={async (operationName, sceneIndex) => {
        const url = `${base}/generate-scene-clip/status?op=${encodeURIComponent(operationName)}&sceneIndex=${sceneIndex}${sourceCategory ? `&category=${encodeURIComponent(sourceCategory)}` : ""}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Clip failed");
        return { status: data.data.status as string, videoUrl: data.data.videoUrl as string | undefined };
      }}
      generateMusic={async (durationSeconds) => {
        const data = await postJson(`${base}/generate-music`, { durationSeconds });
        return data.musicUrl as string;
      }}
    />
  );
}
