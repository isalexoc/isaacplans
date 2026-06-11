import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import type { ImageGenerationRequest, SocialCreativeImages } from "./types";

const CATEGORY_SCENES: Record<string, string> = {
  "final-expense":              "warm home setting with an elderly couple reviewing documents together, natural light, peaceful and reassuring atmosphere",
  "aca":                        "healthy diverse family outdoors on a sunny day, smiling, optimistic and bright energy",
  "temporary-health-insurance": "young professional working from a modern home office, relaxed and confident",
  "dental-vision":              "smiling person at a bright modern dental clinic, warm and professional environment",
  "hospital-indemnity":         "caring doctor with a patient in a clean hospital room, reassuring and hopeful",
  "iul":                        "family celebrating a milestone together, subtle financial growth symbolism, warm tones",
  "cancer-plans":               "person surrounded by a loving support network, hopeful and uplifting atmosphere",
  "heart-stroke":               "active senior exercising outdoors, vibrant and healthy lifestyle",
  "general":                    "professional consultation between two people at a desk, modern office, trust and clarity",
  "tips-guides":                "person reading and taking notes at a clean organized desk, focused and empowered",
  "news":                       "clean editorial background, subtle infographic elements, professional and modern",
};

function buildDallePrompt(sourceTitle: string, category?: string): string {
  const scene = CATEGORY_SCENES[category ?? ""] ?? CATEGORY_SCENES["general"];
  return [
    `Professional editorial illustration for an insurance blog: ${scene}.`,
    `Color palette: deep ocean blue (#0077B6) and clean white with light blue (#00B4D8) accents.`,
    `Style: clean, minimal, corporate digital illustration. Magazine editorial quality.`,
    `IMPORTANT: No text, no words, no numbers, no logos anywhere in the image.`,
    `Aspect: neutral composition that works cropped to both square and vertical formats.`,
  ].join(" ");
}

// Encode text for Cloudinary text layers: spaces → underscores, commas/slashes → percent-encoded
function encodeCloudinaryText(text: string): string {
  return text
    .replace(/,/g, "%2C")
    .replace(/\//g, "%2F")
    .replace(/ /g, "_");
}

function buildTransformUrl(
  publicId: string,
  ratio: "1:1" | "9:16",
  encodedHeadline: string,
  brandName: string
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const [w, h]    = ratio === "1:1" ? [1080, 1080] : [1080, 1920];
  const fontSize  = ratio === "1:1" ? 52 : 56;
  const brandSize = ratio === "1:1" ? 24 : 28;
  const textY     = ratio === "1:1" ? 120 : 200;

  const transforms = [
    `c_fill,w_${w},h_${h},g_auto`,
    `e_gradient_fade,y_-0.5,b_rgb:000000`,
    `l_text:Arial_${fontSize}_bold:${encodedHeadline},co_white,g_south,y_${textY},w_${w - 180},c_fit`,
    `l_text:Arial_${brandSize}:${brandName},co_white,g_north_east,x_30,y_30,o_80`,
  ].join("/");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

export async function generateSocialImages(
  req: ImageGenerationRequest
): Promise<{ images: SocialCreativeImages; warnings: string[] }> {
  const warnings: string[] = [];
  let basePublicId: string | null = null;
  let sourceImageUrl = req.sourceImageUrl ?? "";
  let generatedByAI = false;

  // ─── Step 1: Obtain a Cloudinary public_id for the base image ─────────────

  if (!req.generateNew && req.sourceImageUrl) {
    try {
      const uploadResult = await cloudinary.uploader.upload(req.sourceImageUrl, {
        folder:        `social-media/${req.category ?? "general"}/sources`,
        resource_type: "image",
      });
      basePublicId = uploadResult.public_id;
    } catch (err) {
      warnings.push(`Source image upload failed: ${(err as Error).message}. Will generate via AI.`);
    }
  }

  if (!basePublicId) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.images.generate({
        model:   "dall-e-3",
        prompt:  buildDallePrompt(req.sourceTitle ?? req.headline, req.category),
        size:    "1024x1024",
        quality: "standard",
        n:       1,
      });

      const dalleUrl = response.data?.[0]?.url;
      if (!dalleUrl) throw new Error("DALL-E returned no image URL");

      const uploadResult = await cloudinary.uploader.upload(dalleUrl, {
        folder:        `social-media/${req.category ?? "general"}/backgrounds`,
        resource_type: "image",
      });

      basePublicId   = uploadResult.public_id;
      sourceImageUrl = dalleUrl;
      generatedByAI  = true;
    } catch (err) {
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

  // ─── Step 2: Build Cloudinary transformation URLs ──────────────────────────

  const encodedHeadline = encodeCloudinaryText(req.headline);
  const brandName       = "Isaac%20Plans";

  const square   = buildTransformUrl(basePublicId, "1:1",  encodedHeadline, brandName);
  const vertical = buildTransformUrl(basePublicId, "9:16", encodedHeadline, brandName);

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
