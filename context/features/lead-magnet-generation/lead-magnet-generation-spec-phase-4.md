# Lead Magnet Generator — Phase 4 Spec

## Context

This is Phase 4 of an 8-phase feature that generates professional PDF guides behind email-gated landing pages.

**Phase 1 (complete):** Sanity schema + TypeScript types.
**Phase 2 (complete):** AI outline generation.
**Phase 3 (complete):** AI section content generation — `section-generator.ts` produces full prose for each section plus the introduction and conclusion.

**Phase 4 (this doc):** AI image generation — generate a professional cover image and 3–4 section images via DALL-E 3, upload all images to Cloudinary, and return URLs.

**Remaining phases:**
- Phase 5: PDF generation
- Phase 6: Sanity publishing
- Phase 7: Admin generator UI
- Phase 8: Public landing page + lead capture

---

## Phase 4: AI Image Generation

### Goal

Generate a branded cover image and a small set of section illustrations using DALL-E 3. Upload all generated images to Cloudinary. Return Cloudinary URLs as a `LeadMagnetImages` object. Image generation is **non-fatal** — if DALL-E fails for any image, the guide continues without that image rather than blocking the whole pipeline.

### What to Build

1. **`lib/lead-magnet-generator/image-generator.ts`** — image generation + Cloudinary upload service
2. **`app/api/admin/lead-magnet-generator/generate-images/route.ts`** — POST endpoint, Clerk-authenticated

---

### Image Generator (`lib/lead-magnet-generator/image-generator.ts`)

#### Cover image generation

**Prompt strategy:** Derive from the guide's title and category. Keep prompts visual-focused (no text in image), professional, and brand-appropriate.

```ts
function buildCoverImagePrompt(outline: LeadMagnetOutline): string {
  const categoryVisuals: Record<LeadMagnetCategory, string> = {
    "final-expense": "elderly couple looking at documents together, warm home setting",
    "aca": "healthy family outdoors, bright and optimistic",
    "temporary-health-insurance": "person working from laptop at home, relaxed",
    "dental-vision": "smiling person, dental clinic environment",
    "hospital-indemnity": "doctor with patient, reassuring hospital setting",
    "iul": "family celebrating milestone, financial growth imagery",
    "cancer-plans": "person with support network, hopeful tone",
    "heart-stroke": "active senior exercising, healthy lifestyle",
    "general": "professional consultation between two people",
    "tips-guides": "person reading documents, organized desk",
    "news": "clean infographic-style background, news desk",
  };

  const visual = categoryVisuals[outline.category] ?? "professional consultation scene";

  return `Professional insurance guide cover illustration. Scene: ${visual}. 
Style: Clean, minimal, corporate. Color palette: deep blue (#0077B6) and white with light blue accents. 
No text, no logos, no words in the image. 
High quality digital illustration, editorial magazine style. 
Aspect ratio suitable for a wide cover image.`;
}
```

**DALL-E 3 parameters:**
- `model: "dall-e-3"`
- `size: "1792x1024"` (wide landscape for cover)
- `quality: "standard"` (not "hd" — faster and sufficient for guides)
- `n: 1`

#### Section image generation

Select 3–4 sections from the outline at strategic positions to illustrate. Do not generate an image for every section — it's expensive and the PDF would be image-heavy.

**Selection algorithm:**
```ts
function selectSectionIndices(totalSections: number): number[] {
  if (totalSections <= 4) return Array.from({ length: totalSections }, (_, i) => i);
  // Select at ~20%, 45%, 70%, 90% of total
  return [
    Math.floor(totalSections * 0.2),
    Math.floor(totalSections * 0.45),
    Math.floor(totalSections * 0.7),
    Math.floor(totalSections * 0.9),
  ];
}
```

**Section image prompt builder:**
```ts
function buildSectionImagePrompt(section: LeadMagnetSection, outline: LeadMagnetOutline): string {
  return `Professional editorial illustration for an insurance guide section titled "${section.sectionTitle}".
Key concept: ${section.keyPoints[0]}.
Style: Clean, minimal infographic or concept illustration. Blue and white color palette.
No text, no words, no labels in the image.
Professional corporate style, suitable for a printed guide.`;
}
```

**DALL-E 3 parameters for section images:**
- `size: "1024x1024"` (square, fits inside PDF columns)
- `quality: "standard"`

#### Cloudinary upload

After generation, download the DALL-E temporary URL and upload to Cloudinary. DALL-E URLs expire within ~1 hour — always upload immediately.

```ts
async function uploadToCloudinary(
  dalleUrl: string,
  folder: string,
  publicId: string
): Promise<string>
```

Implementation:
- Use `cloudinary.uploader.upload(dalleUrl, { folder, public_id: publicId, resource_type: "image" })`
- Folder structure: `lead-magnets/{category}/` for cover, `lead-magnets/{category}/sections/` for section images
- Return `result.secure_url`

Cloudinary is already configured in the project. Use the existing Cloudinary client instance — find it by searching for `cloudinary` in `lib/` before writing a new import.

#### Main export function

```ts
export async function generateLeadMagnetImages(
  outline: LeadMagnetOutline
): Promise<LeadMagnetImages>
```

Implementation:
1. Generate cover image with DALL-E 3
2. Upload cover image to Cloudinary — return URL
3. Select section indices using `selectSectionIndices(outline.sections.length)`
4. For each selected section: generate image with DALL-E 3, upload to Cloudinary
5. **Each step is wrapped in try/catch** — log warnings but do not throw. Return empty strings for failed images.
6. Build and return `LeadMagnetImages` with all URLs (empty string `""` for any failures)

#### Non-fatal error handling

```ts
// Example pattern for non-fatal image steps:
let coverImageUrl = "";
try {
  const dalleUrl = await generateDalleImage(buildCoverImagePrompt(outline), "1792x1024");
  coverImageUrl = await uploadToCloudinary(dalleUrl, `lead-magnets/${outline.category}`, `cover-${Date.now()}`);
} catch (err) {
  warnings.push(`Cover image generation failed: ${err instanceof Error ? err.message : String(err)}`);
}
```

---

### API Route (`app/api/admin/lead-magnet-generator/generate-images/route.ts`)

`POST /api/admin/lead-magnet-generator/generate-images`

**Auth:** Clerk `auth()` — 401 if missing.

**Request body:**
```json
{
  "outline": {
    "title": "The Complete Senior's Guide to Final Expense Insurance",
    "category": "final-expense",
    "sections": [
      { "sectionTitle": "What Is Final Expense Insurance?", "keyPoints": ["..."] },
      ...
    ]
  }
}
```

**Success response (200) — all images generated:**
```json
{
  "success": true,
  "data": {
    "coverImage": "https://res.cloudinary.com/.../lead-magnets/final-expense/cover-1234567890.jpg",
    "sectionImages": [
      "https://res.cloudinary.com/.../lead-magnets/final-expense/sections/section-0-1234.jpg",
      "https://res.cloudinary.com/.../lead-magnets/final-expense/sections/section-2-1234.jpg",
      "https://res.cloudinary.com/.../lead-magnets/final-expense/sections/section-4-1234.jpg",
      ""
    ]
  },
  "warnings": ["Section image at index 3 failed: DALL-E content policy rejection"]
}
```

**Partial success (200) — cover failed:**
```json
{
  "success": true,
  "data": {
    "coverImage": "",
    "sectionImages": ["https://...", "https://...", "https://...", ""]
  },
  "warnings": ["Cover image generation failed: OpenAI rate limit exceeded"]
}
```

Note: The route always returns `success: true` as long as it runs — failures are surfaced via the `warnings` array. Only return `success: false` for auth failures or malformed request body.

Set `export const maxDuration = 120` — generating 4–5 images via DALL-E takes 40–90 seconds total.

---

### File Structure After Phase 4

```
lib/
  lead-magnet-generator/
    types.ts               ← Phase 1 (unchanged)
    prompts.ts             ← Phase 2–3 (unchanged)
    outline-generator.ts   ← Phase 2 (unchanged)
    section-generator.ts   ← Phase 3 (unchanged)
    image-generator.ts     ← NEW
app/
  api/
    admin/
      lead-magnet-generator/
        generate-outline/
          route.ts         ← Phase 2 (unchanged)
        generate-section/
          route.ts         ← Phase 3 (unchanged)
        generate-intro-conclusion/
          route.ts         ← Phase 3 (unchanged)
        generate-images/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 4 is complete when:

1. `POST /api/admin/lead-magnet-generator/generate-images` with a valid `LeadMagnetOutline` returns `LeadMagnetImages` with a non-empty `coverImage` URL
2. Returned URLs are valid Cloudinary HTTPS URLs (not temporary DALL-E URLs)
3. `sectionImages` array length matches `selectSectionIndices(outline.sections.length)` — always 3–4 items
4. If DALL-E fails for one section image, the route still returns 200 with the failed image as `""` and the error in `warnings`
5. If ALL image generation fails (e.g., OpenAI is down), the route returns `{ success: true, data: { coverImage: "", sectionImages: ["", "", ""] }, warnings: [...] }` — never a 500 for image failures
6. Route returns 401 if unauthenticated
7. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/types.ts` — `LeadMagnetOutline`, `LeadMagnetImages`; input/output types
- `lib/blog-generator/` — check if an existing image generator file is present; if so, extract or reuse the DALL-E call pattern rather than duplicating
- Search for `cloudinary` in `lib/` to find the existing Cloudinary client configuration before writing new imports
- `app/api/admin/blog-generator/generate-images/route.ts` — existing image generation route; replicate the auth + Cloudinary upload pattern
- `app/api/admin/lead-magnet-generator/generate-outline/route.ts` — auth + maxDuration pattern

**Environment variables (already in project):**
- `OPENAI_API_KEY` — used for DALL-E 3
- `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_SECRET` — Cloudinary upload credentials

**External docs:**
- DALL-E 3 API: https://platform.openai.com/docs/api-reference/images
- Cloudinary Node.js SDK upload: https://cloudinary.com/documentation/node_image_and_video_upload
