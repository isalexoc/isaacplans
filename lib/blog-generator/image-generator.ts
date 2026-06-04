import OpenAI from "openai";
import { createClient } from "next-sanity";
import { createSlug, generateKey } from "./portable-text";
import type { GeneratedBlogContent, GeneratedImages } from "./types";

const IMAGE_SYSTEM_PROMPT = `You are a creative director for a professional insurance agency blog targeting Hispanic/Latino families in the United States. Your job is to write DALL-E 3 image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography style, warm professional lighting, shallow depth of field
- Show diverse people with Hispanic/Latino representation welcome
- Settings: homes, families, offices, outdoors — real-life insurance moments
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
    "prompt": "highly detailed DALL-E 3 prompt for the hero image (most impactful, wide landscape mood, conveys the post's core theme)",
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

type ImageGenResult = { data?: Array<{ url?: string; revised_prompt?: string }> };

async function generateDalleImage(
  client: OpenAI,
  prompt: string,
  size: "1536x1024" | "1024x1024"
): Promise<{ url: string; revisedPrompt: string }> {
  const response = (await (client.images.generate as unknown as (
    body: Record<string, unknown>
  ) => Promise<ImageGenResult>)({
    model: "gpt-image-2",
    prompt,
    n: 1,
    size,
    quality: "medium",
  }));
  const item = response.data?.[0];
  if (!item?.url) throw new Error("gpt-image-2 returned no image URL");
  return {
    url: item.url,
    revisedPrompt: item.revised_prompt ?? prompt,
  };
}

async function uploadImageToSanity(
  imageUrl: string,
  filename: string
): Promise<string> {
  const sanity = getSanityWriteClient();
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch generated image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const asset = await sanity.assets.upload("image", buffer, {
    filename,
    contentType: "image/png",
  });
  return asset._id;
}

export async function generateBlogImages(
  content: GeneratedBlogContent
): Promise<GeneratedImages> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. Generate all 4 prompts with one GPT call
  let prompts: ImagePromptSet;
  try {
    const promptsRaw = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: IMAGE_SYSTEM_PROMPT },
        { role: "user", content: buildImageUserPrompt(content) },
      ],
    });
    prompts = JSON.parse(promptsRaw.choices[0].message.content ?? "{}");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to generate image prompts: ${msg}`);
  }

  if (!prompts.featured?.prompt || !prompts.body1?.prompt || !prompts.body2?.prompt || !prompts.body3?.prompt) {
    throw new Error("GPT returned incomplete image prompts");
  }

  const baseSlug = createSlug(content.title).slice(0, 40);
  const suffix = generateKey().slice(0, 6);

  // 2. Generate all 4 images in parallel (DALL-E 3 only supports n=1 per call)
  let featuredDalle: { url: string; revisedPrompt: string };
  let body1Dalle: { url: string; revisedPrompt: string };
  let body2Dalle: { url: string; revisedPrompt: string };
  let body3Dalle: { url: string; revisedPrompt: string };

  try {
    [featuredDalle, body1Dalle, body2Dalle, body3Dalle] = await Promise.all([
      generateDalleImage(openai, prompts.featured.prompt, "1536x1024"),
      generateDalleImage(openai, prompts.body1.prompt, "1024x1024"),
      generateDalleImage(openai, prompts.body2.prompt, "1024x1024"),
      generateDalleImage(openai, prompts.body3.prompt, "1024x1024"),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DALL-E image generation failed: ${msg}`);
  }

  // 3. Upload all 4 to Sanity in parallel
  let featuredId: string;
  let body1Id: string;
  let body2Id: string;
  let body3Id: string;

  try {
    [featuredId, body1Id, body2Id, body3Id] = await Promise.all([
      uploadImageToSanity(featuredDalle.url, `${baseSlug}-featured-${suffix}.png`),
      uploadImageToSanity(body1Dalle.url, `${baseSlug}-body-1-${suffix}.png`),
      uploadImageToSanity(body2Dalle.url, `${baseSlug}-body-2-${suffix}.png`),
      uploadImageToSanity(body3Dalle.url, `${baseSlug}-body-3-${suffix}.png`),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to upload generated images to Sanity: ${msg}`);
  }

  return {
    featured: {
      assetId: featuredId,
      url: featuredDalle.url,
      prompt: prompts.featured.prompt,
      revisedPrompt: featuredDalle.revisedPrompt,
      alt: prompts.featured.alt,
    },
    body: [
      {
        assetId: body1Id,
        url: body1Dalle.url,
        prompt: prompts.body1.prompt,
        revisedPrompt: body1Dalle.revisedPrompt,
        alt: prompts.body1.alt,
      },
      {
        assetId: body2Id,
        url: body2Dalle.url,
        prompt: prompts.body2.prompt,
        revisedPrompt: body2Dalle.revisedPrompt,
        alt: prompts.body2.alt,
      },
      {
        assetId: body3Id,
        url: body3Dalle.url,
        prompt: prompts.body3.prompt,
        revisedPrompt: body3Dalle.revisedPrompt,
        alt: prompts.body3.alt,
      },
    ],
  };
}
