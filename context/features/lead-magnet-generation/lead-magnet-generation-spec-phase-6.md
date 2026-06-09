# Lead Magnet Generator — Phase 6 Spec

## Context

This is Phase 6 of an 8-phase feature that generates professional PDF guides behind email-gated landing pages.

**Phase 1 (complete):** Sanity schema + TypeScript types.
**Phase 2 (complete):** AI outline generation.
**Phase 3 (complete):** AI section content generation.
**Phase 4 (complete):** AI image generation — `LeadMagnetImages` with Cloudinary URLs.
**Phase 5 (complete):** PDF generation — branded PDF uploaded to Cloudinary, returns `pdfUrl`.

**Phase 6 (this doc):** Sanity publishing — save the complete lead magnet as a `leadMagnet` document in Sanity, linking all generated content, images, PDF URL, and metadata.

**Remaining phases:**
- Phase 7: Admin generator UI
- Phase 8: Public landing page + lead capture

---

## Phase 6: Sanity Publishing

### Goal

Save the fully generated lead magnet to Sanity CMS as a `leadMagnet` document. The document becomes the source of truth for the public landing page (Phase 8). This phase mirrors the publishing step in the blog generation pipeline (`lib/blog-generator/sanity-publisher.ts`) but adapted for the lead magnet schema.

### What to Build

1. **`lib/lead-magnet-generator/sanity-publisher.ts`** — Sanity document construction and write service
2. **`app/api/admin/lead-magnet-generator/publish/route.ts`** — POST endpoint, Clerk-authenticated

---

### Sanity Publisher (`lib/lead-magnet-generator/sanity-publisher.ts`)

#### Overview

Construct a Sanity `leadMagnet` document from the accumulated generation data and write it via the Sanity client. The client must use the write token (not the read-only public client). Follow the same pattern as `lib/blog-generator/sanity-publisher.ts`.

#### Sanity client

The project uses two Sanity clients:
- Read-only public client: used in frontend pages
- Write client (authenticated): requires `SANITY_API_WRITE_TOKEN` — used by admin operations

Before implementing, read `lib/blog-generator/sanity-publisher.ts` to find where the write client is instantiated. Replicate that exact pattern — do not create a third client configuration.

#### Cover image upload

If `images.coverImage` is a Cloudinary URL (not a Sanity asset reference), fetch the image bytes and upload to Sanity as an asset. Sanity's `image` field type requires a Sanity asset reference — it cannot use an external URL directly.

```ts
async function uploadCoverImageToSanity(
  cloudinaryUrl: string,
  writeClient: SanityClient
): Promise<string>  // returns Sanity asset _id
```

Implementation:
- `fetch(cloudinaryUrl)` → `response.arrayBuffer()` → `Buffer.from(...)`
- `writeClient.assets.upload("image", buffer, { filename: "cover.jpg", contentType: "image/jpeg" })`
- Return `asset._id`

This is the identical pattern used in `lib/blog-generator/sanity-publisher.ts` for the YouTube thumbnail — reuse it.

#### Document construction

```ts
function buildLeadMagnetDocument(params: {
  outline: LeadMagnetOutline;
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  pdfUrl: string;
  status: LeadMagnetStatus;
  originalPromptInput: LeadMagnetPromptInput;
  coverImageAssetId: string;
  slug: string;
}): SanityDocumentStub
```

Construct the Sanity document object:

```ts
{
  _type: "leadMagnet",
  title: outline.title,
  slug: { _type: "slug", current: slug },
  locale: "en",
  category: outline.category,
  status,
  subtitle: outline.subtitle,
  description: generatedContent.introductionBlocks,  // intro becomes the landing page description
  coverImage: {
    _type: "image",
    asset: { _type: "reference", _ref: coverImageAssetId }
  },
  sections: generatedContent.sections.map((section, index) => ({
    _key: generateKey(),
    sectionTitle: section.sectionTitle,
    content: section.contentBlocks ?? [],
    // sectionImage: upload if present (see below)
  })),
  keyBenefits: outline.keyBenefits,
  targetAudience: outline.targetAudience,
  leadFormSettings: {
    ctaHeadline: "Get Your Free Guide",
    ctaSubtext: "Enter your info below to download instantly — no spam, ever.",
    ctaButtonText: "Download Free Guide",
    successMessage: "Your guide is downloading now!",
  },
  seo: {
    metaTitle: outline.title.slice(0, 60),
    metaDescription: outline.subtitle.slice(0, 160),
    focusKeyword: outline.sections[0]?.keyPoints[0] ?? outline.title,
    keywords: outline.keyBenefits.map((b) => b.split(" ").slice(0, 3).join(" ")),
  },
  generationPrompt: JSON.stringify(originalPromptInput),
  generatedPdfUrl: pdfUrl,
  pdfGeneratedAt: new Date().toISOString(),
  downloadCount: 0,
  publishedAt: status === "published" ? new Date().toISOString() : null,
  updatedAt: new Date().toISOString(),
}
```

#### Section images

For sections that have a `sectionImage` URL (from Phase 4), upload each to Sanity assets and include the asset reference in the section object. This is optional — if upload fails, publish without section images rather than blocking.

```ts
// Per section, inside the sections.map():
if (section.sectionImage) {
  try {
    const assetId = await uploadSectionImageToSanity(section.sectionImage, writeClient);
    return { ...sectionDoc, sectionImage: { _type: "image", asset: { _type: "reference", _ref: assetId } } };
  } catch {
    // non-fatal — continue without image
  }
}
```

#### Slug generation

Use `createSlug()` from `lib/blog-generator/portable-text.ts`. Check for slug uniqueness: if a document with the same slug already exists, append `-2`, `-3`, etc.

```ts
async function generateUniqueSlug(title: string, writeClient: SanityClient): Promise<string>
```

Query Sanity for existing slugs with the base slug, then increment until unique.

#### Main export

```ts
export async function publishLeadMagnet(
  params: LeadMagnetPublishInput
): Promise<PublishedLeadMagnet>
```

Returns:
```ts
{
  sanityDocumentId: result._id,
  slug: slug,
  pdfUrl: params.pdfUrl,
  publicUrl: `/lead-magnets/${slug}`,
}
```

---

### API Route (`app/api/admin/lead-magnet-generator/publish/route.ts`)

`POST /api/admin/lead-magnet-generator/publish`

**Auth:** Clerk `auth()` — 401 if missing.

**Request body:**
```json
{
  "outline": { ... },
  "generatedContent": { ... },
  "images": {
    "coverImage": "https://res.cloudinary.com/...",
    "sectionImages": ["https://...", "https://...", "https://...", ""]
  },
  "pdfUrl": "https://res.cloudinary.com/.../guide.pdf",
  "status": "draft",
  "originalPromptInput": {
    "topic": "...",
    "category": "final-expense",
    "targetAudience": "...",
    "keyTopics": ["..."],
    "tone": "educational"
  }
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "sanityDocumentId": "abc123def456",
    "slug": "complete-seniors-guide-to-final-expense-insurance",
    "pdfUrl": "https://res.cloudinary.com/.../guide.pdf",
    "publicUrl": "/lead-magnets/complete-seniors-guide-to-final-expense-insurance"
  }
}
```

**Error response (500):**
```json
{ "success": false, "error": "Sanity publish failed: Missing required field 'title'" }
```

Set `export const maxDuration = 60` — image uploads to Sanity can take 15–30 seconds.

---

### File Structure After Phase 6

```
lib/
  lead-magnet-generator/
    types.ts               ← Phase 1 (unchanged)
    prompts.ts             ← Phase 2–3 (unchanged)
    outline-generator.ts   ← Phase 2 (unchanged)
    section-generator.ts   ← Phase 3 (unchanged)
    image-generator.ts     ← Phase 4 (unchanged)
    pdf-generator.ts       ← Phase 5 (unchanged)
    pdf/                   ← Phase 5 (unchanged)
    sanity-publisher.ts    ← NEW
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
          route.ts         ← Phase 4 (unchanged)
        generate-pdf/
          route.ts         ← Phase 5 (unchanged)
        publish/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 6 is complete when:

1. `POST /api/admin/lead-magnet-generator/publish` with complete input returns a `PublishedLeadMagnet` with a valid `sanityDocumentId`
2. A `leadMagnet` document exists in Sanity Studio with all fields populated: title, slug, sections, coverImage, generatedPdfUrl, status
3. The `slug.current` value matches the `slug` field in the API response
4. `coverImage` in Sanity is a proper Sanity asset reference (not an external URL)
5. If `status: "published"`, `publishedAt` is set to the current timestamp in the Sanity document
6. If `status: "draft"`, `publishedAt` is null
7. `generationPrompt` in Sanity contains the JSON string of `LeadMagnetPromptInput`
8. Route returns 401 if unauthenticated
9. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/types.ts` — `LeadMagnetPublishInput`, `PublishedLeadMagnet`; all input/output types
- `lib/blog-generator/sanity-publisher.ts` — the complete publishing pattern to replicate: write client setup, `assets.upload()`, `client.create()`, image asset references — read this file in full before writing any code
- `lib/blog-generator/portable-text.ts` — `createSlug()`, `generateKey()` functions to import
- `sanity/schemaTypes/leadMagnetType.ts` — exact field names and types to match in the document object

**Environment variables (already in project):**
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` — Sanity project config
- `SANITY_API_WRITE_TOKEN` — required for write operations; already used by `sanity-publisher.ts`
