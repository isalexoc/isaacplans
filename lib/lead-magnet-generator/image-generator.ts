import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import type { LeadMagnetOutline, LeadMagnetImages } from "./types";

type ImageGenResult = { data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }> };

export function selectSectionIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  return [0.2, 0.45, 0.7, 0.9].map((pct) => Math.min(Math.floor(pct * n), n - 1));
}

async function buildCoverPrompt(client: OpenAI, outline: LeadMagnetOutline): Promise<string> {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You are a creative director for a professional insurance agency. Write a single image prompt for a lead magnet cover page. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, no words anywhere in the image. Mood: trustworthy, hopeful, clean.",
      },
      {
        role: "user",
        content: `Title: ${outline.title}\nSubtitle: ${outline.subtitle}\nCategory: ${outline.category}\nKey benefits: ${outline.keyBenefits.slice(0, 3).join("; ")}\n\nReturn only the image prompt, nothing else.`,
      },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Professional insurance guide cover for ${outline.category}, warm lighting, photorealistic, no text`
  );
}

async function buildSectionPrompt(
  client: OpenAI,
  outline: LeadMagnetOutline,
  sectionIndex: number
): Promise<string> {
  const section = outline.sections[sectionIndex];
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content:
          "You are a creative director for a professional insurance agency. Write a single image prompt for an insurance guide section illustration. The prompt must produce a photorealistic, warm, professional photograph. No text, no logos, no words anywhere in the image.",
      },
      {
        role: "user",
        content: `Section: ${section.sectionTitle}\nKey points: ${section.keyPoints.slice(0, 2).join("; ")}\nCategory: ${outline.category}\n\nReturn only the image prompt, nothing else.`,
      },
    ],
  });
  return (
    response.choices[0]?.message?.content?.trim() ??
    `Insurance professional illustration for ${section.sectionTitle}, warm lighting, photorealistic, no text`
  );
}

async function generateAndUpload(
  client: OpenAI,
  prompt: string,
  size: "1536x1024" | "1024x1024",
  folder: string,
  publicId: string
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

  const uploaded = await cloudinary.uploader.upload(`data:image/png;base64,${b64}`, {
    folder,
    public_id: publicId,
    resource_type: "image",
  });
  return uploaded.secure_url;
}

export async function generateLeadMagnetImages(
  outline: LeadMagnetOutline
): Promise<{ images: LeadMagnetImages; warnings: string[] }> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
    throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not configured");
  }
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY && !process.env.CLOUDINARY_API_KEY) {
    throw new Error("Cloudinary API key is not configured (set NEXT_PUBLIC_CLOUDINARY_API_KEY or CLOUDINARY_API_KEY)");
  }
  if (!process.env.CLOUDINARY_API_SECRET) {
    throw new Error("CLOUDINARY_API_SECRET is not configured");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const warnings: string[] = [];
  const { category } = outline;
  const sectionIndices = selectSectionIndices(outline.sections.length);

  let coverImage = "";
  try {
    const prompt = await buildCoverPrompt(client, outline);
    coverImage = await generateAndUpload(
      client,
      prompt,
      "1536x1024",
      `lead-magnets/${category}`,
      `cover-${Date.now()}`
    );
  } catch (err) {
    warnings.push(`Cover image failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const sectionImages: string[] = [];
  for (const idx of sectionIndices) {
    try {
      const prompt = await buildSectionPrompt(client, outline, idx);
      const url = await generateAndUpload(
        client,
        prompt,
        "1024x1024",
        `lead-magnets/${category}/sections`,
        `section-${idx}-${Date.now()}`
      );
      sectionImages.push(url);
    } catch (err) {
      warnings.push(`Section ${idx} image failed: ${err instanceof Error ? err.message : String(err)}`);
      sectionImages.push("");
    }
  }

  return { images: { coverImage, sectionImages }, warnings };
}
