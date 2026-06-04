import { createClient } from "next-sanity";
import { createSlug, generateKey, textToBlocks } from "./portable-text";
import type {
  GeneratedBlogContent,
  GeneratedImages,
  PortableTextBlock,
  TranslatedBlogContent,
  SanityPublishResult,
  CTASettings,
} from "./types";

function getWriteClient() {
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    throw new Error("SANITY_API_WRITE_TOKEN is not configured");
  }
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "anetxoet",
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token: process.env.SANITY_API_WRITE_TOKEN,
    useCdn: false,
  });
}

export async function uploadThumbnail(
  thumbnailUrl: string,
  videoTitle: string
): Promise<string> {
  const client = getWriteClient();

  const res = await fetch(thumbnailUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch YouTube thumbnail: ${res.status} ${res.statusText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const filename = `blog-${createSlug(videoTitle)}.jpg`;

  const asset = await client.assets.upload("image", buffer, {
    filename,
    contentType: "image/jpeg",
  });

  return asset._id;
}

function insertBodyImages(
  blocks: PortableTextBlock[],
  images: GeneratedImages["body"]
): PortableTextBlock[] {
  if (blocks.length < 6) return blocks;

  const total = blocks.length;
  const insertions = [
    { idx: Math.floor(total * 0.75), image: images[2] },
    { idx: Math.floor(total * 0.50), image: images[1] },
    { idx: Math.floor(total * 0.25), image: images[0] },
  ];

  const result = [...blocks];
  for (const { idx, image } of insertions) {
    result.splice(idx, 0, {
      _type: "image",
      _key: generateKey(),
      asset: { _type: "reference", _ref: image.assetId },
      alt: image.alt,
    } as unknown as PortableTextBlock);
  }
  return result;
}

export async function publishBilingualPost(
  enContent: GeneratedBlogContent,
  esContent: TranslatedBlogContent,
  thumbnailAssetId: string,
  cta?: CTASettings,
  status: "draft" | "published" = "draft",
  images?: GeneratedImages
): Promise<SanityPublishResult> {
  const client = getWriteClient();

  const featuredAssetId = images?.featured.assetId ?? thumbnailAssetId;
  const featuredAlt = images?.featured.alt ?? enContent.title;

  const imageField = {
    _type: "image",
    asset: { _type: "reference", _ref: featuredAssetId },
    alt: featuredAlt,
  };

  const rawEnBlocks = textToBlocks(enContent.bodyMarkdown);
  const rawEsBlocks = textToBlocks(esContent.bodyMarkdown);
  const enBodyBlocks = images ? insertBodyImages(rawEnBlocks, images.body) : rawEnBlocks;
  const esBodyBlocks = images ? insertBodyImages(rawEsBlocks, images.body) : rawEsBlocks;

  const publishedAt = new Date().toISOString();
  const enSlug = createSlug(enContent.title);
  const esSlug = createSlug(esContent.title);

  const leadCapture = cta?.enableCTA
    ? { enableCTA: true, ctaType: cta.ctaType, ctaText: cta.ctaText, ctaPosition: cta.ctaPosition }
    : { enableCTA: false };

  const postEn = await client.create({
    _type: "post",
    locale: "en",
    title: enContent.title,
    slug: { _type: "slug", current: enSlug },
    category: enContent.category,
    excerpt: enContent.excerpt,
    body: enBodyBlocks,
    image: imageField,
    author: "Isaac Orraiz",
    publishedAt,
    status,
    featured: false,
    tags: enContent.tags,
    readingTime: enContent.readingTime,
    leadCapture,
    seo: {
      metaTitle: enContent.seo.metaTitle,
      metaDescription: enContent.seo.metaDescription,
      focusKeyword: enContent.seo.focusKeyword,
      keywords: enContent.seo.keywords,
    },
  });

  const postEs = await client.create({
    _type: "post",
    locale: "es",
    title: esContent.title,
    slug: { _type: "slug", current: esSlug },
    category: enContent.category,
    excerpt: esContent.excerpt,
    body: esBodyBlocks,
    image: imageField,
    author: "Isaac Orraiz",
    publishedAt,
    status,
    featured: false,
    tags: esContent.tags,
    readingTime: enContent.readingTime,
    leadCapture,
    seo: {
      metaTitle: esContent.seo.metaTitle,
      metaDescription: esContent.seo.metaDescription,
      focusKeyword: esContent.seo.focusKeyword,
      keywords: esContent.seo.keywords,
    },
  });

  await Promise.all([
    client
      .patch(postEn._id)
      .set({ relatedPost: { _type: "reference", _ref: postEs._id } })
      .commit(),
    client
      .patch(postEs._id)
      .set({ relatedPost: { _type: "reference", _ref: postEn._id } })
      .commit(),
  ]);

  return {
    enPostId: postEn._id,
    esPostId: postEs._id,
    enSlug,
    esSlug,
  };
}
