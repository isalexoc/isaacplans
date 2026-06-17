import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { generatePromoImages } from "./promo-image-generator";
import type {
  LeadMagnetOutline,
  LeadMagnetSection,
  LeadMagnetImages,
  BilingualLeadMagnetImages,
  LeadMagnetPromptInput,
  GeneratedLeadMagnet,
  LeadMagnetImageSlot,
} from "./types";

type ImageGenResult = { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };

// ─── Enrichment context ─────────────────────────────────────────────────────

interface ImageGenerationContext {
  outline: LeadMagnetOutline;
  promptInput?: LeadMagnetPromptInput;
  generatedContent?: GeneratedLeadMagnet;
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  aca: "ACA / Obamacare — Affordable Care Act marketplace health insurance with subsidies and open enrollment",
  "temporary-health-insurance": "Short-Term / Temporary Health Insurance — bridge coverage for gaps between jobs or life transitions",
  "dental-vision": "Dental & Vision Insurance — preventive care, cleanings, eye exams, glasses, and oral health",
  "hospital-indemnity": "Hospital Indemnity Insurance — cash benefits paid directly when hospitalized, covers out-of-pocket costs",
  iul: "Indexed Universal Life (IUL) — life insurance with tax-advantaged cash value growth tied to market indexes",
  "final-expense": "Final Expense / Burial Insurance — whole life policies covering funeral costs and end-of-life expenses",
  "cancer-plans": "Cancer Insurance Plans — supplemental coverage paying cash benefits upon cancer diagnosis and treatment",
  "heart-stroke": "Heart Attack & Stroke Insurance — supplemental coverage for cardiovascular emergencies and recovery",
  general: "General Insurance Education — helping families understand insurance options and make informed decisions",
  "tips-guides": "Insurance Tips & Guides — practical advice for navigating insurance choices and saving money",
  news: "Insurance Industry News — updates on regulations, enrollment periods, and market changes",
};

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

const SECTION_SYSTEM_PROMPT_EN = `You are a creative director for a professional insurance agency targeting American families. Write a single image prompt for an insurance guide section illustration featuring diverse Americans. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, or words anywhere in the image.`;

const SECTION_SYSTEM_PROMPT_ES = `You are a creative director for a professional insurance agency targeting Hispanic/Latino families. Write a single image prompt for an insurance guide section illustration featuring Hispanic/Latino individuals. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, or words anywhere in the image.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function summarizeIntroduction(intro: string | undefined): string | undefined {
  if (!intro || intro.length < 50) return undefined;
  const truncated = intro.slice(0, 800);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 200 ? truncated.slice(0, lastPeriod + 1) : truncated;
}

function extractSectionThemes(sections: LeadMagnetSection[]): string {
  return sections
    .map((s, i) => `${i + 1}. ${s.sectionTitle}: ${s.keyPoints.join("; ")}`)
    .join("\n");
}

function pickRelevantArchetypes(
  pool: string[],
  count: number,
  outline: LeadMagnetOutline,
  promptInput?: LeadMagnetPromptInput
): string[] {
  const keywords = [
    outline.category,
    outline.targetAudience.toLowerCase(),
    ...outline.keyBenefits.map((b) => b.toLowerCase()),
    ...outline.sections.map((s) => s.sectionTitle.toLowerCase()),
    outline.title.toLowerCase(),
    promptInput?.topic?.toLowerCase() ?? "",
    promptInput?.targetAudience?.toLowerCase() ?? "",
  ].join(" ");

  const scored = pool.map((archetype) => {
    let score = Math.random() * 0.3;
    const lower = archetype.toLowerCase();
    if ((keywords.includes("senior") || keywords.includes("retire") || keywords.includes("final expense") || keywords.includes("elderly")) && (lower.includes("70s") || lower.includes("60s"))) score += 1;
    if ((keywords.includes("young") || keywords.includes("millennial") || keywords.includes("college") || keywords.includes("student")) && (lower.includes("20s") || lower.includes("college"))) score += 1;
    if ((keywords.includes("family") || keywords.includes("child") || keywords.includes("parent")) && (lower.includes("father") || lower.includes("mother") || lower.includes("toddler") || lower.includes("daughter") || lower.includes("teenager"))) score += 1;
    if ((keywords.includes("professional") || keywords.includes("business") || keywords.includes("self-employed")) && (lower.includes("office") || lower.includes("blazer") || lower.includes("meeting") || lower.includes("professional"))) score += 1;
    if ((keywords.includes("health") || keywords.includes("medical") || keywords.includes("hospital") || keywords.includes("cancer") || keywords.includes("heart")) && (lower.includes("nurse") || lower.includes("healthcare") || lower.includes("clinical"))) score += 1;
    if ((keywords.includes("worker") || keywords.includes("labor") || keywords.includes("construction")) && (lower.includes("construction") || lower.includes("tradesman") || lower.includes("work gear"))) score += 1;
    if ((keywords.includes("couple") || keywords.includes("spouse") || keywords.includes("marriage")) && lower.includes("couple")) score += 1;
    if ((keywords.includes("education") || keywords.includes("learn") || keywords.includes("teacher")) && (lower.includes("teacher") || lower.includes("books") || lower.includes("desk"))) score += 1;
    return { archetype, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.archetype);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function selectSectionIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  return [0.2, 0.45, 0.7, 0.9].map((pct) => Math.min(Math.floor(pct * n), n - 1));
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

async function buildCoverPrompt(
  client: OpenAI,
  context: ImageGenerationContext,
  locale: "en" | "es"
): Promise<string> {
  const { outline, promptInput, generatedContent } = context;
  const [subject] = pickRelevantArchetypes(
    locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN,
    1,
    outline,
    promptInput
  );
  const systemPrompt = locale === "es" ? COVER_SYSTEM_PROMPT_ES : COVER_SYSTEM_PROMPT_EN;
  const categoryDesc = CATEGORY_DESCRIPTIONS[outline.category] ?? outline.category;
  const introSummary = summarizeIntroduction(generatedContent?.introduction);
  const sectionThemes = extractSectionThemes(outline.sections);

  let userContent = `Generate an image prompt for this insurance lead magnet cover page.

Title: ${outline.title}
Subtitle: ${outline.subtitle}
Category: ${categoryDesc}
Target Audience: ${outline.targetAudience}`;

  if (promptInput?.tone) userContent += `\nTone: ${promptInput.tone}`;
  userContent += `\nKey Benefits: ${outline.keyBenefits.join("; ")}`;
  userContent += `\nGuide Topics:\n${sectionThemes}`;
  if (introSummary) userContent += `\nIntroduction Summary:\n${introSummary}`;
  if (promptInput?.additionalContext) userContent += `\nAdditional Context: ${promptInput.additionalContext}`;
  userContent += `\nSubject: ${subject}`;
  userContent += `\n\nThis is the COVER image — it should convey the overall theme and value proposition. Make it visually distinct from section illustrations.\n\nReturn only the image prompt, nothing else.`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 300,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Professional insurance guide cover, ${subject}, warm lighting, photorealistic, no text`
  );
}

async function buildSectionPrompt(
  client: OpenAI,
  context: ImageGenerationContext,
  sectionIndex: number,
  locale: "en" | "es"
): Promise<string> {
  const { outline, promptInput, generatedContent } = context;
  const section = outline.sections[sectionIndex];
  const [subject] = pickRelevantArchetypes(
    locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN,
    1,
    outline,
    promptInput
  );
  const systemPrompt = locale === "es" ? SECTION_SYSTEM_PROMPT_ES : SECTION_SYSTEM_PROMPT_EN;
  const categoryDesc = CATEGORY_DESCRIPTIONS[outline.category] ?? outline.category;
  const sectionContent = generatedContent?.sections?.[sectionIndex]?.content;

  let userContent = `Generate an image prompt for section ${sectionIndex + 1} of ${outline.sections.length} in this insurance lead magnet.

Section: ${section.sectionTitle}
Key Points: ${section.keyPoints.join("; ")}
Category: ${categoryDesc}
Target Audience: ${outline.targetAudience}`;

  if (sectionContent) userContent += `\nSection Content Summary: ${sectionContent.slice(0, 400)}`;
  userContent += `\nSubject: ${subject}`;
  userContent += `\n\nThis image is for section ${sectionIndex + 1} of ${outline.sections.length} — it must be visually DISTINCT from the cover and other section images.\n\nReturn only the image prompt, nothing else.`;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Insurance professional illustration, ${subject}, ${outline.category}, warm lighting, photorealistic, no text`
  );
}

// ─── Image generation & upload ───────────────────────────────────────────────

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
  context: ImageGenerationContext,
  locale: "en" | "es"
): Promise<{ images: LeadMagnetImages; warnings: string[] }> {
  const warnings: string[] = [];
  const { outline } = context;
  const { category } = outline;
  const sectionIndices = selectSectionIndices(outline.sections.length);
  const ts = Date.now();

  const [coverPrompt, ...sectionPrompts] = await Promise.all([
    buildCoverPrompt(client, context, locale).catch((err) => {
      warnings.push(`[${locale}] Cover prompt failed: ${err instanceof Error ? err.message : String(err)}`);
      return `Professional insurance guide cover for ${category}, warm lighting, photorealistic, no text`;
    }),
    ...sectionIndices.map((idx) =>
      buildSectionPrompt(client, context, idx, locale).catch((err) => {
        warnings.push(`[${locale}] Section ${idx} prompt failed: ${err instanceof Error ? err.message : String(err)}`);
        return `Insurance professional illustration, ${category}, warm lighting, photorealistic, no text`;
      })
    ),
  ]);

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
  context: ImageGenerationContext
): Promise<{ images: BilingualLeadMagnetImages; warnings: string[] }> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured");
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_KEY) throw new Error("Cloudinary API key is not configured");
  if (!process.env.CLOUDINARY_API_SECRET) throw new Error("CLOUDINARY_API_SECRET is not configured");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const [enResult, esResult] = await Promise.all([
    generateImageSetForLocale(client, context, "en"),
    generateImageSetForLocale(client, context, "es"),
  ]);

  return {
    images: { en: enResult.images, es: esResult.images },
    warnings: [...enResult.warnings, ...esResult.warnings],
  };
}

export async function regenerateSingleLeadMagnetImage(
  context: ImageGenerationContext,
  locale: "en" | "es",
  slot: LeadMagnetImageSlot
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured");
  if (!process.env.CLOUDINARY_API_SECRET) throw new Error("CLOUDINARY_API_SECRET is not configured");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { outline } = context;
  const ts = Date.now();

  let prompt: string;
  let size: "1536x1024" | "1024x1024";
  let folder: string;
  let publicId: string;

  if (slot === "cover") {
    prompt = await buildCoverPrompt(client, context, locale);
    size = "1536x1024";
    folder = `lead-magnets/${outline.category}/${locale}`;
    publicId = `cover-${ts}`;
  } else {
    const sectionIndex = parseInt(slot.replace("section-", ""));
    if (isNaN(sectionIndex) || sectionIndex < 0 || sectionIndex >= outline.sections.length) {
      throw new Error(`Invalid section index: ${slot}`);
    }
    prompt = await buildSectionPrompt(client, context, sectionIndex, locale);
    size = "1024x1024";
    folder = `lead-magnets/${outline.category}/sections/${locale}`;
    publicId = `section-${sectionIndex}-${ts}`;
  }

  const b64 = await generateImage(client, prompt, size);
  return uploadToCloudinary(b64, folder, publicId);
}
