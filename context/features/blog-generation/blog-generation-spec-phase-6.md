# Blog Generation from YouTube — Phase 6 Spec

## Context

This is Phase 6 of the blog generation feature.

**Phases 1–5 (complete):** Full pipeline — extract → generate → translate → publish — with admin review UI, field regeneration, CTA auto-suggestion, publish status control, and batch mode.

**Phase 6 (this doc):** AI image generation — generate a featured image and three body images for each blog post using DALL-E 3, then publish them embedded in the post.

---

## Recommended API: OpenAI DALL-E 3

**Why DALL-E 3:**
- Already integrated — `OPENAI_API_KEY` is in the project; no new credentials needed
- Highest instruction-following of any image model (correctly avoids text-in-image, follows style prompts)
- GPT-4o can generate the image prompts, keeping everything in one API
- Supports 1792×1024 (wide landscape) and 1024×1024 (square) — exactly what blog content needs
- `revised_prompt` field provides transparency on what was actually generated

**Pricing (standard quality):**
- 1792×1024 (featured): $0.080/image
- 1024×1024 (body ×3): $0.040/image × 3 = $0.120
- Total per post: ~$0.20

---

## Phase 6: AI Image Generation

### Goal

After blog content is generated, use GPT-4o to craft 4 insurance-grade image prompts (1 featured + 3 body), generate them with DALL-E 3, upload all 4 to Sanity as assets, and embed them in the published post:

- **Featured image** replaces the YouTube thumbnail as the post hero (16:9)
- **Body images 1–3** are inserted as Portable Text image blocks at the 25%, 50%, and 75% positions in the body

Image generation is a **skippable step** — if the user skips, the pipeline falls back to the YouTube thumbnail with no body images (Phase 1–5 behavior).

---

## 1. Types (`lib/blog-generator/types.ts`)

Add after the Phase 5 types block:

```ts
// --- Phase 6 types ---

export interface GeneratedImage {
  assetId: string;        // Sanity asset _id (persisted)
  url: string;            // Original DALL-E URL (preview only; expires ~1 hour)
  prompt: string;         // Final prompt sent to DALL-E
  revisedPrompt: string;  // DALL-E's auto-revised prompt
  alt: string;            // Accessibility alt text
}

export interface GeneratedImages {
  featured: GeneratedImage;
  body: [GeneratedImage, GeneratedImage, GeneratedImage];
}

export interface GenerateImagesRequest {
  content: GeneratedBlogContent;
}

export interface GenerateImagesResponse {
  success: true;
  data: GeneratedImages;
}

export interface GenerateImagesErrorResponse {
  success: false;
  error: string;
}
```

Also update `PublishRequest` to accept images:

```ts
export interface PublishRequest {
  content: GeneratedBlogContent;
  extraction: YouTubeExtractionResult;
  cta?: CTASettings;
  status?: "draft" | "published";
  images?: GeneratedImages;   // ← add this
}
```

---

## 2. New Service: `lib/blog-generator/image-generator.ts`

Full new file.

### Step 1 — GPT generates 4 prompts

```ts
async function generateImagePrompts(
  content: GeneratedBlogContent
): Promise<ImagePromptSet>
```

Call GPT-4o with `response_format: { type: "json_object" }`. System prompt:

```
You are a creative director for a professional insurance agency blog targeting Hispanic/Latino families in the United States. Your job is to write DALL-E 3 image prompts that produce warm, trustworthy, photorealistic photographs.

Rules for ALL prompts:
- Photorealistic photography, warm professional lighting, shallow depth of field
- Show diverse people, with Hispanic/Latino representation welcome
- Settings: homes, families, offices, outdoors — real-life insurance moments
- NO text, words, signs, logos, or watermarks anywhere in the image
- NO graphic medical content, no death imagery
- Mood: warm, trustworthy, hopeful, professional
- Style: editorial photography, 4K quality
```

User prompt:

```
Generate image prompts for this insurance blog post.

Title: {content.title}
Category: {content.category}
Excerpt: {content.excerpt}

Return exactly this JSON — no explanation:
{
  "featured": {
    "prompt": "highly detailed DALL-E 3 prompt for the hero image (most impactful, wide landscape mood)",
    "alt": "descriptive alt text for accessibility (max 125 chars)"
  },
  "body1": {
    "prompt": "prompt for image supporting the opening section of the article",
    "alt": "alt text"
  },
  "body2": {
    "prompt": "prompt for image supporting the middle section of the article",
    "alt": "alt text"
  },
  "body3": {
    "prompt": "prompt for image near the conclusion or call-to-action section",
    "alt": "alt text"
  }
}
```

Internal interface for the GPT response:

```ts
interface ImagePromptSet {
  featured: { prompt: string; alt: string };
  body1:    { prompt: string; alt: string };
  body2:    { prompt: string; alt: string };
  body3:    { prompt: string; alt: string };
}
```

### Step 2 — DALL-E 3 generates images

```ts
async function generateDalleImage(
  prompt: string,
  size: "1792x1024" | "1024x1024"
): Promise<{ url: string; revisedPrompt: string }>
```

```ts
const response = await client.images.generate({
  model: "dall-e-3",
  prompt,
  n: 1,
  size,
  quality: "standard",
  response_format: "url",
});
return {
  url: response.data[0].url!,
  revisedPrompt: response.data[0].revised_prompt ?? prompt,
};
```

DALL-E 3 only supports `n: 1` — generate all 4 in parallel with `Promise.all`.

### Step 3 — Upload to Sanity

```ts
async function uploadImageToSanity(
  imageUrl: string,
  filename: string
): Promise<string>  // returns asset _id
```

```ts
const res = await fetch(imageUrl);
const buffer = Buffer.from(await res.arrayBuffer());
const asset = await client.assets.upload("image", buffer, {
  filename,
  contentType: "image/png",
});
return asset._id;
```

Reuse `getWriteClient()` from `sanity-publisher.ts` — either import it or duplicate the small factory locally.

### Step 4 — Main export

```ts
export async function generateBlogImages(
  content: GeneratedBlogContent
): Promise<GeneratedImages>
```

Full flow:

```ts
export async function generateBlogImages(
  content: GeneratedBlogContent
): Promise<GeneratedImages> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // 1. Generate prompts with GPT
  const promptsRaw = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: IMAGE_SYSTEM_PROMPT },
      { role: "user",   content: buildImageUserPrompt(content) },
    ],
  });
  const prompts: ImagePromptSet = JSON.parse(
    promptsRaw.choices[0].message.content ?? "{}"
  );

  const baseSlug = createSlug(content.title).slice(0, 40);

  // 2. Generate all 4 images in parallel
  const [featuredDalle, body1Dalle, body2Dalle, body3Dalle] = await Promise.all([
    generateDalleImage(prompts.featured.prompt, "1792x1024"),
    generateDalleImage(prompts.body1.prompt,    "1024x1024"),
    generateDalleImage(prompts.body2.prompt,    "1024x1024"),
    generateDalleImage(prompts.body3.prompt,    "1024x1024"),
  ]);

  // 3. Upload all 4 to Sanity in parallel
  const [featuredId, body1Id, body2Id, body3Id] = await Promise.all([
    uploadImageToSanity(featuredDalle.url, `${baseSlug}-featured.png`),
    uploadImageToSanity(body1Dalle.url,    `${baseSlug}-body-1.png`),
    uploadImageToSanity(body2Dalle.url,    `${baseSlug}-body-2.png`),
    uploadImageToSanity(body3Dalle.url,    `${baseSlug}-body-3.png`),
  ]);

  return {
    featured: {
      assetId:       featuredId,
      url:           featuredDalle.url,
      prompt:        prompts.featured.prompt,
      revisedPrompt: featuredDalle.revisedPrompt,
      alt:           prompts.featured.alt,
    },
    body: [
      { assetId: body1Id, url: body1Dalle.url, prompt: prompts.body1.prompt, revisedPrompt: body1Dalle.revisedPrompt, alt: prompts.body1.alt },
      { assetId: body2Id, url: body2Dalle.url, prompt: prompts.body2.prompt, revisedPrompt: body2Dalle.revisedPrompt, alt: prompts.body2.alt },
      { assetId: body3Id, url: body3Dalle.url, prompt: prompts.body3.prompt, revisedPrompt: body3Dalle.revisedPrompt, alt: prompts.body3.alt },
    ],
  };
}
```

---

## 3. New API Route: `app/api/admin/blog-generator/generate-images/route.ts`

`POST /api/admin/blog-generator/generate-images`

**Request body:**
```json
{
  "content": GeneratedBlogContent
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": GeneratedImages
}
```

Auth: Clerk `auth()`, 401 if no `userId`.
`maxDuration = 120` — image generation + upload can take 30–60 seconds.

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateBlogImages } from "@/lib/blog-generator/image-generator";
import type {
  GenerateImagesResponse,
  GenerateImagesErrorResponse,
  GeneratedBlogContent,
} from "@/lib/blog-generator/types";

export const maxDuration = 120;

export async function POST(
  request: NextRequest
): Promise<NextResponse<GenerateImagesResponse | GenerateImagesErrorResponse>> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let content: GeneratedBlogContent;
  try {
    const body = await request.json();
    content = body?.content;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!content?.title || !content?.category) {
    return NextResponse.json(
      { success: false, error: "content with title and category is required" },
      { status: 400 }
    );
  }

  try {
    const images = await generateBlogImages(content);
    return NextResponse.json({ success: true, data: images });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Image generation failed";
    console.error("[blog-generator/generate-images]", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
```

---

## 4. Update `lib/blog-generator/sanity-publisher.ts`

### Add `insertBodyImages` helper

Insert body images at 25%, 50%, and 75% positions in the block array.
Insert from the highest index to lowest so earlier insertions don't shift later indices.

```ts
function insertBodyImages(
  blocks: PortableTextBlock[],
  images: [GeneratedImage, GeneratedImage, GeneratedImage]
): PortableTextBlock[] {
  if (blocks.length < 6) return blocks; // too short to bother

  const total = blocks.length;
  const insertions = [
    { idx: Math.floor(total * 0.75), image: images[2] },
    { idx: Math.floor(total * 0.50), image: images[1] },
    { idx: Math.floor(total * 0.25), image: images[0] },
  ]; // high → low preserves indices

  const result = [...blocks];
  for (const { idx, image } of insertions) {
    result.splice(idx, 0, {
      _type: "image",
      _key: generateKey(),
      asset: { _type: "reference", _ref: image.assetId },
      alt: image.alt,
    } as unknown as PortableTextBlock);
  }
  return result;
}
```

### Update `publishBilingualPost` signature

```ts
export async function publishBilingualPost(
  enContent: GeneratedBlogContent,
  esContent: TranslatedBlogContent,
  thumbnailAssetId: string,
  cta?: CTASettings,
  status: "draft" | "published" = "draft",
  images?: GeneratedImages          // ← add this
): Promise<SanityPublishResult>
```

Inside the function, determine the image field and body:

```ts
// Featured image: use AI-generated if available, else YouTube thumbnail
const featuredAssetId = images?.featured.assetId ?? thumbnailAssetId;
const featuredAlt     = images?.featured.alt     ?? enContent.title;

const imageField = {
  _type: "image",
  asset: { _type: "reference", _ref: featuredAssetId },
  alt: featuredAlt,
};

// Body blocks: insert body images if available
const rawEnBlocks = textToBlocks(enContent.bodyMarkdown);
const rawEsBlocks = textToBlocks(esContent.bodyMarkdown);
const enBodyBlocks = images ? insertBodyImages(rawEnBlocks, images.body) : rawEnBlocks;
const esBodyBlocks = images ? insertBodyImages(rawEsBlocks, images.body) : rawEsBlocks;
```

Replace `body: textToBlocks(enContent.bodyMarkdown)` with `body: enBodyBlocks`, and similarly for the Spanish post.

---

## 5. Update `app/api/admin/blog-generator/publish/route.ts`

Read `images` from request body and pass it to `publishBilingualPost`:

```ts
// In the body parsing block:
const images: GeneratedImages | undefined = body?.images;

// In the publishBilingualPost call:
const result = await publishBilingualPost(
  content,
  esContent,
  thumbnailAssetId,
  cta,
  status,
  images,     // ← add
);
```

Import `GeneratedImages` from types.

---

## 6. Update `app/[locale]/admin/blog-generator/page.tsx`

### New stage

```ts
type Stage =
  | "idle"
  | "extracting"
  | "generating"
  | "generating-images"   // ← new
  | "review"
  | "publishing"
  | "success";
```

Add to `STAGE_LABELS`:
```ts
"generating-images": "Generating images with AI (this takes ~30 seconds)...",
```

### New state

```ts
const [images, setImages] = useState<GeneratedImages | null>(null);
```

Reset `images` to `null` in `resetAll()`.

### Update `runPipeline`

After the generate step succeeds, automatically run image generation:

```ts
setStage("generating-images");
try {
  const imagesData = await postJson("/api/admin/blog-generator/generate-images", {
    content,
  });
  setImages(imagesData.data);
} catch {
  // Non-fatal: image generation failure does not block the review
  setImages(null);
}

setStage("review");
```

### Review stage — Images card

Add an **Images** card between the Source Video card and the Content card:

```
── Images ──────────────────────────────────────────
(if images generated)

Featured                            [3 body images in a row]
┌─────────────────────┐             ┌──────┐ ┌──────┐ ┌──────┐
│                     │             │  1   │ │  2   │ │  3   │
│   featured image    │             │      │ │      │ │      │
│                     │             └──────┘ └──────┘ └──────┘
└─────────────────────┘
                                    [✕ Remove images]

(if images were skipped / failed)
Images were not generated.          [↺ Generate Images]
```

Implementation:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
      Images
    </CardTitle>
  </CardHeader>
  <CardContent>
    {images ? (
      <div className="flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <img
            src={images.featured.url}
            alt={images.featured.alt}
            className="h-32 rounded-lg object-cover flex-shrink-0"
            style={{ aspectRatio: "16/9" }}
          />
          <div className="flex gap-2 flex-wrap">
            {images.body.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={img.alt}
                className="h-32 w-32 rounded-lg object-cover flex-shrink-0"
              />
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Featured image + 3 body images will be inserted at 25%, 50%, and 75% of the post body.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => setImages(null)}
        >
          Remove Images
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">No images generated.</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateImages}
          disabled={generatingImages}
        >
          {generatingImages
            ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating...</>
            : <><ImageIcon className="h-3 w-3 mr-1" />Generate Images</>}
        </Button>
      </div>
    )}
  </CardContent>
</Card>
```

Add a separate `generatingImages` boolean state for the inline re-generate button:

```ts
const [generatingImages, setGeneratingImages] = useState(false);

async function handleGenerateImages() {
  if (!form.title) return;
  setGeneratingImages(true);
  try {
    const data = await postJson("/api/admin/blog-generator/generate-images", {
      content: buildContentFromForm(),
    });
    setImages(data.data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Image generation failed");
  } finally {
    setGeneratingImages(false);
  }
}
```

Import `ImageIcon` from `lucide-react`.

### Update `handlePublish`

Pass `images` in the request body:

```ts
const data = await postJson("/api/admin/blog-generator/publish", {
  content: buildContentFromForm(),
  extraction,
  cta: form.cta,
  status: form.publishStatus,
  images: images ?? undefined,
});
```

### Batch mode

In `runBatch`, add image generation between generate and publish for each URL:

```ts
const generateData = await postJson("/api/admin/blog-generator/generate", { extraction: extractData.data });
const content: GeneratedBlogContent = generateData.data;

// Generate images (non-fatal)
let batchImages: GeneratedImages | undefined;
try {
  const imgData = await postJson("/api/admin/blog-generator/generate-images", { content });
  batchImages = imgData.data;
} catch {
  batchImages = undefined;
}

const cta = CATEGORY_CTA[content.category];
const publishData = await postJson("/api/admin/blog-generator/publish", {
  content,
  extraction: extractData.data,
  cta: { enableCTA: true, ...cta },
  status: "draft",
  images: batchImages,
});
```

---

## File Structure After Phase 6

```
lib/
  blog-generator/
    types.ts                ← add GeneratedImage, GeneratedImages, GenerateImagesRequest/Response; update PublishRequest
    image-generator.ts      ← NEW: generateBlogImages()
    sanity-publisher.ts     ← add insertBodyImages(); update publishBilingualPost signature
app/
  api/
    admin/
      blog-generator/
        generate-images/
          route.ts          ← NEW
        publish/route.ts    ← read images from body; pass to publishBilingualPost
  [locale]/
    admin/
      blog-generator/
        page.tsx            ← new stage, images state, Images card, handleGenerateImages, batch update
```

---

## Success Criteria

Phase 6 is complete when:

- Generating a single post automatically triggers image generation after the content step
- Review stage shows a 2×2 image preview (1 featured + 3 body)
- "Remove Images" clears the images so the post publishes without them (falls back to YouTube thumbnail)
- "Generate Images" button in review stage re-triggers generation if images were skipped or removed
- Publishing with images results in:
  - The `image` field of both EN and ES Sanity posts set to the AI-generated featured asset (not the YouTube thumbnail)
  - Three image blocks embedded in the body at ~25%, ~50%, ~75% positions
- Publishing without images falls back to current behavior (YouTube thumbnail, no body images)
- Batch mode generates images for each post (non-fatal: continues if image generation fails for one)
- `pnpm tsc --noEmit` passes

---

## Notes

- DALL-E 3 URL expires after ~1 hour. The preview `<img>` in the admin UI loads directly from the DALL-E URL and may go stale if the admin leaves the tab open. The Sanity asset (`assetId`) is permanent and is what gets published.
- Image generation adds ~30–60 seconds to the pipeline. The loading screen message reflects this.
- No new env vars required — uses existing `OPENAI_API_KEY` and `SANITY_API_WRITE_TOKEN`.
- Cloudinary fetch-based hero transform in `page.tsx` (`cloudinaryFetchedFeaturedHeroUrl`) applies automatically to the AI-generated featured image the same way it does to the YouTube thumbnail.
