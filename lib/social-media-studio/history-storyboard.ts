import { createClient, type SanityClient } from "next-sanity";
import { buildVideoStoryboard, hashScript } from "./video-generator";
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
    presenterVoiceId:    sb.presenterVoiceId ?? null,
    presenterVoiceName:  sb.presenterVoiceName ?? null,
    cinematic:           sb.cinematic ?? false,
    veoTier:             sb.veoTier ?? null,
    veoDurationSec:      sb.veoDurationSec ?? null,
    scriptHash:          sb.scriptHash ?? null,
    reuseAssets:         sb.reuseAssets ?? true,
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

/** Hash of the currently-saved script, or null if the post has none yet. Cheap — no GPT call. */
export async function latestScriptHash(id: string, locale?: SocialLocale): Promise<string | null> {
  const loaded = await loadSourceAndScript(id, locale);
  return loaded ? hashScript(loaded.videoScript) : null;
}

/**
 * Rebuild scene narration from the latest saved script while KEEPING the curated images
 * (mapped by index, reused cyclically if the scene count changed) + cinematic clips + presenter
 * picks. Guarantees the video always speaks the user's most recently edited script — presenter
 * or faceless alike. Skips the GPT rebuild entirely when the script hasn't changed since
 * `current` was built (same `scriptHash`), and returns `current` unchanged when there's no
 * saved script or no images yet.
 */
export async function rebuildFromLatestScript(
  id: string,
  current: VideoStoryboard,
): Promise<VideoStoryboard> {
  const loaded = await loadSourceAndScript(id, current.voiceLanguage);
  if (!loaded) return current;
  if (current.scriptHash && current.scriptHash === hashScript(loaded.videoScript)) return current;

  const fresh = await buildVideoStoryboard(loaded.source, loaded.videoScript, current.voiceLanguage);
  const images = current.scenes.map((s) => s.imageUrl).filter(Boolean);
  if (images.length === 0) return current;
  const clips = current.scenes.map((s) => s.videoClipUrl);

  fresh.scenes = fresh.scenes.map((scene, i) => ({
    ...scene,
    imageUrl:     images[i] ?? images[i % images.length],
    videoClipUrl: clips[i],
  }));
  fresh.musicUrl            = current.musicUrl;
  fresh.presenter           = current.presenter;
  fresh.presenterPlacement  = current.presenterPlacement;
  fresh.presenterAvatarId   = current.presenterAvatarId;
  fresh.presenterAvatarName = current.presenterAvatarName;
  fresh.presenterVoiceId    = current.presenterVoiceId;
  fresh.presenterVoiceName  = current.presenterVoiceName;
  fresh.cinematic           = current.cinematic;
  fresh.veoTier             = current.veoTier;
  fresh.veoDurationSec      = current.veoDurationSec;

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
