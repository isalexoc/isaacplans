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
