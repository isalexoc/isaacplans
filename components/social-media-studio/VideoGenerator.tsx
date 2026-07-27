"use client";

import { useRef } from "react";
import { VideoImageStudio } from "./VideoImageStudio";
import type {
  SocialPostSource,
  VideoScript,
  VideoStoryboard,
  GeneratedVideo,
  SocialLocale,
} from "@/lib/social-media-studio/types";
import type { SocialVideoJobView } from "@/lib/social-media-studio/video-job-types";

interface Props {
  source: SocialPostSource;
  videoScript?: VideoScript;
  defaultLocale: SocialLocale;
  initialVideoUrl?: string;
  initialStoryboard?: VideoStoryboard;
  onVideoReady: (video: GeneratedVideo) => void;
  /** Lifts the active storyboard so it persists on Save to Sanity. */
  onStoryboardChange: (storyboard: VideoStoryboard) => void;
  /**
   * Materialize (once) a draft socialPost and return its id — durable video jobs need a
   * stable document id to key on. Idempotent: returns the same id on repeat calls.
   */
  ensurePostId: () => Promise<string>;
  /** The draft id if one already exists (enables resume-on-mount + progress polling). */
  currentPostId?: string;
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
 * Creation-wizard wiring for the video studio. Because the wizard has no saved post yet,
 * it materializes a draft on first generation, then uses the same durable history-style
 * job routes (progress + resume + cancel) as the history page.
 */
export function VideoGenerator({
  source,
  videoScript,
  defaultLocale,
  initialVideoUrl,
  initialStoryboard,
  onVideoReady,
  onStoryboardChange,
  ensurePostId,
  currentPostId,
}: Props) {
  const category = source.category;
  const postIdRef = useRef<string | null>(currentPostId ?? null);

  async function base(): Promise<string> {
    if (!postIdRef.current) postIdRef.current = await ensurePostId();
    return `/api/admin/social-media-studio/history/${postIdRef.current}`;
  }

  return (
    <VideoImageStudio
      defaultLocale={defaultLocale}
      initialStoryboard={initialStoryboard}
      initialVideoUrl={initialVideoUrl}
      canGenerate={Boolean(videoScript?.fullScript)}
      disabledHint="Generate a video script first to enable AI video."
      onStoryboardChange={onStoryboardChange}
      startImages={async (locale) => {
        const data = await postJson(`${await base()}/generate-video-images`, { locale });
        return { jobId: data.jobId as string };
      }}
      regenerateImage={async (concept, sceneIndex, locale) => {
        const data = await postJson(`${await base()}/generate-video-image`, {
          concept, category, locale, sceneIndex,
        });
        return data.url as string;
      }}
      startRender={async (storyboard) => {
        const data = await postJson(`${await base()}/generate-video`, { storyboard });
        return { jobId: data.jobId as string };
      }}
      onVideoReady={(videoUrl, jobId, durationSeconds, voiceLanguage) =>
        onVideoReady({ url: videoUrl, projectId: jobId, durationSeconds, voiceLanguage })
      }
      startClip={async (imageUrl, imageConcept, sceneIndex, tier, durationSec) => {
        const data = await postJson(`${await base()}/generate-scene-clip`, {
          imageUrl, imageConcept, sceneIndex, tier, durationSec, category,
        });
        return { jobId: data.jobId as string };
      }}
      startMusic={async (durationSeconds) => {
        const data = await postJson(`${await base()}/generate-music`, { durationSeconds });
        return { jobId: data.jobId as string };
      }}
      pollJob={async (jobId) => {
        const res = await fetch(`${await base()}/video-job/${jobId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error ?? "Job status failed");
        return data.data as SocialVideoJobView;
      }}
      cancelJob={async (jobId) => {
        await fetch(`${await base()}/video-job/${jobId}/cancel`, { method: "POST" });
      }}
      findActiveJobs={async () => {
        // Don't materialize a draft just to look for jobs — only poll if one already exists.
        if (!postIdRef.current) return [];
        const res = await fetch(`/api/admin/social-media-studio/history/${postIdRef.current}/video-jobs`);
        const data = await res.json();
        if (!data.success) return [];
        return (data.data.jobs ?? []) as SocialVideoJobView[];
      }}
    />
  );
}
