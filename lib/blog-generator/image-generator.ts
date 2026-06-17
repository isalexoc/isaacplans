import OpenAI, { APIError } from "openai";
import { createClient } from "next-sanity";
import { createSlug, generateKey } from "./portable-text";
import type {
  GeneratedBlogContent,
  GeneratedImage,
  GeneratedImages,
  BilingualImages,
  YouTubeExtractionResult,
  ImageSlot,
} from "./types";

const IMAGE_SYSTEM_PROMPT_ES = `You are a creative director for a professional insurance agency blog targeting Hispanic/Latino families in the United States. Your job is to write image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography style, warm professional lighting, shallow depth of field
- Each image must feature the SPECIFIC subject type listed in the slot description — do not substitute a group or family if a single person is specified
- Show Hispanic/Latino individuals — vary ages, genders, and life situations widely: young adults, middle-aged professionals, seniors, couples, parents with ONE child
- NEVER default to large multi-generation family gatherings unless the article is explicitly about family legacy
- Settings: warm homes, workplaces, community spaces, outdoors — authentic real-life moments
- NO text, words, signs, logos, or watermarks anywhere in the image
- NO graphic medical content, no death imagery
- Mood: warm, trustworthy, hopeful, professional
- Style: editorial photography, 4K quality`;

const IMAGE_SYSTEM_PROMPT_EN = `You are a creative director for a professional insurance agency blog targeting American families. Your job is to write image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography style, warm professional lighting, shallow depth of field
- Each image must feature the SPECIFIC subject type listed in the slot description — do not substitute a group or family if a single person is specified
- Show diverse Americans — vary races, ages, genders, and life situations: white, Black, Asian, Hispanic, mixed-race; young adults, middle-aged professionals, seniors, couples, parents with ONE child
- NEVER default to large multi-generation family gatherings unless the article is explicitly about family legacy
- Settings: American suburban homes, modern offices, parks, community spaces — real-life insurance moments
- NO text, words, signs, logos, or watermarks anywhere in the image
- NO graphic medical content, no death imagery
- Mood: warm, trustworthy, hopeful, professional
- Style: editorial photography, 4K quality`;

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

const SLOT_DESCRIPTIONS: Record<ImageSlot, string> = {
  featured: "Hero image — wide landscape mood, conveys the post's core theme",
  body1: "Opening-section image — scene supports the article's introduction",
  body2: "Mid-article image — scene supports the article's middle section",
  body3: "Conclusion/CTA image — scene conveys action, resolution, or next step",
};

function summarizeTranscript(transcript: string | undefined): string | undefined {
  if (!transcript || transcript.length < 100) return undefined;
  const truncated = transcript.slice(0, 2000);
  const lastPeriod = truncated.lastIndexOf(".");
  return lastPeriod > 500 ? truncated.slice(0, lastPeriod + 1) : truncated;
}

function extractBodyThemes(bodyMarkdown: string): string {
  const headings = bodyMarkdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.replace(/^##\s+/, ""))
    .join(", ");

  const firstParagraph = bodyMarkdown
    .split("\n\n")
    .find((block) => block.trim().length > 50 && !block.startsWith("#"));

  return `Section topics: ${headings}\nIntro: ${firstParagraph?.slice(0, 300) ?? ""}`;
}

function pickRelevantArchetypes(
  pool: string[],
  count: number,
  content: GeneratedBlogContent
): string[] {
  const keywords = [
    content.seo?.focusKeyword?.toLowerCase() ?? "",
    ...(content.tags?.map((t) => t.toLowerCase()) ?? []),
    content.category,
    content.title.toLowerCase(),
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

function buildImageUserPrompt(
  content: GeneratedBlogContent,
  locale: "en" | "es",
  extraction?: YouTubeExtractionResult
): string {
  const pool = locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN;
  const [s1, s2, s3, s4] = pickRelevantArchetypes(pool, 4, content);

  const categoryDesc = CATEGORY_DESCRIPTIONS[content.category] ?? content.category;
  const themes = content.bodyMarkdown ? extractBodyThemes(content.bodyMarkdown) : "";
  const transcriptContext = summarizeTranscript(extraction?.transcript);
  const tags = content.tags?.length ? content.tags.join(", ") : "";
  const focusKeyword = content.seo?.focusKeyword ?? "";
  const seoKeywords = content.seo?.keywords?.length ? content.seo.keywords.join(", ") : "";

  let contextBlock = `Generate image prompts for this insurance blog post.

Title: ${content.title}
Category: ${categoryDesc}
Excerpt: ${content.excerpt}`;

  if (focusKeyword) contextBlock += `\nFocus Keyword: ${focusKeyword}`;
  if (seoKeywords) contextBlock += `\nSEO Keywords: ${seoKeywords}`;
  if (tags) contextBlock += `\nTags: ${tags}`;
  if (themes) contextBlock += `\nArticle Themes:\n${themes}`;
  if (transcriptContext) contextBlock += `\nVideo Context (from source YouTube video):\n${transcriptContext}`;

  return `${contextBlock}

Each image MUST visually represent a DIFFERENT aspect or section of the article. Vary the setting, mood, and activity across all four images — avoid repetitive scenes.

IMPORTANT — each slot has a required subject. Build the scene around that person; do NOT swap them for a group or family.

Return exactly this JSON — no explanation:
{
  "featured": {
    "prompt": "hero image — subject: ${s1} — wide landscape mood, conveys the post's core theme",
    "alt": "descriptive alt text for accessibility (max 125 chars)"
  },
  "body1": {
    "prompt": "opening-section image — subject: ${s2} — scene supports the article's introduction",
    "alt": "descriptive alt text (max 125 chars)"
  },
  "body2": {
    "prompt": "mid-article image — subject: ${s3} — scene supports the article's middle section",
    "alt": "descriptive alt text (max 125 chars)"
  },
  "body3": {
    "prompt": "conclusion/CTA image — subject: ${s4} — scene conveys action, resolution, or next step",
    "alt": "descriptive alt text (max 125 chars)"
  }
}`;
}

function buildSingleImagePrompt(
  content: GeneratedBlogContent,
  locale: "en" | "es",
  slot: ImageSlot,
  extraction?: YouTubeExtractionResult
): string {
  const pool = locale === "es" ? SUBJECT_ARCHETYPES_ES : SUBJECT_ARCHETYPES_EN;
  const [archetype] = pickRelevantArchetypes(pool, 1, content);

  const categoryDesc = CATEGORY_DESCRIPTIONS[content.category] ?? content.category;
  const themes = content.bodyMarkdown ? extractBodyThemes(content.bodyMarkdown) : "";
  const transcriptContext = summarizeTranscript(extraction?.transcript);
  const tags = content.tags?.length ? content.tags.join(", ") : "";
  const focusKeyword = content.seo?.focusKeyword ?? "";
  const seoKeywords = content.seo?.keywords?.length ? content.seo.keywords.join(", ") : "";

  let contextBlock = `Generate ONE image prompt for the "${slot}" slot of this insurance blog post.

Title: ${content.title}
Category: ${categoryDesc}
Excerpt: ${content.excerpt}`;

  if (focusKeyword) contextBlock += `\nFocus Keyword: ${focusKeyword}`;
  if (seoKeywords) contextBlock += `\nSEO Keywords: ${seoKeywords}`;
  if (tags) contextBlock += `\nTags: ${tags}`;
  if (themes) contextBlock += `\nArticle Themes:\n${themes}`;
  if (transcriptContext) contextBlock += `\nVideo Context (from source YouTube video):\n${transcriptContext}`;

  return `${contextBlock}

Slot: ${SLOT_DESCRIPTIONS[slot]}
Required subject: ${archetype}

Return exactly this JSON — no explanation:
{
  "prompt": "${SLOT_DESCRIPTIONS[slot]} — subject: ${archetype}",
  "alt": "descriptive alt text for accessibility (max 125 chars)"
}`;
}

interface ImagePromptItem {
  prompt: string;
  alt: string;
}

interface ImagePromptSet {
  featured: ImagePromptItem;
  body1: ImagePromptItem;
  body2: ImagePromptItem;
  body3: ImagePromptItem;
}

function getSanityWriteClient() {
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

type ImageGenResult = { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };

async function generateDalleImage(
  client: OpenAI,
  prompt: string,
  size: "1536x1024" | "1024x1024"
): Promise<{ buffer: Buffer; revisedPrompt: string }> {
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
  const item = response.data?.[0];
  if (!item?.b64_json) throw new Error("gpt-image-2 returned no image data");
  return {
    buffer: Buffer.from(item.b64_json, "base64"),
    revisedPrompt: item.revised_prompt ?? prompt,
  };
}

async function uploadImageToSanity(
  buffer: Buffer,
  filename: string
): Promise<{ id: string; url: string }> {
  const sanity = getSanityWriteClient();
  const asset = await sanity.assets.upload("image", buffer, {
    filename,
    contentType: "image/png",
  });
  return { id: asset._id, url: asset.url };
}

async function generateImageSet(
  openai: OpenAI,
  model: string,
  content: GeneratedBlogContent,
  locale: "en" | "es",
  extraction?: YouTubeExtractionResult
): Promise<GeneratedImages> {
  const systemPrompt = locale === "en" ? IMAGE_SYSTEM_PROMPT_EN : IMAGE_SYSTEM_PROMPT_ES;
  const localeSuffix = locale;

  let prompts: ImagePromptSet;
  try {
    const raw = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildImageUserPrompt(content, locale, extraction) },
      ],
    });
    prompts = JSON.parse(raw.choices[0].message.content ?? "{}");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${locale}] Failed to generate image prompts: ${msg}`);
  }

  if (!prompts.featured?.prompt || !prompts.body1?.prompt || !prompts.body2?.prompt || !prompts.body3?.prompt) {
    throw new Error(`[${locale}] GPT returned incomplete image prompts`);
  }

  const baseSlug = createSlug(content.title).slice(0, 40);
  const suffix = generateKey().slice(0, 6);

  let featuredDalle: { buffer: Buffer; revisedPrompt: string };
  let body1Dalle: { buffer: Buffer; revisedPrompt: string };
  let body2Dalle: { buffer: Buffer; revisedPrompt: string };
  let body3Dalle: { buffer: Buffer; revisedPrompt: string };

  try {
    [featuredDalle, body1Dalle, body2Dalle, body3Dalle] = await Promise.all([
      generateDalleImage(openai, prompts.featured.prompt, "1536x1024"),
      generateDalleImage(openai, prompts.body1.prompt, "1024x1024"),
      generateDalleImage(openai, prompts.body2.prompt, "1024x1024"),
      generateDalleImage(openai, prompts.body3.prompt, "1024x1024"),
    ]);
  } catch (err) {
    if (err instanceof APIError) {
      console.error(`[image-generator/${locale}] OpenAI APIError:`, {
        status: err.status,
        message: err.message,
        code: err.code,
        type: err.type,
      });
    } else {
      console.error(`[image-generator/${locale}] Unknown error:`, err);
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${locale}] Image generation failed: ${msg}`);
  }

  const [featured, body1, body2, body3] = await Promise.all([
    uploadImageToSanity(featuredDalle.buffer, `${baseSlug}-${localeSuffix}-featured-${suffix}.png`),
    uploadImageToSanity(body1Dalle.buffer, `${baseSlug}-${localeSuffix}-body-1-${suffix}.png`),
    uploadImageToSanity(body2Dalle.buffer, `${baseSlug}-${localeSuffix}-body-2-${suffix}.png`),
    uploadImageToSanity(body3Dalle.buffer, `${baseSlug}-${localeSuffix}-body-3-${suffix}.png`),
  ]).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${locale}] Failed to upload images to Sanity: ${msg}`);
  });

  return {
    featured: {
      assetId: featured.id,
      url: featured.url,
      prompt: prompts.featured.prompt,
      revisedPrompt: featuredDalle.revisedPrompt,
      alt: prompts.featured.alt,
    },
    body: [
      {
        assetId: body1.id,
        url: body1.url,
        prompt: prompts.body1.prompt,
        revisedPrompt: body1Dalle.revisedPrompt,
        alt: prompts.body1.alt,
      },
      {
        assetId: body2.id,
        url: body2.url,
        prompt: prompts.body2.prompt,
        revisedPrompt: body2Dalle.revisedPrompt,
        alt: prompts.body2.alt,
      },
      {
        assetId: body3.id,
        url: body3.url,
        prompt: prompts.body3.prompt,
        revisedPrompt: body3Dalle.revisedPrompt,
        alt: prompts.body3.alt,
      },
    ],
  };
}

export async function generateBlogImages(
  content: GeneratedBlogContent,
  extraction?: YouTubeExtractionResult
): Promise<BilingualImages> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const [en, es] = await Promise.all([
    generateImageSet(openai, model, content, "en", extraction),
    generateImageSet(openai, model, content, "es", extraction),
  ]);

  return { en, es };
}

export async function regenerateSingleImage(
  content: GeneratedBlogContent,
  extraction: YouTubeExtractionResult,
  locale: "en" | "es",
  slot: ImageSlot
): Promise<GeneratedImage> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = locale === "en" ? IMAGE_SYSTEM_PROMPT_EN : IMAGE_SYSTEM_PROMPT_ES;

  let promptItem: ImagePromptItem;
  try {
    const raw = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildSingleImagePrompt(content, locale, slot, extraction) },
      ],
    });
    promptItem = JSON.parse(raw.choices[0].message.content ?? "{}");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${locale}/${slot}] Failed to generate image prompt: ${msg}`);
  }

  if (!promptItem?.prompt) {
    throw new Error(`[${locale}/${slot}] GPT returned empty image prompt`);
  }

  const size: "1536x1024" | "1024x1024" = slot === "featured" ? "1536x1024" : "1024x1024";

  let dalleResult: { buffer: Buffer; revisedPrompt: string };
  try {
    dalleResult = await generateDalleImage(openai, promptItem.prompt, size);
  } catch (err) {
    if (err instanceof APIError) {
      console.error(`[image-generator/${locale}/${slot}] OpenAI APIError:`, {
        status: err.status,
        message: err.message,
        code: err.code,
        type: err.type,
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`[${locale}/${slot}] Image generation failed: ${msg}`);
  }

  const baseSlug = createSlug(content.title).slice(0, 40);
  const suffix = generateKey().slice(0, 6);
  const slotLabel = slot === "featured" ? "featured" : `body-${slot.replace("body", "")}`;
  const filename = `${baseSlug}-${locale}-${slotLabel}-${suffix}.png`;

  const uploaded = await uploadImageToSanity(dalleResult.buffer, filename);

  return {
    assetId: uploaded.id,
    url: uploaded.url,
    prompt: promptItem.prompt,
    revisedPrompt: dalleResult.revisedPrompt,
    alt: promptItem.alt,
  };
}
