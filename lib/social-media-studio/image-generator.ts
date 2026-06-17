import OpenAI from "openai";
import cloudinary from "@/config/cloudinary";
import { renderSocialImages } from "./image-renderer";
import type { ImageGenerationRequest, SocialCreativeImages } from "./types";

// ─── Fallback scenes (used when GPT concept generation fails or no content available) ──

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

// ─── Variation seeds ────────────────────────────────────────────────────────────
// Appended randomly to every prompt so regenerations produce different lighting/mood,
// even when the visual concept and category are identical.

const VARIATION_MOODS = [
  "golden hour sunlight, rich amber warmth",
  "soft diffused morning light, fresh and bright",
  "gentle overcast natural light, clean airy feel",
  "late afternoon sun, warm honey-toned glow",
  "soft indoor window light, intimate and calm",
  "dappled outdoor shade, vibrant and lush",
  "early morning mist, serene and hopeful",
  "bright midday sun, energetic and vivid",
];

function pickVariationMood(): string {
  return VARIATION_MOODS[Math.floor(Math.random() * VARIATION_MOODS.length)];
}

// ─── GPT visual concept generator ──────────────────────────────────────────────
// Calls GPT-4o-mini to synthesize a specific photographic scene from post content.
// Returns a 1–2 sentence scene description tailored to the article/lead magnet.

// ─── Locale-based demographic instructions ──────────────────────────────────────
// Spanish-locale content targets the Hispanic/Latino market → subjects should
// reflect that community. English-locale content uses diverse American subjects.

function getDemographicHint(locale?: string): string {
  if (locale === "es") {
    return "Subjects must be Latino/Hispanic — warm brown skin tones, dark hair, authentic Hispanic warmth and family culture.";
  }
  return "Subjects should be diverse American — reflecting the broad multicultural United States population.";
}

async function generateVisualConcept(
  openai: OpenAI,
  title: string,
  category: string,
  locale?: string,
  subtitle?: string,
  bodyText?: string
): Promise<string | null> {
  const contentSnippet = [
    title,
    subtitle ?? "",
    (bodyText ?? "").slice(0, 500),
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!contentSnippet) return null;

  const categoryHint = CATEGORY_SCENES[category] ? `Insurance niche: ${category.replace(/-/g, " ")}.` : "";
  const demographicHint = getDemographicHint(locale);

  const userMessage = `Create a photographic scene description for a professional social media ad image based on this insurance content:\n\n${contentSnippet}\n\n${categoryHint}\n${demographicHint}\n\nReturn ONLY the scene description. No preamble, no quotes, no extra text.`;

  try {
    const completion = await openai.chat.completions.create({
      model:       process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      max_tokens:  120,
      temperature: 0.9,
      messages: [
        {
          role:    "system",
          content:
            "You are a professional art director. Return ONLY a 1–2 sentence photographic scene description (subjects, emotion, setting, key visual detail) appropriate for a hyper-realistic professional social media ad photograph. Be specific to the content provided. Do NOT use the word 'insurance'.",
        },
        { role: "user", content: userMessage },
      ],
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("[generate-social-images] GPT concept generation failed, using fallback:", (err as Error).message);
    return null;
  }
}

// ─── DALL-E prompt builder ──────────────────────────────────────────────────────

function buildImagePrompt(scene: string, locale?: string): string {
  const mood = pickVariationMood();
  const demographic = getDemographicHint(locale);
  return [
    `Cinematic professional portrait photograph: ${scene}.`,
    `Lighting: ${mood}.`,
    `Camera: Canon EOS R5, 85mm f/1.4 portrait lens, shallow depth of field with soft bokeh background.`,
    `Mood: emotionally authentic, warm color grading.`,
    demographic,
    `CRITICAL COMPOSITION — place ALL faces and upper bodies in the TOP THIRD of the square frame only.`,
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

  // ─── Step 1: Resolve the base image URL ────────────────────────────────────
  // For "use source image": upload to Cloudinary to get a stable CDN-hosted URL.
  // For "generate new": build a content-aware prompt then call DALL-E.

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

      // Generate content-aware visual concept from post data; fall back to category scene.
      const generatedConcept = await generateVisualConcept(
        openai,
        req.sourceTitle ?? req.headline,
        req.category ?? "general",
        req.locale,
        req.subtitle,
        req.bodyText
      );
      const scene =
        generatedConcept ??
        CATEGORY_SCENES[req.category ?? ""] ??
        CATEGORY_SCENES["general"];

      const response = await openai.images.generate({
        model:   (process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1") as "gpt-image-1",
        prompt:  buildImagePrompt(scene, req.locale),
        quality: "high",
        size:    "1024x1024",
        n:       1,
      } as Parameters<typeof openai.images.generate>[0]);

      // gpt-image-1 returns base64 data, not a URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b64 = (response as any).data?.[0]?.b64_json;
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

  // ─── Step 2: Render branded card images via next/og and upload to Cloudinary ─

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
