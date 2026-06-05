import OpenAI, { APIError } from "openai";
import { createClient } from "next-sanity";
import { createSlug, generateKey } from "./portable-text";
import type { GeneratedBlogContent, GeneratedImages, BilingualImages } from "./types";

const IMAGE_SYSTEM_PROMPT_ES = `You are a creative director for a professional insurance agency blog targeting Hispanic/Latino families in the United States. Your job is to write image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography style, warm professional lighting, shallow depth of field
- Show Hispanic/Latino people — families, couples, seniors, professionals
- Settings: warm homes, family gatherings, community spaces, outdoors — real-life insurance moments
- NO text, words, signs, logos, or watermarks anywhere in the image
- NO graphic medical content, no death imagery
- Mood: warm, trustworthy, hopeful, professional
- Style: editorial photography, 4K quality`;

const IMAGE_SYSTEM_PROMPT_EN = `You are a creative director for a professional insurance agency blog targeting American families. Your job is to write image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography style, warm professional lighting, shallow depth of field
- Show diverse American people — white, Black, Asian, and mixed-race families, couples, seniors, professionals
- Settings: American suburban homes, modern offices, parks, community spaces — real-life insurance moments
- NO text, words, signs, logos, or watermarks anywhere in the image
- NO graphic medical content, no death imagery
- Mood: warm, trustworthy, hopeful, professional
- Style: editorial photography, 4K quality`;

function buildImageUserPrompt(content: GeneratedBlogContent): string {
  return `Generate image prompts for this insurance blog post.

Title: ${content.title}
Category: ${content.category}
Excerpt: ${content.excerpt}

Return exactly this JSON — no explanation:
{
  "featured": {
    "prompt": "highly detailed prompt for the hero image (most impactful, wide landscape mood, conveys the post's core theme)",
    "alt": "descriptive alt text for accessibility (max 125 chars)"
  },
  "body1": {
    "prompt": "prompt for image supporting the opening section of the article",
    "alt": "descriptive alt text (max 125 chars)"
  },
  "body2": {
    "prompt": "prompt for image supporting the middle section of the article",
    "alt": "descriptive alt text (max 125 chars)"
  },
  "body3": {
    "prompt": "prompt for image near the conclusion or call-to-action section",
    "alt": "descriptive alt text (max 125 chars)"
  }
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
  locale: "en" | "es"
): Promise<GeneratedImages> {
  const systemPrompt = locale === "en" ? IMAGE_SYSTEM_PROMPT_EN : IMAGE_SYSTEM_PROMPT_ES;
  const localeSuffix = locale;

  // Generate prompts
  let prompts: ImagePromptSet;
  try {
    const raw = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildImageUserPrompt(content) },
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

  // Generate 4 images in parallel
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

  // Upload 4 images to Sanity in parallel
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
  content: GeneratedBlogContent
): Promise<BilingualImages> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const [en, es] = await Promise.all([
    generateImageSet(openai, model, content, "en"),
    generateImageSet(openai, model, content, "es"),
  ]);

  return { en, es };
}
