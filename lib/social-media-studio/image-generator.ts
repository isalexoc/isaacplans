import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { renderSocialImages } from "./image-renderer";
import type { ImageGenerationRequest, SocialCreativeImages } from "./types";

const CATEGORY_SCENES: Record<string, string> = {
  "final-expense":              "tender moment between an elderly man and woman holding hands on a park bench, warm afternoon sunlight filtering through trees, genuine loving expressions on their faces",
  "aca":                        "vibrant healthy family of four — parents and two children — laughing together in a sunny outdoor park, genuine authentic joy on their faces",
  "temporary-health-insurance": "confident smiling young man or woman in casual professional attire, bright airy modern living space or café, relaxed and optimistic expression",
  "dental-vision":              "close-up portrait of a person flashing a wide radiant genuine smile, soft studio lighting, bright and clean aesthetic, face filling the upper frame",
  "hospital-indemnity":         "empathetic doctor in white coat leaning forward with a reassuring smile toward a patient, warm and trustworthy expression, clean bright clinic",
  "iul":                        "joyful multigenerational family — grandparents, parents, and children — embracing warmly outdoors in a garden, golden hour light on their happy faces",
  "cancer-plans":               "person with a strong hopeful expression being warmly embraced by a partner or close friend, soft natural outdoor light, warmth and resilience on their faces",
  "heart-stroke":               "energetic senior man or woman in athletic wear smiling while jogging or walking in a lush green park, vitality and good health radiating from their expression",
  "general":                    "a professional advisor and a client sitting across from each other, both smiling warmly during a conversation at a bright modern desk, trust and confidence",
  "tips-guides":                "focused young professional reading important documents at a clean organized desk by a sunny window, engaged confident expression, warm natural light",
  "news":                       "business professional in smart attire reviewing documents at a modern glass-and-wood desk, thoughtful confident expression, bright contemporary office",
};

function buildImagePrompt(headline: string, category?: string): string {
  const scene = CATEGORY_SCENES[category ?? ""] ?? CATEGORY_SCENES["general"];
  return [
    `Cinematic professional portrait photograph: ${scene}.`,
    `Camera: Canon EOS R5, 85mm f/1.4 portrait lens, natural soft window light or warm golden hour.`,
    `Mood: emotionally authentic, warm color grading, shallow depth of field with soft bokeh background.`,
    `CRITICAL COMPOSITION — this square image will be displayed in a tall portrait frame where the bottom half is hidden by a text overlay:`,
    `Place ALL faces and upper bodies in the TOP THIRD of the square frame only.`,
    `The BOTTOM HALF of the image must be completely open — blurred background, bokeh, soft ground, or empty space only. No faces or subjects below the midpoint.`,
    `PROHIBITED: No text, words, numbers, signs, logos, watermarks, or graphic overlays of any kind anywhere in the image.`,
    `STYLE: Hyper-realistic professional photograph. Absolutely NOT an illustration, NOT vector art, NOT a painting, NOT CGI render, NOT digital art. Real photography only.`,
  ].join(" ");
}

export async function generateSocialImages(
  req: ImageGenerationRequest
): Promise<{ images: SocialCreativeImages; warnings: string[] }> {
  const warnings: string[] = [];
  let sourceImageUrl = req.sourceImageUrl ?? "";
  let generatedByAI = false;

  // ─── Step 1: Resolve the base image URL ───────────────────────────────────────
  // For "use source image": upload to Cloudinary to get a stable CDN-hosted URL,
  // then use that as the background for the rendered card.
  // For "generate new": create via DALL-E 3 and use the returned URL directly.

  let resolvedImageUrl: string | null = null;

  if (!req.generateNew && req.sourceImageUrl) {
    try {
      const uploadResult = await cloudinary.uploader.upload(req.sourceImageUrl, {
        folder:        `social-media/${req.category ?? "general"}/sources`,
        resource_type: "image",
      });
      resolvedImageUrl = uploadResult.secure_url;
    } catch (err) {
      warnings.push(`Source image upload failed: ${(err as Error).message}. Will generate via AI.`);
    }
  }

  if (!resolvedImageUrl) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.images.generate({
        model:   (process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1") as "gpt-image-1",
        prompt:  buildImagePrompt(req.sourceTitle ?? req.headline, req.category),
        quality: "high",
        size:    "1024x1024",
        n:       1,
      } as Parameters<typeof openai.images.generate>[0]);

      // gpt-image-1 (and gpt-image-2) return base64 data, not a URL
      const b64 = response.data?.[0]?.b64_json;
      if (!b64) throw new Error("Image model returned no image data");

      const uploadResult = await cloudinary.uploader.upload(
        `data:image/png;base64,${b64}`,
        { folder: `social-media/${req.category ?? "general"}/backgrounds`, resource_type: "image" }
      );

      resolvedImageUrl = uploadResult.secure_url;
      sourceImageUrl   = uploadResult.secure_url;
      generatedByAI    = true;
    } catch (err) {
      console.error("[generate-social-images] DALL-E/Cloudinary step failed:", err);
      warnings.push(`AI image generation failed: ${(err as Error).message}`);
      return {
        images: {
          square:         "",
          vertical:       "",
          sourceImageUrl: "",
          headline:       req.headline,
          generatedByAI:  false,
        },
        warnings,
      };
    }
  }

  // ─── Step 2: Render branded card images via next/og and upload to Cloudinary ──

  const { square, vertical } = await renderSocialImages(
    req.headline,
    resolvedImageUrl,
    req.category ?? "general",
    `social-media/${req.category ?? "general"}/cards`,
    Date.now()
  );

  return {
    images: {
      square,
      vertical,
      sourceImageUrl,
      headline: req.headline,
      generatedByAI,
    },
    warnings,
  };
}
