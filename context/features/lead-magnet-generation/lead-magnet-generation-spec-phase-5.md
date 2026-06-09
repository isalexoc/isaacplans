# Lead Magnet Generator — Phase 5 Spec

## Context

This is Phase 5 of an 8-phase feature that generates professional PDF guides behind email-gated landing pages.

**Phase 1 (complete):** Sanity schema + TypeScript types.
**Phase 2 (complete):** AI outline generation.
**Phase 3 (complete):** AI section content generation — full prose for all sections, introduction, and conclusion.
**Phase 4 (complete):** AI image generation — `LeadMagnetImages` with Cloudinary URLs for cover + section images.

**Phase 5 (this doc):** PDF generation — compile all content and images into a branded, professional PDF using `@react-pdf/renderer`, then upload the PDF to Cloudinary and return the download URL.

**Remaining phases:**
- Phase 6: Sanity publishing
- Phase 7: Admin generator UI
- Phase 8: Public landing page + lead capture

---

## Phase 5: PDF Generation

### Goal

Compile the fully generated lead magnet content into a professionally designed, branded PDF. The PDF must look polished enough to represent Isaac Plans Insurance at the highest level — clear layout, brand colors, readable typography, and a strong call-to-action back page. Upload the PDF to Cloudinary as a raw asset and return the secure download URL.

### What to Build

1. **`pnpm add @react-pdf/renderer`** — new dependency
2. **`lib/lead-magnet-generator/pdf/`** — folder containing PDF layout components
   - `pdf-styles.ts` — shared StyleSheet and brand tokens
   - `pdf-cover.tsx` — cover page component
   - `pdf-toc.tsx` — table of contents component
   - `pdf-section.tsx` — individual section component
   - `pdf-back-page.tsx` — back CTA page component
3. **`lib/lead-magnet-generator/pdf-generator.ts`** — orchestrates PDF assembly + Cloudinary upload
4. **`app/api/admin/lead-magnet-generator/generate-pdf/route.ts`** — POST endpoint, Clerk-authenticated

---

### New Dependency

```bash
pnpm add @react-pdf/renderer
```

`@react-pdf/renderer` renders React component trees to PDF buffers in Node.js. It uses a custom set of layout primitives (`View`, `Text`, `Image`, `Page`, `Document`) — not standard HTML elements. All styling uses a subset of CSS via its `StyleSheet.create()` API.

---

### Brand Tokens (`lib/lead-magnet-generator/pdf/pdf-styles.ts`)

```ts
import { StyleSheet, Font } from "@react-pdf/renderer";

export const BRAND = {
  blue: "#0077B6",
  accent: "#00B4D8",
  dark: "#1a1a2e",
  light: "#f0f8ff",
  white: "#ffffff",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
  borderGray: "#e5e7eb",
};

export const FONT_SIZES = {
  h1: 28,
  h2: 20,
  h3: 16,
  h4: 13,
  body: 11,
  small: 9,
  caption: 8,
};

export const styles = StyleSheet.create({
  page: {
    backgroundColor: BRAND.white,
    paddingTop: 48,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
  },
  coverPage: {
    backgroundColor: BRAND.blue,
    padding: 0,
  },
  h1: {
    fontSize: FONT_SIZES.h1,
    fontFamily: "Helvetica-Bold",
    color: BRAND.dark,
    marginBottom: 8,
  },
  h2: {
    fontSize: FONT_SIZES.h2,
    fontFamily: "Helvetica-Bold",
    color: BRAND.blue,
    marginBottom: 6,
    marginTop: 20,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.accent,
  },
  h3: {
    fontSize: FONT_SIZES.h3,
    fontFamily: "Helvetica-Bold",
    color: BRAND.dark,
    marginBottom: 4,
    marginTop: 14,
  },
  body: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    lineHeight: 1.6,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    lineHeight: 1.6,
    marginBottom: 4,
    paddingLeft: 12,
  },
  actionStep: {
    backgroundColor: BRAND.light,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.accent,
    padding: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  actionStepLabel: {
    fontSize: FONT_SIZES.small,
    fontFamily: "Helvetica-Bold",
    color: BRAND.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  tocItem: {
    fontSize: FONT_SIZES.body,
    color: BRAND.dark,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: 56,
    fontSize: FONT_SIZES.caption,
    color: BRAND.gray,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 56,
    fontSize: FONT_SIZES.caption,
    color: BRAND.gray,
  },
});
```

---

### PDF Components

#### Cover Page (`lib/lead-magnet-generator/pdf/pdf-cover.tsx`)

Layout:
- Full-page blue (`BRAND.blue`) background
- Top white band: "A FREE GUIDE FROM" + "ISAAC PLANS INSURANCE" (bold white)
- Center: Cover image (full width, ~50% of page height) if available, else blue gradient block
- Bottom white band: Title (large white), subtitle (smaller white), publication date, thin white line separator
- Bottom strip: "isaacplans.com" in small white text

```tsx
import { Page, View, Text, Image } from "@react-pdf/renderer";
import { BRAND, styles } from "./pdf-styles";

interface PdfCoverProps {
  title: string;
  subtitle: string;
  coverImageUrl: string;
  publishedAt: string; // formatted date string e.g. "June 2026"
}
```

#### Table of Contents (`lib/lead-magnet-generator/pdf/pdf-toc.tsx`)

Layout:
- Page title: "Contents" (H1 style, left-aligned)
- Numbered list of sections: `01 · Section Title ............. p.X`
- Use dot leaders between title and page number
- Page numbers are estimated (not exact — React PDF doesn't track page breaks dynamically): calculate `3 + sectionIndex * 2` as a rough estimate
- "Introduction" as item 0, each section, "Conclusion" as last item

#### Section Page (`lib/lead-magnet-generator/pdf/pdf-section.tsx`)

Layout:
- Section title (H2 with blue left border accent)
- If `sectionImage` URL is provided: image placed at the top-right of the page in a float-like arrangement (View with fixed width + Image inside)
- Section content: parse markdown into PDF-compatible elements
- Action Step box (blue left border, light blue background)
- Page footer: guide title (left) + page number (right)

**Markdown parsing for PDF:**

Write a `markdownToPdfElements(markdown: string): React.ReactNode[]` helper in `pdf-generator.ts` that converts markdown text to `@react-pdf/renderer` elements:
- `## Heading` → `<Text style={styles.h2}>`
- `### Sub-heading` → `<Text style={styles.h3}>`
- `- bullet item` → `<Text style={styles.bulletItem}>• bullet item`
- `**bold text**` → `<Text style={{ fontFamily: "Helvetica-Bold" }}>bold text`
- `> **Action Step:** ...` → `<View style={styles.actionStep}><Text style={styles.actionStepLabel}>ACTION STEP</Text><Text ...>`
- Regular paragraph text → `<Text style={styles.body}>`

Keep the parser simple — split by `\n`, classify each line by prefix, handle inline bold with a regex split.

#### Back Page (`lib/lead-magnet-generator/pdf/pdf-back-page.tsx`)

Layout:
- Full-page blue background
- Large white heading: "Ready to Protect What Matters Most?"
- Subtext: "Get a free consultation with an Isaac Plans insurance specialist — no pressure, just answers."
- Three simple benefit bullets in white (phone, email, no obligation)
- Large white CTA box: "Call us: (your phone number)" + "Visit: isaacplans.com"
- Footer: Isaac Plans Insurance logo text + "Licensed Insurance Agency"

Use placeholder contact info — the real phone/email will be configured during publishing (Phase 6) or hardcoded from env vars.

---

### PDF Generator (`lib/lead-magnet-generator/pdf-generator.ts`)

#### `assemblePdf()`

```ts
export async function assemblePdf(params: {
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
}): Promise<Buffer>
```

Implementation:
1. Build the `<Document>` tree:
   ```
   <Document>
     <PdfCover />
     <PdfToc />
     <Page> {introductionBlocks rendered as PDF elements} </Page>
     {sections.map(section => <PdfSection section={section} />)}
     <Page> {conclusionBlocks rendered as PDF elements} </Page>
     <PdfBackPage />
   </Document>
   ```
2. Call `pdf(<Document>).toBuffer()` — returns a Node.js `Buffer`
3. Return the buffer

#### `uploadPdfToCloudinary()`

```ts
export async function uploadPdfToCloudinary(
  pdfBuffer: Buffer,
  category: LeadMagnetCategory,
  title: string
): Promise<{ pdfUrl: string; pageCount: number }>
```

Implementation:
- Convert buffer to base64: `pdfBuffer.toString("base64")`
- Upload via `cloudinary.uploader.upload("data:application/pdf;base64," + base64, { resource_type: "raw", format: "pdf", folder: "lead-magnets/" + category, public_id: createSlug(title) + "-" + Date.now() })`
- Page count is not available from Cloudinary for PDFs — estimate: `Math.ceil(generatedContent.sections.length * 2 + 4)` (2 pages per section + cover/TOC/intro/conclusion/back)
- Return `{ pdfUrl: result.secure_url, pageCount }`

#### Main export

```ts
export async function generateAndUploadPdf(params: {
  generatedContent: GeneratedLeadMagnet;
  images: LeadMagnetImages;
  outline: LeadMagnetOutline;
}): Promise<{ pdfUrl: string; pageCount: number }>
```

Calls `assemblePdf()` then `uploadPdfToCloudinary()`.

Import `createSlug()` from `lib/blog-generator/portable-text.ts` for the Cloudinary public ID.

---

### API Route (`app/api/admin/lead-magnet-generator/generate-pdf/route.ts`)

`POST /api/admin/lead-magnet-generator/generate-pdf`

**Auth:** Clerk `auth()` — 401 if missing.

**Request body:**
```json
{
  "generatedContent": { ... },
  "images": {
    "coverImage": "https://res.cloudinary.com/...",
    "sectionImages": ["https://...", "https://...", "https://...", ""]
  },
  "outline": { ... }
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://res.cloudinary.com/.../lead-magnets/final-expense/complete-seniors-guide-1234567890.pdf",
    "pageCount": 22
  }
}
```

**Error response (500):**
```json
{ "success": false, "error": "PDF assembly failed: Cannot read properties of undefined..." }
```

Set `export const maxDuration = 60` — PDF assembly and Cloudinary upload takes 15–40 seconds depending on image count and guide length.

---

### File Structure After Phase 5

```
lib/
  lead-magnet-generator/
    types.ts               ← Phase 1 (unchanged)
    prompts.ts             ← Phase 2–3 (unchanged)
    outline-generator.ts   ← Phase 2 (unchanged)
    section-generator.ts   ← Phase 3 (unchanged)
    image-generator.ts     ← Phase 4 (unchanged)
    pdf-generator.ts       ← NEW: assemblePdf() + uploadPdfToCloudinary()
    pdf/
      pdf-styles.ts        ← NEW: brand tokens + StyleSheet
      pdf-cover.tsx        ← NEW: cover page component
      pdf-toc.tsx          ← NEW: table of contents component
      pdf-section.tsx      ← NEW: section content component
      pdf-back-page.tsx    ← NEW: CTA back page component
app/
  api/
    admin/
      lead-magnet-generator/
        generate-pdf/
          route.ts         ← NEW
```

---

### Success Criteria

Phase 5 is complete when:

1. `POST /api/admin/lead-magnet-generator/generate-pdf` with a complete `GeneratedLeadMagnet` + `LeadMagnetImages` + `LeadMagnetOutline` returns a valid Cloudinary PDF URL
2. Downloading the returned URL produces a valid, readable PDF file
3. The PDF includes: cover page, table of contents, introduction, all sections, conclusion, back CTA page — in that order
4. Cover image appears on the cover page (or a graceful fallback if `coverImage` is `""`)
5. Section images appear in their respective sections where `sectionImage` is non-empty
6. Action Step callout boxes are visually distinct (colored border/background)
7. Brand colors (`#0077B6`, `#00B4D8`) appear on cover, section headings, and back page
8. Route returns 401 if unauthenticated
9. `pnpm tsc --noEmit` passes — React PDF components type-check correctly

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/types.ts` — `GeneratedLeadMagnet`, `LeadMagnetImages`, `LeadMagnetOutline`; input types
- `lib/lead-magnet-generator/section-generator.ts` — how section markdown content is structured (needed to design the markdown-to-PDF parser)
- `lib/blog-generator/portable-text.ts` — `createSlug()` function to import for Cloudinary public ID
- Search for Cloudinary `uploader.upload` usage in `lib/` to find the existing client configuration
- `tailwind.config.ts` — brand color hex values to replicate in `BRAND` constants

**New dependency:**
- `@react-pdf/renderer` docs: https://react-pdf.org/
- Cloudinary raw upload: https://cloudinary.com/documentation/node_image_and_video_upload#upload_options_table (`resource_type: "raw"`)

**Important `@react-pdf/renderer` notes:**
- No HTML — use `View`, `Text`, `Image`, `Page`, `Document` from the library
- No CSS classes — use `StyleSheet.create()` and inline style props
- `Image` component accepts both local file paths and remote HTTPS URLs; always use Cloudinary HTTPS URLs
- `pdf().toBuffer()` is the Node.js method — not `renderToString()` or `renderToStream()`
- Run in the API route (Node.js environment) — not in browser/client components
