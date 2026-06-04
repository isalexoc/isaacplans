import { createClient } from "next-sanity";
import { createSlug } from "./portable-text";
import type {
  GeneratedBlogContent,
  TranslatedBlogContent,
  SanityPublishResult,
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

export async function publishBilingualPost(
  enContent: GeneratedBlogContent,
  esContent: TranslatedBlogContent,
  thumbnailAssetId: string
): Promise<SanityPublishResult> {
  const client = getWriteClient();

  const imageField = {
    _type: "image",
    asset: { _type: "reference", _ref: thumbnailAssetId },
    alt: enContent.title,
  };

  const publishedAt = new Date().toISOString();
  const enSlug = createSlug(enContent.title);
  const esSlug = createSlug(esContent.title);

  const postEn = await client.create({
    _type: "post",
    locale: "en",
    title: enContent.title,
    slug: { _type: "slug", current: enSlug },
    category: enContent.category,
    excerpt: enContent.excerpt,
    body: enContent.bodyBlocks,
    image: imageField,
    author: "Isaac Orraiz",
    publishedAt,
    status: "draft",
    featured: false,
    tags: enContent.tags,
    readingTime: enContent.readingTime,
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
    body: esContent.bodyBlocks,
    image: imageField,
    author: "Isaac Orraiz",
    publishedAt,
    status: "draft",
    featured: false,
    tags: esContent.tags,
    readingTime: enContent.readingTime,
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
