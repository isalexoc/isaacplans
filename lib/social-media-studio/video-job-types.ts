import type { VideoStoryboard, SocialLocale, VideoImage } from "./types";
import type { VeoTier } from "./veo";

/**
 * Durable, resumable video-generation jobs (Neon `social_video_jobs`), driven by a
 * QStash worker. One row = one long-running generation action, so the browser can
 * close/refresh and reattach to a running job by polling its DB-persisted `jobState`.
 *
 * @see lib/social-media-studio/video-job-store.ts   (state transitions)
 * @see lib/social-media-studio/video-job-processor.ts (the state machine)
 */

/** Which pipeline action this job runs. */
export type SocialVideoJobKind = "images" | "clip" | "render" | "music";

/** Lifecycle status (mirrors the call-summary / social-publish tables). */
export type SocialVideoJobStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

/** Coarse stage within a job (drives the UI stage checklist). */
export type SocialVideoJobStep =
  | "queued"
  // images
  | "storyboard"
  | "images"
  // clip / music
  | "submit"
  | "poll"
  // render
  | "presenter"
  | "compose"
  | "render"
  | "finalize"
  | "done";

/**
 * Progress + resume state, persisted after every step so a re-entry (client refresh,
 * QStash continuation tick, or reconcile) resumes exactly where it left off.
 */
export type SocialVideoJobState = {
  step?: SocialVideoJobStep;
  stepIndex?: number;   // 0-based index into the mode's stage list
  stepCount?: number;   // total stages for this job (for "Stage 2 of 4")
  stages?: string[];    // ordered stage labels (so the UI can render a checklist)
  stageLabel?: string;  // human label for the active stage
  progress?: number;    // overall 0–100 (worker-computed; client just renders it)
  itemsDone?: number;   // fine-grained (e.g. images generated)
  itemsTotal?: number;
  notice?: string;      // non-fatal warning (e.g. presenter failed → faceless)
  // provider handles (persisted so we never resubmit on re-entry → idempotent)
  presenterVideoId?: string;
  presenterVideoUrl?: string;
  presenterDurationSec?: number;
  presenterChromaColor?: string; // background colour sampled off the clip (photo-avatar greens
                                 // are a muted ~#53BD5F, not the #00FF00 stock avatars get)
  presenterDropped?: boolean; // presenter failed → fell back to a faceless render
  renderProjectId?: string;
  veoOperationName?: string;
  durationSeconds?: number;
  lastError?: string;
  scriptSynced?: boolean; // render already re-synced its narration to the latest saved script (once per job)
};

/** Self-contained inputs the worker needs (so it never depends on client state). */
export type SocialVideoJobInput = {
  storyboard?: VideoStoryboard;   // render (with presenter/cinematic flags), or images-after-build
  locale?: SocialLocale;          // images
  presenter?: boolean;            // render — whether to run the HeyGen phase
  reuseAssets?: boolean;          // images — check the asset library before generating each scene
  preferClipAssets?: boolean;     // images — when reusing, prefer a match that already has a Veo clip
  subtitles?: boolean;            // images — carry the studio's caption switch onto the rebuilt
                                  // storyboard, so a rebuild can't silently reset it back to on
  // clip
  imageUrl?: string;
  imageConcept?: string;
  tier?: VeoTier;
  clipDurationSec?: 4 | 6 | 8;
  // music
  durationSeconds?: number;
};

/** `resultData` shape for the `images` job (lets a re-entry skip already-built scenes). */
export type SocialVideoImagesResult = {
  storyboard?: VideoStoryboard;
  images?: VideoImage[];
};

/** Compact view returned by the status/resume endpoints and consumed by the UI. */
export type SocialVideoJobView = {
  id: string;
  kind: SocialVideoJobKind;
  status: SocialVideoJobStatus;
  sceneIndex: number | null;
  jobState: SocialVideoJobState | null;
  resultUrl: string | null;
  resultData: SocialVideoImagesResult | null;
  errorMessage: string | null;
};

export const ACTIVE_VIDEO_JOB_STATUSES: SocialVideoJobStatus[] = ["pending", "processing"];
