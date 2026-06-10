import { createClient } from "next-sanity";
import { createSlug, generateKey } from "@/lib/blog-generator/portable-text";
import type {
  LeadMagnetPublishInput,
  PublishedLeadMagnet,
  LeadMagnetSection,
  BilingualLeadMagnetPublishInput,
  BilingualPublishedLeadMagnet,
  TranslatedLeadMagnet,
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
  sections: LeadMagnetSection[],
  sectionImages: string[],
  client: WriteClient
): Promise<Record<string, unknown>[]> {
  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionDoc: Record<string, unknown> = {
      _key: generateKey(),
      sectionTitle: section.sectionTitle,
      content: section.contentBlocks ?? [],
    };

    const imageUrl = sectionImages[i] ?? "";
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

  const sections = await buildSections(
    generatedContent.sections,
    generatedContent.sections.map((s) => s.sectionImage ?? ""),
    client
  );

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

export async function publishBilingualLeadMagnet(
  params: BilingualLeadMagnetPublishInput & {
    esContent: TranslatedLeadMagnet;
    esPdfUrl: string;
  }
): Promise<BilingualPublishedLeadMagnet> {
  const {
    outline,
    generatedContent,
    images,
    enPdfUrl,
    status,
    originalPromptInput,
    enSeoOverride,
    enLeadFormOverride,
    esContent,
    esPdfUrl,
  } = params;

  const client = getWriteClient();
  const now = new Date().toISOString();
  const t0 = Date.now();
  console.log("[sanity-publisher] publishBilingualLeadMagnet START");

  // Step 1: generate unique slugs in parallel (ES slug based on translated title)
  console.log("[sanity-publisher] step 1 — generating slugs");
  const [enSlug, esSlug] = await Promise.all([
    generateUniqueSlug(outline.title, client),
    generateUniqueSlug(esContent.outline.title, client),
  ]);
  console.log(`[sanity-publisher] slugs done — en="${enSlug}" es="${esSlug}" ${Date.now() - t0}ms`);

  // Step 2: upload cover images + build sections in parallel
  console.log(`[sanity-publisher] step 2 — uploading images + building sections (en sections=${generatedContent.sections.length} es sections=${esContent.sections.length})`);
  const enSectionImages = images.en.sectionImages;
  const esSectionImages = images.es.sectionImages;

  const [
    enCoverAssetId,
    esCoverAssetId,
    enSections,
    esSections,
  ] = await Promise.all([
    images.en.coverImage
      ? uploadImageToSanity(images.en.coverImage, client, `cover-en-${enSlug}.jpg`).catch(() => "")
      : Promise.resolve(""),
    images.es.coverImage
      ? uploadImageToSanity(images.es.coverImage, client, `cover-es-${esSlug}.jpg`).catch(() => "")
      : Promise.resolve(""),
    buildSections(generatedContent.sections, enSectionImages, client),
    buildSections(
      esContent.sections.map((s, i) => ({
        sectionTitle: s.sectionTitle,
        keyPoints: esContent.outline.sections[i]?.keyPoints ?? [],
        content: s.content,
        contentBlocks: s.contentBlocks,
        sectionImage: esSectionImages[i] ?? "",
      })),
      esSectionImages,
      client
    ),
  ]);

  console.log(`[sanity-publisher] images+sections done — ${Date.now() - t0}ms`);

  // Step 3: build and create both documents in parallel
  console.log("[sanity-publisher] step 3 — creating Sanity documents");
  const buildDoc = (
    locale: "en" | "es",
    slug: string,
    title: string,
    subtitle: string,
    keyBenefits: string[],
    introBlocks: unknown[],
    seo: { metaTitle: string; metaDescription: string; focusKeyword: string; keywords: string[] },
    leadFormSettings: { ctaHeadline: string; ctaSubtext: string; ctaButtonText: string; successMessage: string },
    sections: Record<string, unknown>[],
    coverAssetId: string,
    pdfUrl: string,
    promoImages?: { square?: string; landscape?: string }
  ) => {
    const doc: Record<string, unknown> & { _type: string } = {
      _type: "leadMagnet",
      title,
      slug: { _type: "slug", current: slug },
      locale,
      category: outline.category,
      status,
      subtitle,
      description: introBlocks,
      sections,
      keyBenefits,
      targetAudience: outline.targetAudience,
      leadFormSettings,
      seo,
      generationPrompt: JSON.stringify(originalPromptInput),
      generatedPdfUrl: pdfUrl,
      pdfGeneratedAt: now,
      downloadCount: 0,
      publishedAt: status === "published" ? now : null,
      updatedAt: now,
    };
    if (coverAssetId) {
      doc.coverImage = {
        _type: "image",
        asset: { _type: "reference", _ref: coverAssetId },
        alt: title,
      };
    }
    if (promoImages?.square || promoImages?.landscape) {
      doc.promoImages = {
        square: promoImages.square ?? "",
        landscape: promoImages.landscape ?? "",
      };
    }
    return doc;
  };

  const enDoc = buildDoc(
    "en",
    enSlug,
    outline.title,
    outline.subtitle,
    outline.keyBenefits,
    generatedContent.introductionBlocks,
    {
      metaTitle: enSeoOverride.metaTitle.slice(0, 60),
      metaDescription: enSeoOverride.metaDescription.slice(0, 160),
      focusKeyword: enSeoOverride.focusKeyword,
      keywords: outline.keyBenefits.map((b) => b.split(" ").slice(0, 3).join(" ")),
    },
    enLeadFormOverride,
    enSections,
    enCoverAssetId,
    enPdfUrl,
    images.en.promoImages
  );

  const esDoc = buildDoc(
    "es",
    esSlug,
    esContent.outline.title,
    esContent.outline.subtitle,
    esContent.outline.keyBenefits,
    esContent.introductionBlocks,
    esContent.seo,
    esContent.leadFormSettings,
    esSections,
    esCoverAssetId,
    esPdfUrl,
    images.es.promoImages
  );

  const [enResult, esResult] = await Promise.all([
    client.create(enDoc),
    client.create(esDoc),
  ]);

  console.log(`[sanity-publisher] docs created — en=${enResult._id} es=${esResult._id} ${Date.now() - t0}ms`);

  // Wire cross-references so the language toggle can navigate between pairs
  console.log("[sanity-publisher] step 4 — patching cross-references");
  await Promise.all([
    client.patch(enResult._id).set({ relatedGuide: { _type: "reference", _ref: esResult._id } }).commit(),
    client.patch(esResult._id).set({ relatedGuide: { _type: "reference", _ref: enResult._id } }).commit(),
  ]);
  console.log(`[sanity-publisher] DONE — total=${Date.now() - t0}ms`);

  return {
    en: {
      sanityDocumentId: enResult._id,
      slug: enSlug,
      pdfUrl: enPdfUrl,
      publicUrl: `/lead-magnets/${enSlug}`,
    },
    es: {
      sanityDocumentId: esResult._id,
      slug: esSlug,
      pdfUrl: esPdfUrl,
      publicUrl: `/imanes-de-leads/${esSlug}`,
    },
  };
}
