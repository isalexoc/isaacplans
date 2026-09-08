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
  loadStoryboard,
  rebuildFromLatestScript,
  persistStoryboard,
  persistArollPlan,
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
import { findReusableAsset } from "./video-asset-library";
import { detectPresenterChromaColor } from "./chroma-detect";
import { estimateSpokenSeconds } from "./script-narration";
import {
  arollAudioUrl,
  arollLengthProblem,
  needsCrop,
  warmArollDerivations,
} from "./aroll";
import { transcribeAroll } from "./aroll-transcribe";
import { wordsToSegments, timedWords } from "./aroll-words";
import { directCutaways } from "./aroll-director";
import { generateBeatImage, generateCastReference } from "./aroll-cast";
import { RenderPermanentError } from "./render/errors";
import type { ArollSource, VideoScene, VideoStoryboard, VideoImage } from "./types";
import type { ScribeWord } from "@/lib/call-study/types";
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

/** Stages for planning an A-roll ad, in the order processAroll walks them. */
export const AROLL_STAGES = ["Preparing your clip", "Transcribing", "Writing the story"];

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

/**
 * Length to assume for the presenter clip when HeyGen's status payload omits a duration.
 * Estimated from the narration (which IS the user's script), NOT the 30/60s button: that
 * button is only a target now, so falling back to it would force every such render to be
 * exactly 30s or 60s regardless of how long the script actually runs — and this number
 * drives the whole timeline (scene lengths, music length, total duration).
 */
function estimatedNarrationSeconds(sb: VideoStoryboard): number {
  const est = estimateSpokenSeconds(fullNarration(sb));
  return est > 0 ? Math.round(est * 10) / 10 : sb.durationSeconds;
}

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
    case "aroll":  return processAroll(job);
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
  let resultData = job.resultData ?? {};
  let storyboard: VideoStoryboard | undefined = resultData.storyboard ?? input.storyboard;

  // The saved storyboard has the last word whenever it is an A-roll one. The generic
  // "generate images" route does not pass a storyboard, and rebuilding one from the script
  // would replace a cut timed against a real recording with an evenly-weighted slideshow —
  // silently throwing away the whole edit. Load it instead.
  //
  // Deliberately NOT wrapped in a catch. loadStoryboard already answers null for a post that
  // has no storyboard, so the only thing a catch here could swallow is a genuine read failure —
  // and swallowing that would turn a transient Sanity blip into exactly the destructive rebuild
  // this block exists to prevent: the faceless path would run, and persistImagesResult would
  // overwrite the take, the cut, the cast and both cards with nulls. Letting it throw makes
  // processVideoJob retry the tick instead, which is the correct answer to "we could not read".
  if (!storyboard?.aRoll) {
    const saved = await loadStoryboard(job.sanityPostId);
    if (saved?.aRoll) storyboard = { ...saved, ...(input.subtitles !== undefined ? { subtitles: input.subtitles } : {}) };
  }

  // An A-roll ad arrives with its storyboard already planned by the `aroll` job, so there is
  // nothing to build here — only a cast to settle on and its shots to generate.
  const aRollMode = Boolean(storyboard?.aRoll);
  const stages = aRollMode
    ? ["Casting the story", "Generating shots"]
    : ["Planning storyboard", "Generating images"];

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
  // Never in A-roll mode, whatever the caller asked for: a library hit is a face from a
  // different post, and one of those halfway through the story undoes the cast entirely.
  const reuseAssets = Boolean(input.reuseAssets) && !aRollMode;
  const preferClipAssets = Boolean(input.preferClipAssets);
  const start = Date.now();
  let done = scenes.filter((s) => s.imageUrl).length;

  // The cast reference: one shot of the story's protagonist, generated once, that every later
  // shot of that person is matched against. Without it, two prompts describing the same woman
  // produce two different women and the ad stops reading as one story.
  let castImageUrl = storyboard.castImageUrl ?? job.jobState?.castImageUrl;
  if (aRollMode && !castImageUrl && scenes.some((s) => s.includesCast)) {
    await updateJobProgress(job.id, {
      jobState: nextState(job.jobState, { step: "images" }, stages, "Casting the story", 8),
    });
    try {
      castImageUrl = await generateCastReference({
        cast:     storyboard.castDescription ?? "",
        world:    storyboard.castWorld,
        category,
        locale:   storyboard.voiceLanguage,
      });
      storyboard = { ...storyboard, castImageUrl };
      resultData = { ...resultData, storyboard: { ...storyboard, scenes } };
      await updateJobProgress(job.id, {
        resultData,
        jobState: nextState(job.jobState, { step: "images", castImageUrl }, stages, "Generating shots", 12),
      });
    } catch (err) {
      // Losing the reference costs consistency, not the ad: every shot then generates on its
      // own, exactly as the faceless pipeline does.
      const notice = `Couldn't create the cast reference (${(err as Error).message}) — the story's shots may not all show the same person.`;
      console.warn(`[video-job] ${notice}`);
      await updateJobProgress(job.id, {
        jobState: nextState(job.jobState, { step: "images", notice }, stages, "Generating shots", 12),
      });
    }
  }

  for (let i = 0; i < total; i++) {
    if (scenes[i].imageUrl) continue;
    if (await isCancelled(job.id)) return { kind: "done" };

    // Check the cross-post library before paying to generate a fresh image (and, when a
    // cinematic clip is preferred, this can attach motion too — no manual "Animate" needed.
    if (reuseAssets) {
      const hit = await findReusableAsset({
        category,
        locale: storyboard.voiceLanguage,
        concept: scenes[i].imageConcept,
        preferClip: preferClipAssets,
        excludeImageUrls: scenes.map((s) => s.imageUrl).filter(Boolean),
      });
      if (hit) {
        scenes[i].imageUrl = hit.imageUrl;
        if (hit.videoClipUrl) scenes[i].videoClipUrl = hit.videoClipUrl;
      }
    }
    if (!scenes[i].imageUrl) {
      scenes[i].imageUrl = aRollMode
        ? await generateBeatImage({
            concept:      scenes[i].imageConcept,
            cast:         storyboard.castDescription,
            castImageUrl,
            includesCast: Boolean(scenes[i].includesCast),
            category,
            locale:       storyboard.voiceLanguage,
          })
        : await regenerateSceneImage(scenes[i].imageConcept, category, storyboard.voiceLanguage);
    }
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

  // Carry the studio's switches onto the rebuilt storyboard before it is persisted —
  // `toStoryboardDoc` writes `subtitles ?? true` / `reuseAssets ?? true`, so a freshly built
  // storyboard that omitted them would silently flip a saved "off" back to "on".
  const finalStoryboard: VideoStoryboard = {
    ...storyboard,
    scenes,
    ...(castImageUrl ? { castImageUrl } : {}),
    ...(input.subtitles   !== undefined ? { subtitles:   input.subtitles }   : {}),
    ...(input.reuseAssets !== undefined ? { reuseAssets: input.reuseAssets } : {}),
  };
  const images: VideoImage[] = scenes.map((s) => ({
    url: s.imageUrl, concept: s.imageConcept, createdAt: new Date().toISOString(),
  }));
  await persistImagesResult(job.sanityPostId, finalStoryboard, images);
  await markJobDone(job.id, null, { storyboard: finalStoryboard, images },
    nextState(job.jobState, { step: "done", itemsDone: total, itemsTotal: total }, stages, "Images ready", 100));
  return { kind: "done" };
}

// ── aroll: host the take → hear it → plan the story around it ──
//
// This is the whole "understand what he said" half of a presenter ad. It ends with a storyboard
// whose scenes are timed cutaways and whose narration is his own words; the existing `images`
// job then fills those scenes in, and `render` cuts them over him.
async function processAroll(job: VideoJobRow): Promise<StepOutcome> {
  const input = job.input ?? {};
  const upload = input.aRollUpload;
  if (!upload?.publicId) {
    return { kind: "error", error: "This job has no uploaded video to work from.", transient: false };
  }

  const lengthProblem = arollLengthProblem(upload.durationSec);
  if (lengthProblem) return { kind: "error", error: lengthProblem, transient: false };

  const stages = AROLL_STAGES;
  let state = job.jobState ?? {};
  let resultData = job.resultData ?? {};
  let storyboard = resultData.storyboard;

  // 1) Ingest — kick off the derived audio and 9:16 renditions so the render never waits on a
  //    cold transcode. Idempotent: a re-entry skips straight past it.
  if (!state.arollReady) {
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "ingest" }, stages, "Preparing your clip", 5),
    });
    await warmArollDerivations(upload.publicId, {
      width:  upload.width,
      height: upload.height,
    });
    state = { ...state, arollReady: true };
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "transcribe" }, stages, "Transcribing", 12),
    });
  }

  // 2) Transcribe — or take what he typed. Guarded by transcriptDone so a continuation tick can
  //    never pay ElevenLabs a second time for the same take.
  if (!state.transcriptDone) {
    const built = await buildArollSource(job, upload, input.manualTranscript);
    if (!built.ok) return { kind: "error", error: built.error, transient: built.transient };

    storyboard = {
      ...(storyboard ?? emptyArollStoryboard(job, built.data)),
      aRoll:         built.data,
      voiceLanguage: built.data.language,
    };
    resultData = { ...resultData, storyboard };
    state = { ...state, transcriptDone: true };
    await updateJobProgress(job.id, {
      resultData,
      jobState: nextState(state, { step: "direct" }, stages, "Writing the story", 45),
    });
  }

  if (!storyboard?.aRoll) {
    return { kind: "error", error: "The transcript step finished without a usable take.", transient: true };
  }
  if (await isCancelled(job.id)) return { kind: "done" };

  // 3) Direct — GPT proposes the cutaways, deterministic validation disposes.
  const aRoll = storyboard.aRoll;
  const loaded = await loadSourceAndScript(job.sanityPostId, aRoll.language).catch(() => null);
  const { direction, notice } = await directCutaways({
    words:       arollWords(aRoll),
    segments:    aRoll.segments,
    durationSec: aRoll.durationSec,
    language:    aRoll.language,
    category:    job.category ?? storyboard.category ?? undefined,
    title:       loaded?.source.title,
    brief:       input.brief,
  });

  const scenes: VideoScene[] = direction.beats.map((beat) => ({
    narration:    beat.narration,
    onScreenText: beat.onScreenText,
    imageConcept: beat.imageConcept,
    imageUrl:     "",
    role:         "broll",
    startSec:     beat.startSec,
    lengthSec:    Math.round((beat.endSec - beat.startSec) * 100) / 100,
    includesCast: beat.includesCast,
  }));

  const planned: VideoStoryboard = {
    ...storyboard,
    scenes,
    castDescription: direction.cast || storyboard.castDescription,
    castWorld:       direction.world || storyboard.castWorld,
    hookText:        direction.hookText || storyboard.hookText,
    ctaText:         direction.ctaText || storyboard.ctaText,
  };

  await persistArollPlan(job.sanityPostId, planned, { transcript: aRoll.transcript });
  await markJobDone(
    job.id,
    null,
    { storyboard: planned, images: [] },
    nextState(state, { step: "done", ...(notice ? { notice } : {}) }, stages, "Story ready", 100),
  );
  return { kind: "done" };
}

/**
 * Word timings for the snapper, rebuilt from the persisted segments.
 *
 * The raw word stream is deliberately not kept — it is ten times the size of the segments and is
 * only ever needed inside this job. Segment boundaries are real sentence boundaries, which are
 * the best cut points anyway, so snapping against them loses almost nothing.
 */
function arollWords(aRoll: ArollSource): ScribeWord[] {
  return aRoll.segments.map((seg) => ({
    text:  seg.text,
    start: seg.start,
    end:   seg.end,
    type:  "word" as const,
  }));
}

/** Transcribe the take (or accept a typed transcript) and assemble the ArollSource record. */
async function buildArollSource(
  job: VideoJobRow,
  upload: NonNullable<NonNullable<VideoJobRow["input"]>["aRollUpload"]>,
  manualTranscript?: string,
): Promise<{ ok: true; data: ArollSource } | { ok: false; error: string; transient: boolean }> {
  const audioUrl = arollAudioUrl(upload.publicId);
  const base = {
    videoUrl:    upload.videoUrl,
    publicId:    upload.publicId,
    audioUrl,
    durationSec: upload.durationSec,
    width:       upload.width,
    height:      upload.height,
  };

  // A typed transcript wins outright — it is only ever set because he wanted to correct or
  // replace what the machine heard.
  if (manualTranscript?.trim()) {
    const text = manualTranscript.trim();
    return {
      ok: true,
      data: {
        ...base,
        language:   job.voiceLanguage === "es" ? "es" : "en",
        transcript: text,
        segments:   evenSegments(text, upload.durationSec),
      },
    };
  }

  const result = await transcribeAroll(audioUrl);
  if (!result.ok) {
    // Not retried into oblivion. A transcript is the one thing that cannot be invented, so the
    // job fails with the provider's own message and the studio offers a box to type it in.
    return { ok: false, error: result.error, transient: false };
  }

  const words = timedWords(result.data.words);
  return {
    ok: true,
    data: {
      ...base,
      language:   result.data.language,
      transcript: result.data.text,
      segments:   words.length
        ? wordsToSegments(result.data.words)
        : evenSegments(result.data.text, upload.durationSec),
    },
  };
}

/**
 * Spread text evenly across the take when there are no real word timings.
 *
 * Only reached on the manual-transcript path, or a transcript that came back without timings.
 * The cut points it produces are approximate, which is exactly why the studio lets him nudge
 * every one of them.
 */
function evenSegments(text: string, durationSec: number): ArollSource["segments"] {
  const sentences = text.split(/(?<=[.!?])\s+/).map((t) => t.trim()).filter(Boolean);
  if (!sentences.length) return [];
  const totalWords = sentences.reduce((n, t) => n + t.split(/\s+/).length, 0) || 1;

  let elapsed = 0;
  return sentences.map((sentence) => {
    const share = (sentence.split(/\s+/).length / totalWords) * durationSec;
    const segment = { text: sentence, start: round1(elapsed), end: round1(elapsed + share) };
    elapsed += share;
    return segment;
  });
}

/** A storyboard shell for a take we have only just heard — the direct step adds the scenes. */
function emptyArollStoryboard(job: VideoJobRow, aRoll: ArollSource): VideoStoryboard {
  return {
    scenes:          [],
    voiceLanguage:   aRoll.language,
    // Present only because the type demands one of two literals. The finished ad is exactly as
    // long as the recording, and nothing in A-roll mode reads this.
    durationSeconds: aRoll.durationSec > 45 ? 60 : 30,
    category:        job.category ?? undefined,
    subtitles:       true,
    // Off by default: a library image from another post would drop a stranger's face into the
    // middle of this story and undo the whole point of the cast reference.
    reuseAssets:     false,
    aRoll,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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
      sceneIndex,
    });
    await updateJobProgress(job.id, {
      jobState: nextState(state, { step: "poll", veoOperationName: operationName }, stages, label, 10),
    });
    return { kind: "continue", delaySeconds: 8 };
  }

  const res = await getSceneClipStatus(state.veoOperationName, category, {
    imageUrl:        input.imageUrl,
    imageConcept:    input.imageConcept,
    clipDurationSec: input.clipDurationSec,
    sourcePostId:    job.sanityPostId,
  });
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
  //
  // NEVER for an A-roll ad. There the recording is the source of truth, not the text: the saved
  // script is a transcript OF it, and re-deriving the storyboard from that text would replace
  // the timed cutaways with an evenly-weighted slideshow and throw the edit away.
  if (!state.scriptSynced && !storyboard.aRoll) {
    const synced = await rebuildFromLatestScript(job.sanityPostId, storyboard);
    if (synced !== storyboard) {
      await updateJobInput(job.id, { ...input, storyboard: synced });
      storyboard = synced;
    }
    state = { ...state, scriptSynced: true };
    await updateJobProgress(job.id, { jobState: state });
  }

  // A recorded take IS the presenter — the HeyGen phase has nothing to add and no script to say.
  const wantsPresenter =
    !storyboard.aRoll &&
    Boolean(storyboard.presenter && input.presenter !== false) &&
    !state.presenterDropped;
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
        avatarId:   storyboard.presenterAvatarId,
        voiceId:    storyboard.presenterVoiceId,
        avatarType: storyboard.presenterAvatarType,
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
      // Sample the clip's real background so the keyer targets the actual green — a custom
      // photo avatar's baked-in green is nowhere near the #00FF00 stock avatars render on.
      const chroma = st.url ? await detectPresenterChromaColor(st.url) : null;
      await updateJobProgress(job.id, {
        jobState: nextState(state, {
          step: "compose",
          presenterVideoUrl: st.url,
          presenterDurationSec: st.durationSeconds ?? estimatedNarrationSeconds(storyboard),
          ...(chroma ? { presenterChromaColor: chroma } : {}),
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
    ? {
        url:         state.presenterVideoUrl!,
        durationSec: state.presenterDurationSec ?? estimatedNarrationSeconds(finalStoryboard),
        chromaColor: state.presenterChromaColor,
      }
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
