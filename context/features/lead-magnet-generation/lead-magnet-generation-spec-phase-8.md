# Lead Magnet Generator — Phase 8 Spec

## Context

This is Phase 8 — the final phase — of the lead magnet generator feature.

**Phases 1–7 (complete):** Data model, AI generation pipeline (outline → sections → images → PDF), Sanity publishing, and the admin generator UI.

**Phase 8 (this doc):** Public landing page + lead capture — a public-facing page where visitors enter their name and email to download the guide. The lead is captured in Agent CRM, a Meta CAPI `Lead` event fires, and the visitor immediately gets the PDF.

---

## Phase 8: Public Landing Page + Lead Capture

### Goal

Build the consumer-facing side of the lead magnet system. When a visitor lands on `/lead-magnets/[slug]`, they see a compelling landing page with the guide's benefits. After submitting their name and email, the lead is added to Agent CRM (with category-specific tagging), a Meta CAPI Lead event fires, the Sanity `downloadCount` increments, and the visitor receives the PDF download URL — all within a single API call.

### What to Build

1. **`app/[locale]/lead-magnets/[slug]/page.tsx`** — public landing page (Server Component with ISR)
2. **`components/lead-magnet-form.tsx`** — email capture form (Client Component)
3. **`app/api/lead-magnets/download/route.ts`** — lead capture + PDF delivery endpoint (no auth — public)

---

### Landing Page (`app/[locale]/lead-magnets/[slug]/page.tsx`)

#### Data fetching

Server Component. Fetch from Sanity using ISR. Query only `status === "published"` documents — return 404 for drafts.

```ts
const LEAD_MAGNET_BY_SLUG_QUERY = groq`
  *[_type == "leadMagnet" && slug.current == $slug && status == "published"][0] {
    _id,
    title,
    subtitle,
    description,
    coverImage { asset->{ url }, alt },
    keyBenefits,
    targetAudience,
    downloadCount,
    generatedPdfUrl,
    publishedAt,
    category,
    seo {
      metaTitle,
      metaDescription,
      focusKeyword,
      keywords
    },
    leadFormSettings {
      ctaHeadline,
      ctaSubtext,
      ctaButtonText,
      successMessage
    }
  }
`;
```

Add `revalidate = 3600` (1 hour ISR) or use `revalidateTag("lead-magnets")` — whichever matches the pattern in the existing blog pages.

**404 handling:** If `leadMagnet` is null, call `notFound()` from `next/navigation`.

#### `generateMetadata()`

```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // fetch seo fields from Sanity
  return {
    title: seo.metaTitle ?? leadMagnet.title,
    description: seo.metaDescription ?? leadMagnet.subtitle,
    openGraph: {
      title: seo.metaTitle ?? leadMagnet.title,
      description: seo.metaDescription ?? leadMagnet.subtitle,
      images: [{ url: leadMagnet.coverImage?.asset?.url ?? "" }],
    },
    keywords: seo.keywords ?? [],
  };
}
```

#### Page layout (top to bottom)

**1. Hero section**
- Full-width cover image (using `<Image>` with Sanity asset URL, or Cloudinary URL from `coverImage.asset.url`)
- Overlay: dark gradient bottom-to-top
- On overlay: "FREE DOWNLOAD" badge (accent blue, small), guide title (large white text), subtitle (smaller white text)

**2. "What You'll Learn" section**
- Section heading: "What You'll Learn"
- 5 benefit bullets from `keyBenefits` — each with a blue checkmark icon (`CheckCircle` from Lucide)
- Layout: two-column grid on desktop, single column on mobile

**3. About the guide**
- Section heading: "About This Guide"
- Render `description` Portable Text using `@portabletext/react` — same pattern as blog post body rendering
- `targetAudience` shown as a callout: "Written for: {targetAudience}"

**4. Lead capture form**
- Render `<LeadMagnetForm>` Client Component (see below)
- Pass `slug`, `leadFormSettings`, `category` as props

**5. Trust section**
- Download count: "{downloadCount} people have downloaded this guide"
- "By Isaac Plans Insurance — Licensed Insurance Agency"
- Star rating graphic (static 5-star, visual trust signal)

**6. Footer CTA**
- "Prefer to speak with someone?" → phone number (from env var `NEXT_PUBLIC_CONTACT_PHONE`)
- Secondary link: "Browse all free guides →" → `/lead-magnets` (list page — not built in this phase but link is safe to add)

---

### Lead Capture Form (`components/lead-magnet-form.tsx`)

Client Component. Handles form state, submission, and the post-submit download trigger.

#### Props

```ts
interface LeadMagnetFormProps {
  slug: string;
  category: LeadMagnetCategory;
  leadFormSettings: {
    ctaHeadline: string;
    ctaSubtext: string;
    ctaButtonText: string;
    successMessage: string;
  };
}
```

#### Form fields

```
Name (text input, required, placeholder "Your full name")
Email (email input, required, placeholder "your@email.com")
Phone (tel input, optional, placeholder "Phone number (optional)")
[Submit button: leadFormSettings.ctaButtonText]
```

Disclaimer text below submit: "We respect your privacy. No spam, ever. Unsubscribe anytime."

#### Submission flow

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  const res = await fetch("/api/lead-magnets/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, phone, slug }),
  });

  const data = await res.json();

  if (!data.success) {
    setError(data.error);
    setIsLoading(false);
    return;
  }

  // success — trigger download
  setIsSuccess(true);
  window.open(data.data.pdfUrl, "_blank");
}
```

#### Success state

Replace the form with:
- Large checkmark icon (green)
- `leadFormSettings.successMessage` (e.g. "Your guide is downloading now!")
- "Your download should open automatically. If not, click here." → `<a href={pdfUrl} target="_blank">`
- "While you wait, would you like a free consultation?" → tel link / contact modal trigger

---

### Lead Capture API (`app/api/lead-magnets/download/route.ts`)

`POST /api/lead-magnets/download`

**No auth** — this is a public endpoint. Apply rate limiting by email using a simple in-memory check or rely on Agent CRM's deduplication.

**Request body:**
```json
{
  "name": "Maria Garcia",
  "email": "maria@example.com",
  "phone": "305-555-1234",
  "slug": "complete-seniors-guide-to-final-expense-insurance"
}
```

**Processing steps:**

1. **Validate inputs**
   - `name`: required, non-empty
   - `email`: required, valid email format (simple regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
   - `slug`: required
   - Return 400 with descriptive error if validation fails

2. **Fetch the lead magnet from Sanity** (to get `category`, `generatedPdfUrl`, `leadFormSettings.agentCrmWorkflowId`)
   - Query: `*[_type == "leadMagnet" && slug.current == $slug && status == "published"][0] { category, generatedPdfUrl, leadFormSettings }`
   - Return 404 if not found

3. **POST contact to Agent CRM**
   - Replicate the pattern from existing contact form server actions (search for `AGENT_CRM_API_KEY` usage in `actions/` or `lib/`)
   - Contact fields: `firstName`, `lastName` (split from `name`), `email`, `phone`
   - Tags: `["lead-magnet", "lead-magnet-" + category, "lead-magnet-" + slug]`
   - Source: `"lead-magnet-" + slug`
   - Non-fatal — if CRM call fails, log error and continue (do not block the download)

4. **Trigger Agent CRM workflow** (optional)
   - If `leadFormSettings.agentCrmWorkflowId` is set, trigger via Agent CRM Workflow API
   - Otherwise trigger the default lead magnet workflow from env var `AGENT_CRM_LEAD_MAGNET_WORKFLOW_ID`
   - Non-fatal

5. **Fire Meta CAPI Lead event**
   - Replicate the pattern from `lib/meta-capi.ts`
   - Event name: `"Lead"`
   - Custom data: `{ content_name: slug, content_category: category }`
   - Hash email + phone with SHA-256 (same as existing CAPI calls)
   - Non-fatal

6. **Increment `downloadCount` in Sanity**
   - `sanityWriteClient.patch(leadMagnetId).inc({ downloadCount: 1 }).commit()`
   - Non-fatal

7. **Return the PDF URL**

```json
{
  "success": true,
  "data": {
    "pdfUrl": "https://res.cloudinary.com/.../lead-magnets/final-expense/guide.pdf"
  }
}
```

**Error responses:**
```json
// 400: validation failure
{ "success": false, "error": "Email address is required." }

// 404: guide not found
{ "success": false, "error": "Guide not found." }

// 500: unexpected error
{ "success": false, "error": "Something went wrong. Please try again." }
```

---

### New Environment Variable

Add to `.env` (if not already present):
```
AGENT_CRM_LEAD_MAGNET_WORKFLOW_ID=your_workflow_id_here
```

This is the default Agent CRM workflow triggered when someone downloads any lead magnet. Can be overridden per-guide via `leadFormSettings.agentCrmWorkflowId` in Sanity.

---

### File Structure After Phase 8

```
app/
  [locale]/
    lead-magnets/
      [slug]/
        page.tsx             ← NEW: public landing page
  api/
    lead-magnets/
      download/
        route.ts             ← NEW: lead capture + PDF delivery
components/
  lead-magnet-form.tsx       ← NEW: email capture form (Client Component)
```

No changes to existing files except `.env` (new env var) and `i18n/routing.ts` (already updated in Phase 1).

---

### Success Criteria

Phase 8 is complete when:

1. Visiting `/en/lead-magnets/{slug}` for a published lead magnet renders the full landing page with all sections
2. Visiting `/en/lead-magnets/{non-existent-slug}` returns a 404 page
3. Submitting the form with a valid name + email triggers the download — `window.open(pdfUrl)` fires and the PDF opens
4. The contact appears in Agent CRM within 30 seconds of form submission with the correct tags
5. The Meta CAPI `Lead` event appears in Meta Events Manager (test event code in dev)
6. `downloadCount` increments in the Sanity document after each form submission (check via Sanity Studio)
7. Submitting with an invalid email returns an inline error message — form does NOT submit
8. The page has valid OG metadata (check via `curl -s {url} | grep og:title`)
9. The success state shows after submission with a working PDF download link
10. `pnpm build` passes — no TypeScript or build errors introduced

---

## References

**Files to read before implementing:**
- `lib/meta-capi.ts` — exact Meta CAPI event pattern to replicate for the `Lead` event (hash functions, event structure, deduplication ID)
- Search for `AGENT_CRM_API_KEY` in `actions/` and `lib/` — find the existing Agent CRM contact creation function to reuse (do not duplicate the HTTP call logic)
- `app/[locale]/blog/[slug]/page.tsx` — Sanity page fetch pattern, ISR configuration, `generateMetadata()` pattern, `@portabletext/react` usage
- `components/` — search for existing form components to reference for styling patterns; use shadcn/ui `Input`, `Button`, `Label`
- `i18n/routing.ts` — confirm `/lead-magnets/[slug]` route was added in Phase 1 before testing locale-based navigation

**Environment variables:**
- `AGENT_CRM_API_KEY`, `AGENT_CRM_LOCATION_ID` — Agent CRM contact creation (already in project)
- `META_CAPI_ACCESS_TOKEN`, `NEXT_PUBLIC_FACEBOOK_PIXEL_ID` — Meta CAPI (already in project)
- `SANITY_API_WRITE_TOKEN` — for `downloadCount` increment (already in project)
- `AGENT_CRM_LEAD_MAGNET_WORKFLOW_ID` — new; add to `.env`
- `NEXT_PUBLIC_CONTACT_PHONE` — for the footer CTA phone number (add to `.env` if not present)

**External docs:**
- `@portabletext/react` for rendering Sanity Portable Text: https://github.com/portabletext/react-portabletext
- Meta CAPI Lead event: https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/server-event
