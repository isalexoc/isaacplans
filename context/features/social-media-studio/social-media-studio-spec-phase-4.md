# Social Media Content Studio — Phase 4 Spec

## Context

Phases 1–3 built the data model, source API, and AI copy generator.

**Phase 4 (this doc):** AI Image Generation — produce two branded creative images per post package: a 1:1 square (1080×1080) for Facebook/Instagram/Threads/Google Business and a 9:16 vertical (1080×1920) for Instagram Stories, TikTok covers, and Reels thumbnails. Images are generated via DALL-E 3 (or sourced from the existing content image), uploaded to Cloudinary, and returned as transformation URLs with brand overlays applied.

**Remaining phases:** Phase 5 (video scripts), Phase 6 (admin UI), Phase 7 (publish + history).

---

## Phase 4: AI Image Generation

### Goal

Build the image generation service that:
1. If the source content has an existing image (blog featured image or lead magnet cover): uploads it to Cloudinary and applies branded overlay transformations to produce 1:1 and 9:16 versions
2. If no source image exists or the user requests a new AI image: generates a scene via DALL-E 3, uploads to Cloudinary, then applies the same branded overlay transformations
3. Returns two final Cloudinary transformation URLs — one square, one vertical — as `SocialCreativeImages`

Image generation is **non-fatal**: if DALL-E fails, fall back to the source image if available. If both fail, return empty strings with a warning rather than blocking the pipeline.

### What to Build

1. **`lib/social-media-studio/image-generator.ts`** — image generation + Cloudinary upload + transformation URL builder
2. **`app/api/admin/social-media-studio/generate-images/route.ts`** — Clerk-authenticated POST route

---

### Cloudinary Transformation Strategy

All creative images are built from a base uploaded to Cloudinary, with text overlay and brand watermark applied as Cloudinary URL transformations. No server-side canvas rendering is needed — Cloudinary applies the composite on-demand and caches it.

**Transformation chain for 1:1 (square):**
```
c_fill,w_1080,h_1080,g_auto/          ← crop to square, smart gravity
e_gradient_fade,y_-0.5,b_rgb:000000/ ← dark gradient fade from bottom 50%
l_text:Arial_52_bold:{headline},co_white,g_south,y_120,w_900,c_fit/  ← headline text
l_text:Arial_24:Isaac%20Plans,co_white,g_north_east,x_30,y_30,o_80/  ← brand watermark
{cloudinary_public_id}
```

**Transformation chain for 9:16 (vertical):**
```
c_fill,w_1080,h_1920,g_auto/          ← crop to vertical, smart gravity
e_gradient_fade,y_-0.5,b_rgb:000000/ ← dark gradient fade from bottom 50%
l_text:Arial_56_bold:{headline},co_white,g_south,y_200,w_900,c_fit/  ← headline text (slightly larger)
l_text:Arial_28:Isaac%20Plans,co_white,g_north_east,x_40,y_40,o_80/  ← brand watermark
{cloudinary_public_id}
```

**Important:** The headline text must be URL-encoded for Cloudinary text layers. Use `encodeURIComponent(headline).replace(/%20/g, "_")` — Cloudinary uses `_` for spaces in text overlays.

Build transformation URLs using the Cloudinary Node SDK's `cloudinary.url()` method with transformation array syntax rather than manual string construction. This avoids encoding bugs.

---

### DALL-E 3 Background Image Generation

When a new AI background is needed, generate a clean scene image **without any text**. The text is added later via Cloudinary transformations.

#### Category scene map

```ts
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
```

#### DALL-E prompt builder

```ts
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
```

**DALL-E 3 parameters:**
- `model: "dall-e-3"`
- `size: "1024x1024"` — square base image works for both 1:1 and 9:16 crops via Cloudinary
- `quality: "standard"` — sufficient quality; avoids "hd" latency
- `n: 1`

---

### Service: `lib/social-media-studio/image-generator.ts`

```ts
import OpenAI from "openai";
import { v2 as cloudinary } from "cloudinary";
import type { ImageGenerationRequest, SocialCreativeImages } from "./types";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function generateSocialImages(
  req: ImageGenerationRequest
): Promise<SocialCreativeImages> {
  const warnings: string[] = [];
  let basePublicId: string | null = null;
  let sourceImageUrl = req.sourceImageUrl ?? "";
  let generatedByAI = false;

  // ─── Step 1: Obtain a Cloudinary public_id for the base image ─────────────

  if (!req.generateNew && req.sourceImageUrl) {
    // Upload the source image to Cloudinary (or re-use if already there)
    try {
      const uploadResult = await cloudinary.uploader.upload(req.sourceImageUrl, {
        folder:         `social-media/${req.category ?? "general"}/sources`,
        resource_type:  "image",
        // If the URL is already a Cloudinary URL, Cloudinary deduplicates automatically
      });
      basePublicId = uploadResult.public_id;
    } catch (err) {
      warnings.push(`Source image upload failed: ${(err as Error).message}. Will generate via AI.`);
    }
  }

  if (!basePublicId) {
    // Generate a new background image via DALL-E 3
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.images.generate({
        model:   "dall-e-3",
        prompt:  buildDallePrompt(req.sourceTitle ?? req.headline, req.category),
        size:    "1024x1024",
        quality: "standard",
        n:       1,
      });

      const dalleUrl = response.data[0]?.url;
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
      // Return empty URLs — the UI will show a fallback/error state
      return {
        square:         "",
        vertical:       "",
        sourceImageUrl: "",
        headline:       req.headline,
        generatedByAI:  false,
      };
    }
  }

  // ─── Step 2: Build Cloudinary transformation URLs ──────────────────────────

  const encodedHeadline = encodeCloudinaryText(req.headline);
  const brandName       = "Isaac%20Plans"; // pre-encoded

  const square   = buildTransformUrl(basePublicId, "1:1",   encodedHeadline, brandName);
  const vertical = buildTransformUrl(basePublicId, "9:16",  encodedHeadline, brandName);

  return {
    square,
    vertical,
    sourceImageUrl,
    headline: req.headline,
    generatedByAI,
  };
}

/**
 * Encode text for Cloudinary text layer: spaces become underscores,
 * special chars are percent-encoded.
 */
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
  const cloudName   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const [w, h]      = ratio === "1:1" ? [1080, 1080] : [1080, 1920];
  const fontSize    = ratio === "1:1" ? 52 : 56;
  const brandSize   = ratio === "1:1" ? 24 : 28;
  const textY       = ratio === "1:1" ? 120 : 200;
  const brandX      = 30;
  const brandY      = 30;

  // Build as Cloudinary URL transformation string
  const transforms = [
    `c_fill,w_${w},h_${h},g_auto`,
    `e_gradient_fade,y_-0.5,b_rgb:000000`,
    `l_text:Arial_${fontSize}_bold:${encodedHeadline},co_white,g_south,y_${textY},w_${w - 180},c_fit`,
    `l_text:Arial_${brandSize}:${brandName},co_white,g_north_east,x_${brandX},y_${brandY},o_80`,
  ].join("/");

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}
```

---

### API Route

**File:** `app/api/admin/social-media-studio/generate-images/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { generateSocialImages } from "@/lib/social-media-studio/image-generator";
import type { ImageGenerationRequest, SocialStudioResponse, SocialCreativeImages } from "@/lib/social-media-studio/types";

export const maxDuration = 120; // DALL-E + Cloudinary upload can take 30–60 seconds

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: ImageGenerationRequest = await req.json();

  if (!body.headline) {
    return NextResponse.json({ success: false, error: "headline is required" }, { status: 400 });
  }

  // Always return success: true — failures are captured as warnings with empty image URLs
  const images = await generateSocialImages(body);

  const response: SocialStudioResponse<SocialCreativeImages> = {
    success: true,
    data:    images,
  };
  return NextResponse.json(response);
}
```

**Request body:**
```json
{
  "sourceImageUrl": "https://cdn.sanity.io/images/.../cover.jpg",
  "generateNew": false,
  "headline": "Understanding Final Expense Insurance",
  "category": "final-expense",
  "sourceTitle": "Understanding Final Expense Insurance for Seniors"
}
```

**Success response (even on AI failure — always 200):**
```json
{
  "success": true,
  "data": {
    "square": "https://res.cloudinary.com/mycloud/image/upload/c_fill,w_1080,h_1080,g_auto/.../social-media/final-expense/backgrounds/bg-1234.jpg",
    "vertical": "https://res.cloudinary.com/mycloud/image/upload/c_fill,w_1080,h_1920,g_auto/.../social-media/final-expense/backgrounds/bg-1234.jpg",
    "sourceImageUrl": "https://cdn.sanity.io/...",
    "headline": "Understanding Final Expense Insurance",
    "generatedByAI": false
  },
  "warnings": []
}
```

---

### Cloudinary Folder Structure

All social media images live under `social-media/`:
```
social-media/
  {category}/
    sources/     ← existing blog/lead-magnet images uploaded here
    backgrounds/ ← DALL-E generated backgrounds uploaded here
```

---

### Environment Variables

No new environment variables. Uses existing:
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY` (check existing usage — may be called `CLOUDINARY_API_KEY` or similar)
- `CLOUDINARY_API_SECRET`
- `OPENAI_API_KEY`

Verify the exact Cloudinary env var names by checking how `cloudinary.config()` is called in the existing codebase (check `lib/lead-magnet-generator/image-generator.ts`).

---

### File Structure After Phase 4

```
lib/
  social-media-studio/
    types.ts              ← Phase 1
    source-fetcher.ts     ← Phase 2
    prompts.ts            ← Phase 3
    copy-generator.ts     ← Phase 3
    image-generator.ts    ← NEW
app/
  api/
    admin/
      social-media-studio/
        sources/...        ← Phase 2
        generate-copy/...  ← Phase 3
        generate-images/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 4 is complete when:

1. `POST /api/admin/social-media-studio/generate-images` with a `headline` and a valid `sourceImageUrl` returns a `SocialCreativeImages` object where both `square` and `vertical` are non-empty Cloudinary URLs
2. Opening the `square` URL in a browser shows a 1080×1080 image with the headline text overlaid and "Isaac Plans" watermark visible
3. Opening the `vertical` URL shows a 1080×1920 image with the same overlays
4. With `generateNew: true`, the service calls DALL-E 3 and produces a brand-appropriate scene (no text in the generated image)
5. If DALL-E fails, the route still returns `success: true` with empty `square`/`vertical` strings and a non-empty `warnings` array (does not return 500)
6. Route returns 401 for unauthenticated requests
7. Route returns 400 if `headline` is missing
8. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/image-generator.ts` — the primary reference: DALL-E 3 call pattern, Cloudinary upload pattern, non-fatal error handling with `try/catch + warnings[]`
- `lib/social-media-studio/types.ts` — `ImageGenerationRequest`, `SocialCreativeImages`, `SocialStudioResponse`
- Check how `cloudinary.config()` is called in the existing image generator — replicate exactly the same env var names
- Cloudinary Node SDK docs for `uploader.upload()` and URL transformation syntax: `cloudinary.url()` method
