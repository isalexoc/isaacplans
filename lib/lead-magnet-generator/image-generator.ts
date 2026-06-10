import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { generatePromoImages } from "./promo-image-generator";
import type { LeadMagnetOutline, LeadMagnetImages, BilingualLeadMagnetImages } from "./types";

type ImageGenResult = { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };

// ─── Subject archetype pools (one per locale) ────────────────────────────────

const SUBJECT_ARCHETYPES_ES = [
  "a single Latina woman in her 40s, professional blazer, reviewing documents at a kitchen table",
  "a young Latino man in his late 20s, alone at a modern desk with a laptop",
  "an elderly Latino grandfather in his 70s, sitting in a sunlit armchair reading",
  "a Latina woman in her 30s, standing in a bright kitchen, looking confident",
  "a middle-aged Latino man in his 50s, business casual, outdoors on a suburban porch",
  "a young Latina couple in their late 20s, sitting close together on a couch looking at paperwork",
  "a Latino father in his 30s with ONE young toddler on his lap",
  "a Latina grandmother in her 60s and her adult daughter (30s) sitting together at a table",
  "a young Latina professional in her late 20s, standing in a modern office hallway",
  "a middle-aged Latina woman in her 50s, gardening or in a backyard setting",
  "a Latino senior couple in their 60s, walking together in a park",
  "a Latina teenager with her mother (40s), both looking at a phone or tablet",
  "a single Latino professional man in his 30s, in a business meeting room",
  "an elderly Latina woman in her 70s, alone, dignified expression, at home",
  "a young Latino college-age man (early 20s), casual clothes, outdoors",
  "a Latina nurse or healthcare worker in her 30s, in a clinical setting",
  "a Latino construction worker or tradesman in his 40s, in work gear outdoors",
  "a Latina teacher in her 30s at a desk with books and papers",
];

const SUBJECT_ARCHETYPES_EN = [
  "a single Black woman in her 40s, professional blazer, reviewing documents at a kitchen table",
  "a young white man in his late 20s, alone at a modern desk with a laptop",
  "an elderly Asian grandfather in his 70s, sitting in a sunlit armchair reading",
  "a white woman in her 30s, standing in a bright kitchen, looking confident",
  "a middle-aged Black man in his 50s, business casual, outdoors on a suburban porch",
  "a young mixed-race couple in their late 20s, sitting close together on a couch looking at paperwork",
  "a Hispanic father in his 30s with ONE young toddler on his lap",
  "a white grandmother in her 60s and her adult daughter (30s) sitting together at a table",
  "a young Asian American professional woman in her late 20s, standing in a modern office hallway",
  "a middle-aged Black woman in her 50s, casual clothes, in a backyard setting",
  "a white senior couple in their 60s, walking together in a park",
  "a teenage girl with her father (40s), both looking at a phone or tablet",
  "a single South Asian professional man in his 30s, in a business meeting room",
  "an elderly white woman in her 70s, alone, dignified expression, at home",
  "a young Black college-age man (early 20s), casual clothes, outdoors",
  "a Latina nurse or healthcare worker in her 30s, in a clinical setting",
  "a white construction worker or tradesman in his 40s, in work gear outdoors",
  "an Asian American teacher in her 30s at a desk with books and papers",
];

const COVER_SYSTEM_PROMPT_EN = `You are a creative director for a professional insurance agency targeting American families. Write a single image prompt for a lead magnet cover page. The prompt must produce a photorealistic, warm, professional photograph featuring diverse Americans. No text, no logos, no words anywhere in the image. Mood: trustworthy, hopeful, clean.`;

const COVER_SYSTEM_PROMPT_ES = `You are a creative director for a professional insurance agency targeting Hispanic/Latino families in the United States. Write a single image prompt for a lead magnet cover page. The prompt must produce a photorealistic, warm, professional photograph featuring Hispanic/Latino individuals. No text, no logos, no words anywhere in the image. Mood: trustworthy, hopeful, clean.`;

const SECTION_SYSTEM_PROMPT_EN = `You are a creative director for a professional insurance agency targeting American families. Write a single image prompt for an insurance guide section illustration featuring diverse Americans. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, no words anywhere in the image.`;

const SECTION_SYSTEM_PROMPT_ES = `You are a creative director for a professional insurance agency targeting Hispanic/Latino families. Write a single image prompt for an insurance guide section illustration featuring Hispanic/Latino individuals. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, no words anywhere in the image.`;

function pickUniqueArchetypes(pool: string[], count: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function selectSectionIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  return [0.2, 0.45, 0.7, 0.9].map((pct) => Math.min(Math.floor(pct * n), n - 1));
}

async function buildCoverPrompt(
  client: OpenAI,
  outline: LeadMagnetOutline,
  locale: "en" | "es"
): Promise<string> {
  const [subject] = pickUniqueArchetypes(locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN, 1);
  const systemPrompt = locale === "es" ? COVER_SYSTEM_PROMPT_ES : COVER_SYSTEM_PROMPT_EN;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Title: ${outline.title}\nSubtitle: ${outline.subtitle}\nCategory: ${outline.category}\nKey benefits: ${outline.keyBenefits.slice(0, 3).join("; ")}\nSubject: ${subject}\n\nReturn only the image prompt, nothing else.`,
      },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Professional insurance guide cover, ${subject}, warm lighting, photorealistic, no text`
  );
}

async function buildSectionPrompt(
  client: OpenAI,
  outline: LeadMagnetOutline,
  sectionIndex: number,
  locale: "en" | "es"
): Promise<string> {
  const section = outline.sections[sectionIndex];
  const [subject] = pickUniqueArchetypes(locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN, 1);
  const systemPrompt = locale === "es" ? SECTION_SYSTEM_PROMPT_ES : SECTION_SYSTEM_PROMPT_EN;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Section: ${section.sectionTitle}\nKey points: ${section.keyPoints.slice(0, 2).join("; ")}\nCategory: ${outline.category}\nSubject: ${subject}\n\nReturn only the image prompt, nothing else.`,
      },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Insurance professional illustration, ${subject}, ${outline.category}, warm lighting, photorealistic, no text`
  );
}

async function generateImage(
  client: OpenAI,
  prompt: string,
  size: "1536x1024" | "1024x1024"
): Promise<string> {
  const response = (await (client.images.generate as unknown as (
    body: Record<string, unknown>
  ) => Promise<ImageGenResult>)({
    model: "gpt-image-2",
    prompt,
    n: 1,
    size,
    quality: "medium",
    output_format: "png",
  }));

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-2 returned no image data");
  return b64;
}

async function uploadToCloudinary(
  b64: string,
  folder: string,
  publicId: string
): Promise<string> {
  const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    folder,
    public_id: publicId,
    resource_type: "image",
  });
  return uploaded.secure_url;
}

// ─── Per-locale image set generation ─────────────────────────────────────────

async function generateImageSetForLocale(
  client: OpenAI,
  outline: LeadMagnetOutline,
  locale: "en" | "es"
): Promise<{ images: LeadMagnetImages; warnings: string[] }> {
  const warnings: string[] = [];
  const { category } = outline;
  const sectionIndices = selectSectionIndices(outline.sections.length);
  const ts = Date.now();

  // Step 1: build all prompts in parallel
  const [coverPrompt, ...sectionPrompts] = await Promise.all([
    buildCoverPrompt(client, outline, locale).catch((err) => {
      warnings.push(`[${locale}] Cover prompt failed: ${err instanceof Error ? err.message : String(err)}`);
      return `Professional insurance guide cover for ${category}, warm lighting, photorealistic, no text`;
    }),
    ...sectionIndices.map((idx) =>
      buildSectionPrompt(client, outline, idx, locale).catch((err) => {
        warnings.push(`[${locale}] Section ${idx} prompt failed: ${err instanceof Error ? err.message : String(err)}`);
        return `Insurance professional illustration, ${category}, warm lighting, photorealistic, no text`;
      })
    ),
  ]);

  // Step 2: generate all images in parallel
  const [coverB64, ...sectionB64s] = await Promise.all([
    generateImage(client, coverPrompt, "1536x1024").catch((err) => {
      warnings.push(`[${locale}] Cover image generation failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }),
    ...sectionPrompts.map((prompt, i) =>
      generateImage(client, prompt, "1024x1024").catch((err) => {
        warnings.push(`[${locale}] Section ${sectionIndices[i]} image generation failed: ${err instanceof Error ? err.message : String(err)}`);
        return null;
      })
    ),
  ]);

  // Step 3: upload all to Cloudinary in parallel
  const [coverUrl, ...sectionUrls] = await Promise.all([
    coverB64
      ? uploadToCloudinary(coverB64, `lead-magnets/${category}/${locale}`, `cover-${ts}`).catch((err) => {
          warnings.push(`[${locale}] Cover upload failed: ${err instanceof Error ? err.message : String(err)}`);
          return "";
        })
      : Promise.resolve(""),
    ...sectionB64s.map((b64, i) =>
      b64
        ? uploadToCloudinary(b64, `lead-magnets/${category}/sections/${locale}`, `section-${sectionIndices[i]}-${ts}`).catch((err) => {
            warnings.push(`[${locale}] Section ${sectionIndices[i]} upload failed: ${err instanceof Error ? err.message : String(err)}`);
            return "";
          })
        : Promise.resolve("")
    ),
  ]);

  // Step 4: generate EN promo card only — ES title comes from translation at publish time
  const promoImages = (locale === "en" && coverUrl)
    ? await generatePromoImages(outline, coverUrl, locale).catch((err) => {
        warnings.push(`[${locale}] Promo image generation failed: ${err instanceof Error ? err.message : String(err)}`);
        return undefined;
      })
    : undefined;

  return { images: { coverImage: coverUrl, sectionImages: sectionUrls, promoImages }, warnings };
}

// ─── Public exports ───────────────────────────────────────────────────────────

export async function generateBilingualLeadMagnetImages(
  outline: LeadMagnetOutline
): Promise<{ images: BilingualLeadMagnetImages; warnings: string[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured");
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_KEY) throw new Error("Cloudinary API key is not configured");
  if (!process.env.CLOUDINARY_API_SECRET) throw new Error("CLOUDINARY_API_SECRET is not configured");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const [enResult, esResult] = await Promise.all([
    generateImageSetForLocale(client, outline, "en"),
    generateImageSetForLocale(client, outline, "es"),
  ]);

  return {
    images: { en: enResult.images, es: esResult.images },
    warnings: [...enResult.warnings, ...esResult.warnings],
  };
}
