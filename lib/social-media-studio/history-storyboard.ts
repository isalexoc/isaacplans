import { createClient, type SanityClient } from "next-sanity";
import { resyncStoryboardNarration, hashScript } from "./video-generator";
import type {
  VideoStoryboard,
  VideoScript,
  VideoImage,
  SocialPostSource,
  SocialLocale,
} from "./types";

/**
 * Shared Sanity persistence for the video pipeline on the history page.
 *
 * Extracted from the (now thin) generate-video / generate-video-images routes so the
 * durable QStash worker (video-job-processor.ts) writes results with identical shapes.
 */

export function getSanityWriteClient(): SanityClient {
  if (!process.env.SANITY_API_WRITE_TOKEN) throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  return createClient({
    projectId:  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:    process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

/** Full Sanity representation of a storyboard (persist faceless rebuilds + presenter renders). */
export function toStoryboardDoc(sb: VideoStoryboard) {
  return {
    voiceLanguage:       sb.voiceLanguage,
    durationSeconds:     sb.durationSeconds,
    category:            sb.category ?? null,
    musicUrl:            sb.musicUrl ?? null,
    presenter:           sb.presenter ?? false,
    presenterPlacement:  sb.presenterPlacement ?? null,
    presenterAvatarId:   sb.presenterAvatarId ?? null,
    presenterAvatarName: sb.presenterAvatarName ?? null,
    presenterAvatarType: sb.presenterAvatarType ?? null,
    presenterVoiceId:    sb.presenterVoiceId ?? null,
    presenterVoiceName:  sb.presenterVoiceName ?? null,
    subtitles:           sb.subtitles ?? true,
    cinematic:           sb.cinematic ?? false,
    veoTier:             sb.veoTier ?? null,
    veoDurationSec:      sb.veoDurationSec ?? null,
    scriptHash:          sb.scriptHash ?? null,
    reuseAssets:         sb.reuseAssets ?? true,
    // A-roll: null rather than omitted, so switching a post back to a faceless render actually
    // clears the take instead of leaving a stale one that would re-trigger presenter mode.
    aRoll:               sb.aRoll
      ? {
          ...sb.aRoll,
          // Sanity requires a _key on every item of an object array, or the patch is rejected.
          segments: (sb.aRoll.segments ?? []).map((seg, i) => ({ ...seg, _key: `sg_${i}` })),
        }
      : null,
    castImageUrl:        sb.castImageUrl ?? null,
    castDescription:     sb.castDescription ?? null,
    castWorld:           sb.castWorld ?? null,
    hookText:            sb.hookText ?? null,
    ctaText:             sb.ctaText ?? null,
    scenes: sb.scenes.map((s, i) => ({
      _key:         `sc_${i}`,
      narration:    s.narration,
      onScreenText: s.onScreenText,
      imageConcept: s.imageConcept,
      imageUrl:     s.imageUrl,
      videoClipUrl: s.videoClipUrl ?? null,
      role:         s.role ?? null,
      startSec:     s.startSec ?? null,
      lengthSec:    s.lengthSec ?? null,
      includesCast: s.includesCast ?? null,
    })),
  };
}

const SOURCE_QUERY = `*[_type == "socialPost" && _id == $id][0]{
  sourceTitle, sourceCategory, sourceLocale, sourceUrl, sourceImageUrl, videoScript
}`;

/** Rebuild the { source, videoScript, locale } inputs from the latest saved post. */
export async function loadSourceAndScript(
  id: string,
  preferredLocale?: SocialLocale,
): Promise<{ source: SocialPostSource; videoScript: VideoScript; locale: SocialLocale } | null> {
  const sanity = getSanityWriteClient();
  const post = await sanity.fetch(SOURCE_QUERY, { id });
  if (!post?.videoScript?.fullScript) return null;

  const locale: SocialLocale = preferredLocale ?? (post.sourceLocale === "es" ? "es" : "en");
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
  return { source, videoScript, locale };
}

/**
 * The storyboard as it is currently saved on the post.
 *
 * Needed because an A-roll storyboard cannot be re-derived: its scenes are cutaways timed against
 * a recording, and the saved script is a transcript OF that recording rather than its source. Any
 * job that would otherwise rebuild from the script has to load this instead.
 */
export async function loadStoryboard(id: string): Promise<VideoStoryboard | null> {
  const sanity = getSanityWriteClient();
  const doc = await sanity.fetch(`*[_type == "socialPost" && _id == $id][0].videoStoryboard`, { id });
  if (!doc) return null;
  return {
    ...doc,
    voiceLanguage: doc.voiceLanguage === "es" ? "es" : "en",
    scenes: (doc.scenes ?? []).map((s: Record<string, unknown>) => ({
      narration:    (s.narration as string) ?? "",
      onScreenText: (s.onScreenText as string) ?? "",
      imageConcept: (s.imageConcept as string) ?? "",
      imageUrl:     (s.imageUrl as string) ?? "",
      videoClipUrl: (s.videoClipUrl as string) ?? undefined,
      role:         s.role === "broll" ? ("broll" as const) : undefined,
      startSec:     (s.startSec as number) ?? undefined,
      lengthSec:    (s.lengthSec as number) ?? undefined,
      includesCast: (s.includesCast as boolean) ?? undefined,
    })),
  } as VideoStoryboard;
}

/** Hash of the currently-saved script, or null if the post has none yet. Cheap — no GPT call. */
export async function latestScriptHash(id: string, locale?: SocialLocale): Promise<string | null> {
  const loaded = await loadSourceAndScript(id, locale);
  return loaded ? hashScript(loaded.videoScript) : null;
}

/**
 * Re-derive scene narration from the LATEST SAVED SCRIPT while keeping the curated images
 * (mapped by index, reused cyclically if the scene count changed), cinematic clips and every
 * render setting. This is what guarantees the rendered video always speaks the script the
 * user last saved — presenter or faceless alike.
 *
 * `resyncStoryboardNarration` is deterministic (no GPT unless the voiceover language differs
 * from the script's own language), so this is now free and instant, and — critically — it
 * cannot introduce words the script does not contain. It used to re-run the GPT "video
 * director", which re-paraphrased the script on every single render.
 *
 * Returns `current` BY REFERENCE when nothing needs to change (callers compare identity).
 */
export async function rebuildFromLatestScript(
  id: string,
  current: VideoStoryboard,
): Promise<VideoStoryboard> {
  const loaded = await loadSourceAndScript(id, current.voiceLanguage);
  if (!loaded) return current;
  if (current.scriptHash && current.scriptHash === hashScript(loaded.videoScript)) return current;
  if (current.scenes.every((s) => !s.imageUrl)) return current;

  const fresh = await resyncStoryboardNarration(current, loaded.videoScript);
  if (fresh === current) return current;

  await persistStoryboard(id, fresh);
  return fresh;
}

/** Persist the active storyboard document (presenter/faceless render prep). */
export async function persistStoryboard(id: string, sb: VideoStoryboard): Promise<void> {
  await getSanityWriteClient()
    .patch(id)
    .set({ videoStoryboard: toStoryboardDoc(sb), updatedAt: new Date().toISOString() })
    .commit()
    .catch((e) => console.warn("[history-storyboard] persistStoryboard failed:", (e as Error).message));
}

/**
 * Persist a planned A-roll ad: the storyboard, and the transcript written in as the post's
 * video script.
 *
 * Writing the transcript to `videoScript.fullScript` is what lets the REST of the studio work
 * unchanged on a presenter ad — copy generation, the history list, the detail page and the
 * publishing flow all read that field, and what he said on camera is exactly the script they
 * would otherwise have generated. The render path deliberately does NOT re-derive the storyboard
 * from it (see processRender): here the recording is the source of truth, not the text.
 */
export async function persistArollPlan(
  id: string,
  sb: VideoStoryboard,
  opts: { transcript: string; title?: string } = { transcript: "" }
): Promise<void> {
  const patch: Record<string, unknown> = {
    videoStoryboard: toStoryboardDoc(sb),
    sourceType:      "presenter_video",
    sourceLocale:    sb.voiceLanguage,
    updatedAt:       new Date().toISOString(),
  };
  if (opts.transcript.trim()) {
    patch.videoScript = {
      duration:         sb.durationSeconds,
      hookScript:       firstSentence(opts.transcript),
      fullScript:       opts.transcript.trim(),
      suggestedCaption: "",
    };
  }
  if (opts.title?.trim()) patch.sourceTitle = opts.title.trim();

  await getSanityWriteClient()
    .patch(id)
    .set(patch)
    .commit()
    .catch((e) => console.warn("[history-storyboard] persistArollPlan failed:", (e as Error).message));
}

/** The opening line of the take — a serviceable hook for the post's script record. */
function firstSentence(text: string): string {
  const match = /^[\s\S]{10,180}?[.!?](\s|$)/.exec(text.trim());
  return (match ? match[0] : text.trim().slice(0, 160)).trim();
}

/** Persist a freshly built storyboard + append the generated images into the library. */
export async function persistImagesResult(
  id: string,
  storyboard: VideoStoryboard,
  images: VideoImage[],
): Promise<void> {
  const imageKeys = images.map((img, i) => ({ _key: `${Date.now().toString(36)}_${i}`, ...img }));
  await getSanityWriteClient()
    .patch(id)
    .setIfMissing({ videoImages: [] })
    .append("videoImages", imageKeys)
    .set({ videoStoryboard: toStoryboardDoc(storyboard), updatedAt: new Date().toISOString() })
    .commit();
}

/** Persist the finished render URL back to the post. */
export async function persistVideoUrl(id: string, videoUrl: string): Promise<void> {
  await getSanityWriteClient()
    .patch(id)
    .set({ videoUrl, updatedAt: new Date().toISOString() })
    .commit()
    .catch((e) => console.warn("[history-storyboard] persistVideoUrl failed:", (e as Error).message));
}

/** Persist a finished Veo clip onto a saved storyboard scene. */
export async function persistSceneClip(id: string, sceneIndex: number, videoClipUrl: string): Promise<void> {
  await getSanityWriteClient()
    .patch(id)
    .set({
      [`videoStoryboard.scenes[_key=="sc_${sceneIndex}"].videoClipUrl`]: videoClipUrl,
      updatedAt: new Date().toISOString(),
    })
    .commit()
    .catch((e) => console.warn("[history-storyboard] persistSceneClip failed:", (e as Error).message));
}

/** Persist a generated music track onto the storyboard. */
export async function persistMusicUrl(id: string, musicUrl: string): Promise<void> {
  await getSanityWriteClient()
    .patch(id)
    .set({ "videoStoryboard.musicUrl": musicUrl, updatedAt: new Date().toISOString() })
    .commit()
    .catch((e) => console.warn("[history-storyboard] persistMusicUrl failed:", (e as Error).message));
}
