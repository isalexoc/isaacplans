import {
  getVideoJob,
  claimVideoJob,
  updateJobProgress,
  updateJobInput,
  markJobDone,
  markJobFailed,
  type VideoJobRow,
} from "./video-job-store";
import {
  loadSourceAndScript,
  rebuildFromLatestScript,
  persistStoryboard,
  persistImagesResult,
  persistVideoUrl,
  persistSceneClip,
  persistMusicUrl,
} from "./history-storyboard";
import {
  buildVideoStoryboard,
  regenerateSceneImage,
  submitVideoRender,
  getVideoRenderStatus,
} from "./video-generator";
import { submitPresenterVideo, getPresenterStatus } from "./heygen-presenter";
import { submitSceneClip, getSceneClipStatus } from "./veo";
import { generateCategoryMusic } from "./music-generator";
import { RenderPermanentError } from "./render/errors";
import type { VideoStoryboard, VideoImage } from "./types";
import type { SocialVideoJobState } from "./video-job-types";

/**
 * The durable video-generation worker. Runs ONE unit of work per invocation and reports
 * whether the job needs another tick (`continue`) or is terminal (`done`) — the QStash
 * delivery endpoint publishes the next tick. Every step persists `jobState` first, so a
 * refresh / continuation / reconcile resumes exactly where it left off. Idempotency guards
 * (never resubmit when a provider id already exists) make re-entry safe.
 */
export type ProcessVideoJobResult =
  | { kind: "done" }                                   // terminal (done/failed/cancelled/skip)
  | { kind: "continue"; delaySeconds: number }         // schedule another tick
  | { kind: "retry"; delaySeconds: number; error: string }; // transient failure w/ backoff

// A step handler either advances (continue), finishes (done), or signals an error.
type StepOutcome =
  | { kind: "done" }
  | { kind: "continue"; delaySeconds: number }
  | { kind: "error"; error: string; transient: boolean };

const BUDGET_MS = 200_000; // per-invocation soft budget (well under the 300s route limit)

// ── progress helpers ────────────────────────────────────────────────────────
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));
const ramp = (current: number | undefined, min: number, max: number, inc: number) =>
  clamp(Math.min(max, Math.max(min, (current ?? min) + inc)), 0, 100);
const lerp = (min: number, max: number, frac: number) => clamp(min + (max - min) * Math.max(0, Math.min(1, frac)));

export function renderStages(presenter: boolean): string[] {
  return presenter
    ? ["Preparing", "Rendering avatar", "Composing", "Rendering video", "Finalizing"]
    : ["Preparing", "Composing", "Rendering video", "Finalizing"];
}

/** Build the next jobState from a base + patch, computing stage metadata for the UI. */
function nextState(
  base: SocialVideoJobState | null | undefined,
  patch: Partial<SocialVideoJobState>,
  stages: string[],
  stageLabel: string,
  progress: number,
): SocialVideoJobState {
  const stepIndex = Math.max(0, stages.indexOf(stageLabel));
  return {
    ...(base ?? {}),
    ...patch,
    stages,
    stageLabel,
    stepIndex,
    stepCount: stages.length,
    progress: clamp(progress),
  };
}

const fullNarration = (sb: VideoStoryboard) =>
  sb.scenes.map((s) => s.narration.trim()).filter(Boolean).join(" ");

// ── main entry ──────────────────────────────────────────────────────────────
export async function processVideoJob(jobId: string): Promise<ProcessVideoJobResult> {
  const job = await getVideoJob(jobId);
  if (!job) return { kind: "done" };
  if (job.status === "done" || job.status === "cancelled") return { kind: "done" };

  // First tick (pending) or a retry (failed) → claim. A continuation tick is already `processing`.
  let current = job;
  if (job.status === "pending" || job.status === "failed") {
    const claimed = await claimVideoJob(jobId);
    if (!claimed) return { kind: "done" }; // lost the race / not claimable
    current = claimed;
  }

  try {
    const outcome = await dispatch(current);
    if (outcome.kind === "continue" || outcome.kind === "done") return outcome;

    // outcome.kind === "error"
    if (!outcome.transient) {
      // Permanent → terminal failure (no more retries).
      await markJobFailed(
        jobId,
        outcome.error,
        1_000_000, // force past MAX so it stays terminally failed
        { ...(current.jobState ?? {}), lastError: outcome.error },
      );
      return { kind: "done" };
    }
    return failTransient(current, outcome.error);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video job failed";
    // Config/auth errors (bad or mismatched provider key) never succeed on retry — fail now.
    if (err instanceof RenderPermanentError) {
      await markJobFailed(jobId, msg, 1_000_000, { ...(current.jobState ?? {}), lastError: msg });
      return { kind: "done" };
    }
    return failTransient(current, msg);
  }
}

async function failTransient(job: VideoJobRow, error: string): Promise<ProcessVideoJobResult> {
  const { retryable, nextRetryAt } = await markJobFailed(
    job.id,
    error,
    job.attemptCount,
    { ...(job.jobState ?? {}), lastError: error },
  );
  if (!retryable) return { kind: "done" };
  const delaySeconds = Math.max(1, Math.ceil(((nextRetryAt?.getTime() ?? Date.now()) - Date.now()) / 1000));
  return { kind: "retry", delaySeconds, error };
}

/**
 * Fallback runner for when QStash is unavailable (local dev, or a failed publish): drive a
 * job to completion inside a single request lifetime via `after()`. Bounded by a wall-clock
 * budget so it never outlives the serverless function; the reconcile cron resumes any remainder.
 */
export async function runVideoJobInline(jobId: string, _requestOrigin?: string): Promise<void> {
  const startedAt = Date.now();
  const MAX_MS = 280_000;
  for (;;) {
    let result: ProcessVideoJobResult;
    try {
      result = await processVideoJob(jobId);
    } catch (err) {
      console.error("[video-job] inline runner error", { jobId, error: (err as Error).message });
      return;
    }
    if (result.kind === "done") return;
    if (Date.now() - startedAt > MAX_MS) return;
    const delay = "delaySeconds" in result ? result.delaySeconds : 1;
    await new Promise((r) => setTimeout(r, Math.min(delay, 10) * 1000));
  }
}

function dispatch(job: VideoJobRow): Promise<StepOutcome> {
  switch (job.kind) {
    case "images": return processImages(job);
    case "clip":   return processClip(job);
    case "render": return processRender(job);
    case "music":  return processMusic(job);
    default:       return Promise.resolve({ kind: "error", error: `Unknown job kind: ${job.kind}`, transient: false });
  }
}

// Re-read status so a mid-flight Cancel stops long loops promptly.
async function isCancelled(jobId: string): Promise<boolean> {
  const row = await getVideoJob(jobId);
  return !row || row.status === "cancelled";
}

// ── images: build storyboard → generate one image per scene (idempotent, budgeted) ──
async function processImages(job: VideoJobRow): Promise<StepOutcome> {
  const input = job.input ?? {};
  const stages = ["Planning storyboard", "Generating images"];
  let resultData = job.resultData ?? {};
  let storyboard: VideoStoryboard | undefined = resultData.storyboard ?? input.storyboard;

  if (!storyboard) {
    await updateJobProgress(job.id, {
      jobState: nextState(job.jobState, { step: "storyboard" }, stages, "Planning storyboard", 5),
    });
    const preferredLocale = input.locale ?? (job.voiceLanguage === "es" ? "es" : job.voiceLanguage === "en" ? "en" : undefined);
    const loaded = await loadSourceAndScript(job.sanityPostId, preferredLocale);
    if (!loaded) return { kind: "error", error: "This post has no video script. Add one first.", transient: false };
    storyboard = await buildVideoStoryboard(loaded.source, loaded.videoScript, loaded.locale);
    resultData = { ...resultData, storyboard };
    await updateJobProgress(job.id, {
      resultData,
      jobState: nextState(job.jobState, { step: "images" }, stages, "Generating images", 10),
    });
  }

  const scenes = storyboard.scenes.map((s) => ({ ...s }));
  const total = scenes.length;
  const category = job.category ?? storyboard.category ?? "general";
  const start = Date.now();
  let done = scenes.filter((s) => s.imageUrl).length;

  for (let i = 0; i < total; i++) {
    if (scenes[i].imageUrl) continue;
    if (await isCancelled(job.id)) return { kind: "done" };

    scenes[i].imageUrl = await regenerateSceneImage(scenes[i].imageConcept, category, storyboard.voiceLanguage);
    done++;
    resultData = { ...resultData, storyboard: { ...storyboard, scenes } };
    await updateJobProgress(job.id, {
      resultData,
      jobState: nextState(job.jobState, { step: "images", itemsDone: done, itemsTotal: total },
        stages, "Generating images", lerp(10, 92, done / total)),
    });

    if (Date.now() - start > BUDGET_MS && done < total) {
      return { kind: "continue", delaySeconds: 1 };
    }
  }

  const finalStoryboard: VideoStoryboard = { ...storyboard, scenes };
  const images: VideoImage[] = scenes.map((s) => ({
    url: s.imageUrl, concept: s.imageConcept, createdAt: new Date().toISOString(),
  }));
  await persistImagesResult(job.sanityPostId, finalStoryboard, images);
  await markJobDone(job.id, null, { storyboard: finalStoryboard, images },
    nextState(job.jobState, { step: "done", itemsDone: total, itemsTotal: total }, stages, "Images ready", 100));
  return { kind: "done" };
}

// ── clip: submit one Veo op → poll → persist onto the scene ──
async function processClip(job: VideoJobRow): Promise<StepOutcome> {
  const input = job.input ?? {};
  const state = job.jobState ?? {};
  const stages = ["Animating scene"];
  const category = job.category ?? undefined;
  const sceneIndex = job.sceneIndex ?? 0;
  const label = `Animating scene ${sceneIndex + 1}`;

  if (!state.veoOperationName) {
    if (!input.imageUrl) return { kind: "error", error: "Clip job missing imageUrl", transient: false };
    const { operationName } = await submitSceneClip({
      imageUrl:     input.imageUrl,
      imageConcept: input.imageConcept ?? "",
      tier:         input.tier,
      durationSec:  input.clipDurationSec,
    });
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "poll", veoOperationName: operationName }, stages, label, 10),
    });
    return { kind: "continue", delaySeconds: 8 };
  }

  const res = await getSceneClipStatus(state.veoOperationName, category);
  if (res.status !== "done") {
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "poll" }, stages, label, ramp(state.progress, 10, 90, 6)),
    });
    return { kind: "continue", delaySeconds: 8 };
  }
  if (!res.videoUrl) return { kind: "error", error: "Veo finished without a clip URL", transient: true };

  await persistSceneClip(job.sanityPostId, sceneIndex, res.videoUrl);
  await markJobDone(job.id, res.videoUrl, null, nextState(state, { step: "done" }, stages, label, 100));
  return { kind: "done" };
}

// ── music: single synchronous ElevenLabs call ──
async function processMusic(job: VideoJobRow): Promise<StepOutcome> {
  const input = job.input ?? {};
  const stages = ["Composing music"];
  const { musicUrl } = await generateCategoryMusic({
    category: job.category ?? undefined,
    durationSeconds: input.durationSeconds ?? 30,
  });
  await persistMusicUrl(job.sanityPostId, musicUrl);
  await markJobDone(job.id, musicUrl, null, nextState(job.jobState, { step: "done" }, stages, "Music ready", 100));
  return { kind: "done" };
}

// ── render: sync narration → presenter (optional) → compose → render poll → finalize ──
async function processRender(job: VideoJobRow): Promise<StepOutcome> {
  const input = job.input ?? {};
  let storyboard = input.storyboard;
  if (!storyboard?.scenes?.length) return { kind: "error", error: "Render job missing a storyboard", transient: false };
  const category = job.category ?? storyboard.category ?? undefined;
  let state = job.jobState ?? {};

  // Once per job: make sure the narration matches the LATEST saved script (keeping the
  // existing images/clips) before doing anything else — covers presenter (so HeyGen speaks
  // the current script) and faceless renders alike. A no-op (no GPT call) when the script
  // hasn't changed since this storyboard's narration was built.
  if (!state.scriptSynced) {
    const synced = await rebuildFromLatestScript(job.sanityPostId, storyboard);
    if (synced !== storyboard) {
      await updateJobInput(job.id, { ...input, storyboard: synced });
      storyboard = synced;
    }
    state = { ...state, scriptSynced: true };
    await updateJobProgress(job.id, { jobState: state });
  }

  const wantsPresenter = Boolean(storyboard.presenter && input.presenter !== false) && !state.presenterDropped;
  const step = (["presenter", "compose", "render"] as const).includes(state.step as never)
    ? (state.step as "presenter" | "compose" | "render")
    : (wantsPresenter ? "presenter" : "compose");

  if (step === "presenter") return handlePresenter(job, storyboard, state);
  if (step === "compose")   return handleCompose(job, storyboard, category, state);
  return handleRenderPoll(job, category, state);
}

async function handlePresenter(job: VideoJobRow, storyboard: VideoStoryboard, state: SocialVideoJobState): Promise<StepOutcome> {
  const stages = renderStages(true);

  // 1) submit
  if (!state.presenterVideoId && !state.presenterVideoUrl) {
    try {
      const { videoId } = await submitPresenterVideo(fullNarration(storyboard), storyboard.voiceLanguage, {
        avatarId: storyboard.presenterAvatarId, voiceId: storyboard.presenterVoiceId,
      });
      await updateJobProgress(job.id, {
        jobState: nextState(state, { step: "presenter", presenterVideoId: videoId }, stages, "Rendering avatar", 12),
      });
      return { kind: "continue", delaySeconds: 5 };
    } catch (err) {
      return fallbackToFaceless(job, state, err as Error);
    }
  }

  // 2) poll
  if (!state.presenterVideoUrl) {
    try {
      const st = await getPresenterStatus(state.presenterVideoId!);
      if (st.status !== "done") {
        await updateJobProgress(job.id, {
          jobState: nextState(state, { step: "presenter" }, stages, "Rendering avatar", ramp(state.progress, 12, 42, 2)),
        });
        return { kind: "continue", delaySeconds: 5 };
      }
      await updateJobProgress(job.id, {
        jobState: nextState(state, {
          step: "compose",
          presenterVideoUrl: st.url,
          presenterDurationSec: st.durationSeconds ?? storyboard.durationSeconds,
        }, stages, "Composing", 46),
      });
      return { kind: "continue", delaySeconds: 1 };
    } catch (err) {
      return fallbackToFaceless(job, state, err as Error);
    }
  }

  // presenter clip ready → compose
  await updateJobProgress(job.id, {
    jobState: nextState(state, { step: "compose" }, stages, "Composing", 46),
  });
  return { kind: "continue", delaySeconds: 1 };
}

async function fallbackToFaceless(job: VideoJobRow, state: SocialVideoJobState, err: Error): Promise<StepOutcome> {
  const notice = `${err.message} — rendering without the avatar.`;
  const stages = renderStages(false);
  await updateJobProgress(job.id, {
    jobState: nextState(state, {
      step: "compose",
      presenterDropped: true,
      notice,
      presenterVideoId: undefined,
      presenterVideoUrl: undefined,
    }, stages, "Composing", 12),
  });
  return { kind: "continue", delaySeconds: 1 };
}

async function handleCompose(
  job: VideoJobRow,
  storyboard: VideoStoryboard,
  category: string | undefined,
  state: SocialVideoJobState,
): Promise<StepOutcome> {
  const presenterActive = !state.presenterDropped && Boolean(state.presenterVideoUrl);
  const stages = renderStages(presenterActive);

  // Idempotency: if a render was already submitted, jump straight to polling.
  if (state.renderProjectId) {
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "render" }, stages, "Rendering video", stages.length === 5 ? 56 : 26),
    });
    return { kind: "continue", delaySeconds: 3 };
  }

  // Narration is already synced to the latest saved script (see processRender). If the
  // presenter got dropped this run (HeyGen failure → faceless fallback), record that so the
  // studio doesn't show the presenter toggle still on for a video that actually rendered faceless.
  const finalStoryboard = presenterActive ? storyboard : { ...storyboard, presenter: false };
  await persistStoryboard(job.sanityPostId, finalStoryboard);

  const presenter = presenterActive
    ? { url: state.presenterVideoUrl!, durationSec: state.presenterDurationSec ?? finalStoryboard.durationSeconds }
    : undefined;
  const { projectId } = await submitVideoRender(finalStoryboard, presenter);

  await updateJobProgress(job.id, {
    jobState: nextState(state, { step: "render", renderProjectId: projectId },
      stages, "Rendering video", stages.length === 5 ? 56 : 26),
  });
  return { kind: "continue", delaySeconds: 4 };
}

async function handleRenderPoll(job: VideoJobRow, category: string | undefined, state: SocialVideoJobState): Promise<StepOutcome> {
  const presenterActive = !state.presenterDropped && Boolean(state.presenterVideoUrl);
  const stages = renderStages(presenterActive);
  const min = stages.length === 5 ? 56 : 26;
  const projectId = state.renderProjectId;
  if (!projectId) return { kind: "error", error: "Render poll reached without a project id", transient: false };

  const res = await getVideoRenderStatus(projectId, category);
  if (res.status !== "done") {
    const pct = typeof res.progress === "number"
      ? lerp(min, 96, res.progress / 100)
      : ramp(state.progress, min, 96, 2);
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "render" }, stages, "Rendering video", pct),
    });
    return { kind: "continue", delaySeconds: 4 };
  }
  if (!res.videoUrl) return { kind: "error", error: "Render finished without a video URL", transient: true };

  await persistVideoUrl(job.sanityPostId, res.videoUrl);
  await markJobDone(job.id, res.videoUrl, null, nextState(state, { step: "done" }, stages, "Finalizing", 100));
  return { kind: "done" };
}
