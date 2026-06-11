import { client } from "@/sanity/lib/client";
import type {
  BlogPostSummary,
  LeadMagnetSummary,
  SocialLocale,
  SocialPostSource,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function portableTextToPlainText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b: any) => b._type === "block" && Array.isArray(b.children))
    .map((b: any) =>
      b.children.map((span: any) => span.text ?? "").join("")
    )
    .join("\n\n");
}

// ─── Source List ──────────────────────────────────────────────────────────────

interface FetchSourceListOptions {
  q?: string;
  category?: string;
  locale?: string;
  limit?: number;
}

interface SourceListResult {
  blogPosts: BlogPostSummary[];
  leadMagnets: LeadMagnetSummary[];
}

export async function fetchSourceList(
  options: FetchSourceListOptions = {}
): Promise<SourceListResult> {
  const params = {
    locale: options.locale ?? "en",
    q: options.q ?? null,
    category: options.category ?? null,
    limit: options.limit ?? 30,
  };

  const [blogPosts, leadMagnets] = await Promise.all([
    client.fetch<BlogPostSummary[]>(
      `*[
        _type == "post"
        && locale == $locale
        && defined(slug.current)
        && ($q == null || title match $q + "*")
        && ($category == null || category == $category)
      ] | order(publishedAt desc) [0...$limit] {
        _id,
        title,
        "slug": slug.current,
        excerpt,
        category,
        "featuredImageUrl": image.asset->url,
        publishedAt
      }`,
      params
    ),
    client.fetch<LeadMagnetSummary[]>(
      `*[
        _type == "leadMagnet"
        && status == "published"
        && defined(slug.current)
        && ($q == null || title match $q + "*")
        && ($category == null || category == $category)
      ] | order(publishedAt desc) [0...$limit] {
        _id,
        title,
        subtitle,
        "slug": slug.current,
        category,
        "coverImageUrl": coverImage.asset->url,
        publishedAt
      }`,
      params
    ),
  ]);

  return { blogPosts, leadMagnets };
}

// ─── Blog Post Detail ─────────────────────────────────────────────────────────

export async function fetchBlogPostContent(id: string): Promise<SocialPostSource> {
  const doc = await client.fetch<{
    _id: string;
    title: string;
    slug: string;
    excerpt?: string;
    category?: string;
    locale?: string;
    featuredImageUrl?: string;
    body?: unknown[];
  } | null>(
    `*[_type == "post" && _id == $id][0] {
      _id,
      title,
      "slug": slug.current,
      excerpt,
      category,
      locale,
      "featuredImageUrl": image.asset->url,
      body
    }`,
    { id }
  );

  if (!doc) throw new Error(`Blog post not found: ${id}`);

  return {
    type: "blog_post",
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    subtitle: doc.excerpt ?? undefined,
    bodyText: portableTextToPlainText(doc.body ?? []).slice(0, 3000),
    category: doc.category ?? undefined,
    imageUrl: doc.featuredImageUrl ?? undefined,
    publicUrl: `https://isaacplans.com/${doc.locale ?? "en"}/blog/${doc.slug}`,
    locale: (doc.locale as SocialLocale) ?? "en",
  };
}

// ─── Lead Magnet Detail ───────────────────────────────────────────────────────

export async function fetchLeadMagnetContent(id: string): Promise<SocialPostSource> {
  const doc = await client.fetch<{
    _id: string;
    title: string;
    subtitle?: string;
    slug: string;
    category?: string;
    coverImageUrl?: string;
    keyBenefits?: string[];
    targetAudience?: string;
    description?: unknown[];
  } | null>(
    `*[_type == "leadMagnet" && _id == $id][0] {
      _id,
      title,
      subtitle,
      "slug": slug.current,
      category,
      "coverImageUrl": coverImage.asset->url,
      keyBenefits,
      targetAudience,
      description
    }`,
    { id }
  );

  if (!doc) throw new Error(`Lead magnet not found: ${id}`);

  const parts = [
    doc.targetAudience ? `Who this is for: ${doc.targetAudience}` : null,
    doc.keyBenefits?.length
      ? `Key benefits:\n${doc.keyBenefits.map((b) => `• ${b}`).join("\n")}`
      : null,
    doc.description
      ? portableTextToPlainText(doc.description).slice(0, 1500)
      : null,
  ].filter(Boolean);

  return {
    type: "lead_magnet",
    id: doc._id,
    slug: doc.slug,
    title: doc.title,
    subtitle: doc.subtitle ?? undefined,
    bodyText: parts.join("\n\n"),
    category: doc.category ?? undefined,
    imageUrl: doc.coverImageUrl ?? undefined,
    publicUrl: `https://isaacplans.com/en/lead-magnets/${doc.slug}`,
    locale: "en",
  };
}
