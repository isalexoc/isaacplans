import { createClient } from "next-sanity";
import type { SocialPostPublishRequest, PublishedSocialPost } from "./types";

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}

type WriteClient = ReturnType<typeof getWriteClient>;

async function generateUniqueSlug(client: WriteClient, title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  const existing = await client.fetch<string[]>(
    `*[_type == "socialPost" && defined(slug.current)].slug.current`
  );

  const existingSet = new Set(existing);
  if (!existingSet.has(base)) return base;

  let counter = 2;
  while (existingSet.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}

export async function publishSocialPost(
  req: SocialPostPublishRequest
): Promise<PublishedSocialPost> {
  const client = getWriteClient();
  const slug   = await generateUniqueSlug(client, req.source.title);
  const now    = new Date().toISOString();

  const generatedCopies = req.copies.map((copy) => ({
    _type:          "object",
    _key:           `${copy.platform}_${copy.locale}`,
    platform:       copy.platform,
    locale:         copy.locale,
    hook:           copy.hook,
    body:           copy.body,
    cta:            copy.cta,
    hashtags:       copy.hashtags,
    fullPost:       copy.fullPost,
    characterCount: copy.characterCount,
  }));

  const videoScript = req.videoScript
    ? {
        duration:         req.videoScript.duration,
        hookScript:       req.videoScript.hookScript,
        fullScript:       req.videoScript.fullScript,
        onScreenText:     req.videoScript.onScreenTextSuggestions,
        brollSuggestions: req.videoScript.brollSuggestions,
        voiceoverTips:    req.videoScript.voiceoverTips,
        suggestedCaption: req.videoScript.suggestedCaption,
      }
    : undefined;

  const doc: Record<string, unknown> & { _type: string } = {
    _type:            "socialPost",
    sourceType:       req.source.type,
    sourceId:         req.source.id ?? null,
    sourceTitle:      req.source.title,
    sourceSlug:       req.source.slug ?? null,
    sourceLocale:     req.source.locale ?? "en",
    sourceUrl:        req.source.publicUrl ?? null,
    sourceImageUrl:   req.source.imageUrl ?? null,
    sourceCategory:   req.source.category ?? null,
    generatedCopies,
    squareImageUrl:   req.images.square,
    verticalImageUrl: req.images.vertical,
    imageHeadline:    req.images.headline,
    ...(videoScript ? { videoScript } : {}),
    ...(req.videoUrl ? { videoUrl: req.videoUrl } : {}),
    ...(req.videoImages?.length
      ? { videoImages: req.videoImages.map((img, i) => ({ _key: `${Date.now().toString(36)}_${i}`, ...img })) }
      : {}),
    status:           req.status,
    tags:             req.tags ?? [],
    createdAt:        now,
    updatedAt:        now,
  };

  const created = await client.create(doc);

  return {
    sanityDocumentId: created._id,
    slug,
  };
}
