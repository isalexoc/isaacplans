"use client";

import { VideoImageStudio } from "./VideoImageStudio";
import type { SocialLocale, VideoStoryboard } from "@/lib/social-media-studio/types";
import type { SocialVideoJobView } from "@/lib/social-media-studio/video-job-types";

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

/**
 * History-page wiring for the video studio. Every long-running step is a durable QStash
 * job (kicked here, polled from the DB), so generation survives a refresh/close and reports
 * staged progress. The server worker owns the presenter → compose → render pipeline.
 */
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
      startImages={async (locale, opts) => {
        const data = await postJson(`${base}/generate-video-images`, { locale, ...opts });
        return { jobId: data.jobId as string };
      }}
      regenerateImage={async (concept, sceneIndex, locale) => {
        const data = await postJson(`${base}/generate-video-image`, {
          concept, category: sourceCategory, locale, sceneIndex,
        });
        return data.url as string;
      }}
      startRender={async (storyboard) => {
        const data = await postJson(`${base}/generate-video`, { storyboard });
        return { jobId: data.jobId as string };
      }}
      onVideoReady={(videoUrl) => onVideoReady(videoUrl)}
      startClip={async (imageUrl, imageConcept, sceneIndex, tier, durationSec) => {
        const data = await postJson(`${base}/generate-scene-clip`, {
          imageUrl, imageConcept, sceneIndex, tier, durationSec, category: sourceCategory,
        });
        return { jobId: data.jobId as string };
      }}
      startMusic={async (durationSeconds) => {
        const data = await postJson(`${base}/generate-music`, { durationSeconds });
        return { jobId: data.jobId as string };
      }}
      pollJob={async (jobId) => {
        const res = await fetch(`${base}/video-job/${jobId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Job status failed");
        return data.data as SocialVideoJobView;
      }}
      cancelJob={async (jobId) => {
        await fetch(`${base}/video-job/${jobId}/cancel`, { method: "POST" });
      }}
      findActiveJobs={async () => {
        const res = await fetch(`${base}/video-jobs`);
        const data = await res.json();
        if (!data.success) return [];
        return (data.data.jobs ?? []) as SocialVideoJobView[];
      }}
    />
  );
}
