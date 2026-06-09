# Lead Magnet Generator — Phase 1 Spec

## Full Feature Overview (All Phases)

The complete feature allows an authenticated admin user to type a prompt describing a topic and have the system automatically generate a professional, long-form PDF guide (4,000–8,000 words) published to Sanity CMS. A public landing page then gates the PDF behind an email capture form that feeds leads directly into Agent CRM.

**Planned phases:**
- **Phase 1 (this doc):** Sanity schema + TypeScript types — define the data model that all other phases depend on
- **Phase 2:** AI outline generation — accept a user prompt and produce a structured outline with section titles and key points
- **Phase 3:** AI section content generation — generate full content for each section sequentially with context continuity
- **Phase 4:** AI image generation — DALL-E 3 cover image + section illustrations
- **Phase 5:** PDF generation — compile content into a branded PDF via `@react-pdf/renderer` and upload to Cloudinary
- **Phase 6:** Sanity publishing — save the complete lead magnet as a `leadMagnet` document in Sanity
- **Phase 7:** Admin generator UI — multi-step wizard page at `/admin/lead-magnet-generator/`
- **Phase 8:** Public landing page + lead capture — email gate, Agent CRM integration, PDF delivery

---

## Phase 1: Sanity Schema + TypeScript Types

### Goal

Define the complete data model for the lead magnet feature. This is the foundation all other phases depend on. No AI calls, no UI, no PDF generation yet — only the Sanity schema, TypeScript contracts, and routing configuration.

### What to Build

1. **`sanity/schemaTypes/leadMagnetType.ts`** — full Sanity document schema
2. Register the new type in **`sanity/schemaTypes/index.ts`** and **`sanity/structure.ts`**
3. **`lib/lead-magnet-generator/types.ts`** — all TypeScript interfaces and types used across all 8 phases
4. Add the public `/lead-magnets/[slug]` route to **`i18n/routing.ts`**

---

### Sanity Schema (`sanity/schemaTypes/leadMagnetType.ts`)

Model the schema after `postType.ts` — same Sanity field patterns (validation, description strings, groups). Use `defineType`, `defineField`, and `defineArrayMember` from `sanity`.

#### Field groups

Organize fields into these groups for the Sanity Studio sidebar:
- `identity` — title, slug, locale, category, status
- `content` — subtitle, description, coverImage, sections, keyBenefits, targetAudience
- `leadForm` — leadFormSettings
- `seo` — seo object
- `generation` — generationPrompt, generatedPdfUrl, pdfGeneratedAt, downloadCount
- `dates` — publishedAt, updatedAt

#### Full field list

```ts
// IDENTITY
{
  name: 'title',
  type: 'string',
  validation: max 70 chars, required
}

{
  name: 'slug',
  type: 'slug',
  options: { source: 'title', maxLength: 96 },
  validation: required
}

{
  name: 'locale',
  type: 'string',
  options: { list: [{ title: 'English', value: 'en' }, { title: 'Spanish', value: 'es' }] },
  initialValue: 'en',
  validation: required
}

{
  name: 'category',
  type: 'string',
  options: { list: [
    { title: 'ACA / Health Insurance', value: 'aca' },
    { title: 'Temporary Health Insurance', value: 'temporary-health-insurance' },
    { title: 'Dental & Vision', value: 'dental-vision' },
    { title: 'Hospital Indemnity', value: 'hospital-indemnity' },
    { title: 'IUL (Life Insurance)', value: 'iul' },
    { title: 'Final Expense', value: 'final-expense' },
    { title: 'Cancer Plans', value: 'cancer-plans' },
    { title: 'Heart & Stroke', value: 'heart-stroke' },
    { title: 'General Insurance', value: 'general' },
    { title: 'Tips & Guides', value: 'tips-guides' },
    { title: 'News', value: 'news' },
  ]},
  validation: required
}

{
  name: 'status',
  type: 'string',
  options: { list: ['draft', 'published', 'archived'] },
  initialValue: 'draft',
  validation: required
}

// CONTENT
{
  name: 'subtitle',
  type: 'string',
  description: 'One-line hook shown on the landing page hero',
  validation: max 160 chars, required
}

{
  name: 'description',
  type: 'array',
  of: [{ type: 'block' }],
  description: 'Landing page body copy — explain who the guide is for and why it matters'
}

{
  name: 'coverImage',
  type: 'image',
  options: { hotspot: true },
  fields: [{ name: 'alt', type: 'string', validation: required }]
}

{
  name: 'sections',
  type: 'array',
  of: [{
    type: 'object',
    fields: [
      { name: 'sectionTitle', type: 'string', validation: required },
      { name: 'content', type: 'array', of: [{ type: 'block' }] },
      { name: 'sectionImage', type: 'image', options: { hotspot: true },
        fields: [{ name: 'alt', type: 'string' }] }
    ]
  }]
}

{
  name: 'keyBenefits',
  type: 'array',
  of: [{ type: 'string' }],
  description: '"What you\'ll learn" bullets on the landing page'
}

{
  name: 'targetAudience',
  type: 'string',
  description: 'Who this guide is written for — used in landing page copy and AI generation'
}

// LEAD FORM
{
  name: 'leadFormSettings',
  type: 'object',
  fields: [
    { name: 'ctaHeadline', type: 'string', initialValue: 'Get Your Free Guide' },
    { name: 'ctaSubtext', type: 'string', initialValue: 'Enter your info below to download instantly — no spam, ever.' },
    { name: 'ctaButtonText', type: 'string', initialValue: 'Download Free Guide' },
    { name: 'successMessage', type: 'string', initialValue: 'Your guide is downloading now!' },
    { name: 'agentCrmWorkflowId', type: 'string', description: 'Optional: override default Agent CRM workflow for this guide' }
  ]
}

// SEO
{
  name: 'seo',
  type: 'object',
  fields: [
    { name: 'metaTitle', type: 'string', validation: max 60 chars },
    { name: 'metaDescription', type: 'string', validation: min 120, max 160 chars },
    { name: 'focusKeyword', type: 'string' },
    { name: 'keywords', type: 'array', of: [{ type: 'string' }] }
  ]
}

// GENERATION METADATA (read-only in Studio, written by API)
{
  name: 'generationPrompt',
  type: 'text',
  description: 'Original JSON prompt input — stored for audit and regeneration',
  readOnly: true
}

{
  name: 'generatedPdfUrl',
  type: 'url',
  description: 'Cloudinary URL of the generated PDF',
  readOnly: true
}

{
  name: 'pdfGeneratedAt',
  type: 'datetime',
  readOnly: true
}

{
  name: 'downloadCount',
  type: 'number',
  initialValue: 0,
  readOnly: true
}

// DATES
{
  name: 'publishedAt',
  type: 'datetime'
}

{
  name: 'updatedAt',
  type: 'datetime'
}
```

#### Preview configuration

```ts
preview: {
  select: {
    title: 'title',
    subtitle: 'category',
    media: 'coverImage',
  },
  prepare({ title, subtitle, media }) {
    return {
      title,
      subtitle: subtitle ? `[${subtitle}]` : 'No category',
      media,
    }
  }
}
```

---

### Register the Schema

**`sanity/schemaTypes/index.ts`** — add `leadMagnetType`:
```ts
import { leadMagnetType } from './leadMagnetType'

export const schemaTypes = [postType, leadMagnetType, /* ... existing types */]
```

**`sanity/structure.ts`** — add a Lead Magnets list item:
```ts
S.listItem()
  .title('Lead Magnets')
  .icon(/* BookOpenIcon or similar from @sanity/icons */)
  .child(
    S.documentTypeList('leadMagnet')
      .title('Lead Magnets')
      .defaultOrdering([{ field: 'publishedAt', direction: 'desc' }])
  )
```

---

### TypeScript Contract (`lib/lead-magnet-generator/types.ts`)

Define all types here. All subsequent phases import from this file only.

```ts
import type { PortableTextBlock } from "@portabletext/types";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type LeadMagnetCategory =
  | "aca"
  | "temporary-health-insurance"
  | "dental-vision"
  | "hospital-indemnity"
  | "iul"
  | "final-expense"
  | "cancer-plans"
  | "heart-stroke"
  | "general"
  | "tips-guides"
  | "news";

export type LeadMagnetStatus = "draft" | "published" | "archived";
export type LeadMagnetLocale = "en" | "es";
export type LeadMagnetTone = "educational" | "conversational" | "urgent";

// ─── Prompt Input ─────────────────────────────────────────────────────────────

export interface LeadMagnetPromptInput {
  topic: string;            // e.g. "Final Expense Insurance for seniors"
  category: LeadMagnetCategory;
  targetAudience: string;   // e.g. "Adults 55–80 who have never bought life insurance"
  keyTopics: string[];      // must-cover topics as bullet list
  tone: LeadMagnetTone;
  additionalContext?: string;
}

// ─── Outline ──────────────────────────────────────────────────────────────────

export interface LeadMagnetSection {
  sectionTitle: string;
  keyPoints: string[];          // used during outline review
  content?: string;             // markdown; populated during section generation (Phase 3)
  contentBlocks?: PortableTextBlock[];  // converted for Sanity (Phase 3)
  sectionImage?: string;        // Cloudinary URL (Phase 4)
  wordCount?: number;
}

export interface LeadMagnetOutline {
  title: string;
  subtitle: string;
  targetAudience: string;
  category: LeadMagnetCategory;
  keyBenefits: string[];        // 5 "what you'll learn" bullets
  sections: LeadMagnetSection[];
  estimatedWordCount: number;
  estimatedPages: number;
}

// ─── Generated Content ────────────────────────────────────────────────────────

export interface GeneratedLeadMagnet {
  outline: LeadMagnetOutline;
  sections: LeadMagnetSection[];     // fully populated with content + contentBlocks
  introduction: string;              // markdown
  conclusion: string;                // markdown
  introductionBlocks: PortableTextBlock[];
  conclusionBlocks: PortableTextBlock[];
}

// ─── Images ───────────────────────────────────────────────────────────────────

export interface LeadMagnetImages {
  coverImage: string;         // Cloudinary URL
  sectionImages: string[];    // Cloudinary URLs (3–4, one per selected section)
}

// ─── Publishing ───────────────────────────────────────────────────────────────

export interface LeadMagnetPublishInput {
  outline: LeadMagnetOutline;
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  pdfUrl: string;
  status: LeadMagnetStatus;
  originalPromptInput: LeadMagnetPromptInput;
}

export interface PublishedLeadMagnet {
  sanityDocumentId: string;
  slug: string;
  pdfUrl: string;
  publicUrl: string;
}

// ─── API Response Shapes ──────────────────────────────────────────────────────

export interface LeadMagnetSuccessResponse<T> {
  success: true;
  data: T;
  warnings?: string[];
}

export interface LeadMagnetErrorResponse {
  success: false;
  error: string;
}

export type LeadMagnetApiResponse<T> =
  | LeadMagnetSuccessResponse<T>
  | LeadMagnetErrorResponse;
```

If `@portabletext/types` is not directly available, define a minimal local fallback:
```ts
// Fallback if @portabletext/types is unavailable as a direct import
export interface PortableTextBlock {
  _type: "block";
  _key: string;
  style: string;
  children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }>;
  markDefs: unknown[];
  listItem?: "bullet" | "number";
}
```

---

### Routing (`i18n/routing.ts`)

Add the public lead magnet route alongside existing routes. Follow the same pattern as existing bilingual routes:

```ts
'/lead-magnets/[slug]': {
  en: '/lead-magnets/[slug]',
  es: '/imanes-de-leads/[slug]',
},
```

---

### File Structure After Phase 1

```
sanity/
  schemaTypes/
    leadMagnetType.ts    ← NEW
    index.ts             ← updated (add leadMagnetType)
  structure.ts           ← updated (add Lead Magnets list item)
lib/
  lead-magnet-generator/
    types.ts             ← NEW
i18n/
  routing.ts             ← updated (add /lead-magnets/[slug] route)
```

---

### Success Criteria

Phase 1 is complete when:

1. Sanity Studio loads without errors and shows "Lead Magnets" in the left sidebar
2. Creating a new Lead Magnet document in Sanity Studio shows all defined fields organized in the correct groups
3. A `leadMagnet` document can be saved in Sanity with all required fields populated
4. `lib/lead-magnet-generator/types.ts` exports all types without TypeScript errors: `pnpm tsc --noEmit`
5. `LeadMagnetPromptInput`, `LeadMagnetOutline`, `GeneratedLeadMagnet`, `LeadMagnetImages`, `PublishedLeadMagnet` are all exported and importable
6. The `/lead-magnets/[slug]` route is present in `i18n/routing.ts` for both `en` and `es`
7. `pnpm build` passes with no new errors

---

## References

**Existing files to read before implementing:**
- `sanity/schemaTypes/postType.ts` — full blog post schema; replicate the same validation patterns, field group structure, and Sanity helper imports (`defineType`, `defineField`, `defineArrayMember`)
- `sanity/schemaTypes/index.ts` — where to register the new type
- `sanity/structure.ts` — where to add the Lead Magnets sidebar entry
- `i18n/routing.ts` — existing bilingual route pattern to follow for `/lead-magnets/[slug]`
- `lib/blog-generator/types.ts` — existing type file pattern to replicate

**External docs:**
- Sanity Schema Types: https://www.sanity.io/docs/schema-types
- Sanity Portable Text: https://www.sanity.io/docs/portable-text
- `@portabletext/types` npm: https://www.npmjs.com/package/@portabletext/types
