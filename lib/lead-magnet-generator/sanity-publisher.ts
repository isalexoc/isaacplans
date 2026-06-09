import { createClient } from "next-sanity";
import { createSlug, generateKey } from "@/lib/blog-generator/portable-text";
import type { LeadMagnetPublishInput, PublishedLeadMagnet } from "./types";

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

type WriteClient = ReturnType<typeof getWriteClient>;

async function uploadImageToSanity(
  imageUrl: string,
  client: WriteClient,
  filename: string
): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const asset = await client.assets.upload("image", buffer, {
    filename,
    contentType: "image/jpeg",
  });
  return asset._id;
}

async function generateUniqueSlug(title: string, client: WriteClient): Promise<string> {
  const base = createSlug(title);
  const existingSlugs = await client.fetch<string[]>(
    `*[_type == "leadMagnet"][].slug.current`
  );
  const slugSet = new Set(existingSlugs);

  if (!slugSet.has(base)) return base;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!slugSet.has(candidate)) return candidate;
  }

  return `${base}-${Date.now()}`;
}

async function buildSections(
  params: Pick<LeadMagnetPublishInput, "generatedContent">,
  client: WriteClient
): Promise<Record<string, unknown>[]> {
  const { generatedContent } = params;
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < generatedContent.sections.length; i++) {
    const section = generatedContent.sections[i];
    const sectionDoc: Record<string, unknown> = {
      _key: generateKey(),
      sectionTitle: section.sectionTitle,
      content: section.contentBlocks ?? [],
    };

    const imageUrl = section.sectionImage ?? "";
    if (imageUrl) {
      try {
        const assetId = await uploadImageToSanity(
          imageUrl,
          client,
          `section-${i}-${createSlug(section.sectionTitle)}.jpg`
        );
        sectionDoc.sectionImage = {
          _type: "image",
          asset: { _type: "reference", _ref: assetId },
          alt: section.sectionTitle,
        };
      } catch {
        // non-fatal — publish without section image
      }
    }

    results.push(sectionDoc);
  }

  return results;
}

export async function publishLeadMagnet(
  params: LeadMagnetPublishInput
): Promise<PublishedLeadMagnet> {
  const { outline, generatedContent, images, pdfUrl, status, originalPromptInput } = params;
  const client = getWriteClient();
  const now = new Date().toISOString();

  const slug = await generateUniqueSlug(outline.title, client);

  let coverImageAssetId = "";
  if (images.coverImage) {
    coverImageAssetId = await uploadImageToSanity(
      images.coverImage,
      client,
      `cover-${slug}.jpg`
    );
  }

  const sections = await buildSections({ generatedContent }, client);

  const doc: Record<string, unknown> & { _type: string } = {
    _type: "leadMagnet",
    title: outline.title,
    slug: { _type: "slug", current: slug },
    locale: "en",
    category: outline.category,
    status,
    subtitle: outline.subtitle,
    description: generatedContent.introductionBlocks,
    sections,
    keyBenefits: outline.keyBenefits,
    targetAudience: outline.targetAudience,
    leadFormSettings: {
      ctaHeadline: "Get Your Free Guide",
      ctaSubtext: "Enter your info below to download instantly — no spam, ever.",
      ctaButtonText: "Download Free Guide",
      successMessage: "Your guide is downloading now!",
    },
    seo: {
      metaTitle: outline.title.slice(0, 60),
      metaDescription: outline.subtitle.slice(0, 160),
      focusKeyword: outline.sections[0]?.keyPoints[0] ?? outline.title,
      keywords: outline.keyBenefits.map((b) => b.split(" ").slice(0, 3).join(" ")),
    },
    generationPrompt: JSON.stringify(originalPromptInput),
    generatedPdfUrl: pdfUrl,
    pdfGeneratedAt: now,
    downloadCount: 0,
    publishedAt: status === "published" ? now : null,
    updatedAt: now,
  };

  if (coverImageAssetId) {
    doc.coverImage = {
      _type: "image",
      asset: { _type: "reference", _ref: coverImageAssetId },
      alt: outline.title,
    };
  }

  const result = await client.create(doc);

  return {
    sanityDocumentId: result._id,
    slug,
    pdfUrl,
    publicUrl: `/lead-magnets/${slug}`,
  };
}
