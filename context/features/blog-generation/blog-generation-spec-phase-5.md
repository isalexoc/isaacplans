# Blog Generation from YouTube — Phase 5 Spec

## Context

This is Phase 5 (final) of the blog generation feature.

**Phases 1–4 (complete):** Full pipeline — extract → generate → translate → publish — with admin review UI at `/en/admin/blog-generator`.

**Phase 5 (this doc):** Polish — field-level regeneration, CTA auto-suggestion, publish status control, and batch mode.

---

## Phase 5: Polish

### Goal

Improve the admin experience with four targeted enhancements:

1. **Field regeneration** — Regenerate individual fields (title, excerpt, body) without re-running the full pipeline.
2. **CTA auto-suggestion** — Pre-fill lead capture CTA fields based on category; write them to Sanity on publish.
3. **Publish status control** — Let the admin choose "Draft" or "Published" before hitting publish.
4. **Batch mode** — Process multiple YouTube URLs sequentially without per-post review; auto-publish all as drafts.

---

## 1. Field Regeneration

### New API Route

`POST /api/admin/blog-generator/regenerate`

**Request body:**
```json
{
  "field": "title" | "excerpt" | "body",
  "extraction": YouTubeExtractionResult,
  "currentContent": GeneratedBlogContent
}
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "field": "title",
    "value": "New regenerated title"
  }
}
```

Auth: Clerk `auth()`, 401 if no `userId`. `maxDuration = 30`.

### New Function in `lib/blog-generator/content-generator.ts`

```ts
export async function regenerateField(
  field: "title" | "excerpt" | "body",
  extraction: YouTubeExtractionResult,
  currentContent: GeneratedBlogContent
): Promise<string>
```

Use a targeted prompt per field:

**title:**
```
The current title is: "{currentContent.title}"
Based on the transcript below, suggest one improved, SEO-optimized title (max 70 chars) that better captures the main topic. Return only the title string, no explanation.

Transcript: {extraction.transcript}
```

**excerpt:**
```
The current excerpt is: "{currentContent.excerpt}"
Write an improved 150–160 character excerpt that better summarizes the post for search results. Return only the excerpt string.

Post title: {currentContent.title}
Transcript: {extraction.transcript}
```

**body:**
```
Regenerate the full blog post body based on the transcript. Same markdown format rules apply (##/###/####, **bold**, - bullets, 800–1200 words). Return only the markdown body, no JSON wrapper.

Video title: {extraction.metadata.title}
Transcript: {extraction.transcript}
```

Do NOT use `response_format: json_object` for body regeneration — the model returns raw markdown. For title and excerpt, parse the raw string directly (no JSON parsing needed).

### UI Changes in `app/[locale]/admin/blog-generator/page.tsx`

Add a small "Regenerate" button next to the label of the **Title**, **Excerpt**, and **Body** fields in the review stage:

```
Title *                              [↺ Regenerate]
┌──────────────────────────────────────────────────┐
│ Current title...                                 │
└──────────────────────────────────────────────────┘
```

Button behavior:
- Shows a `Loader2` spinner while in flight (disable the button, not the whole form)
- On success, replaces the field value in `form` state
- On error, shows a small inline error below that field only (not the global error)
- Use a `regenerating` state per field: `{ title: boolean, excerpt: boolean, body: boolean }`

```ts
const [regenerating, setRegenerating] = useState({ title: false, excerpt: false, body: false });

async function handleRegenerate(field: "title" | "excerpt" | "body") {
  if (!extraction) return;
  setRegenerating((prev) => ({ ...prev, [field]: true }));
  try {
    const res = await fetch("/api/admin/blog-generator/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field, extraction, currentContent: buildContentFromForm() }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    if (field === "title") setFormField("title", data.data.value);
    if (field === "excerpt") setFormField("excerpt", data.data.value);
    if (field === "body") setFormField("bodyMarkdown", data.data.value);
  } catch (err) {
    // show inline field error
  } finally {
    setRegenerating((prev) => ({ ...prev, [field]: false }));
  }
}
```

`buildContentFromForm()` is a helper that converts the current `form` state back into a `GeneratedBlogContent` object (same logic as `handlePublish`).

---

## 2. CTA Auto-Suggestion

### Category → CTA Mapping

Create `lib/blog-generator/cta-config.ts`:

```ts
import type { BlogCategory } from "./types";

export interface CTADefaults {
  ctaType: "quote" | "consultation" | "contact";
  ctaText: string;
  ctaPosition: "bottom" | "middle" | "floating";
}

export const CATEGORY_CTA: Record<BlogCategory, CTADefaults> = {
  aca:                         { ctaType: "quote",        ctaText: "Get Your Free ACA Quote",             ctaPosition: "bottom" },
  "temporary-health-insurance":{ ctaType: "quote",        ctaText: "Get a Free Short-Term Health Quote",  ctaPosition: "bottom" },
  "dental-vision":             { ctaType: "quote",        ctaText: "Get Your Dental & Vision Quote",      ctaPosition: "bottom" },
  "hospital-indemnity":        { ctaType: "quote",        ctaText: "Get Your Free Coverage Quote",        ctaPosition: "bottom" },
  iul:                         { ctaType: "consultation", ctaText: "Schedule a Free IUL Consultation",    ctaPosition: "bottom" },
  "final-expense":             { ctaType: "quote",        ctaText: "Get Your Final Expense Quote",        ctaPosition: "bottom" },
  "cancer-plans":              { ctaType: "quote",        ctaText: "Get Your Cancer Plan Quote",          ctaPosition: "bottom" },
  "heart-stroke":              { ctaType: "quote",        ctaText: "Get Your Coverage Quote",             ctaPosition: "bottom" },
  general:                     { ctaType: "consultation", ctaText: "Schedule a Free Consultation",        ctaPosition: "bottom" },
  "tips-guides":               { ctaType: "consultation", ctaText: "Talk to an Insurance Expert",         ctaPosition: "bottom" },
  news:                        { ctaType: "consultation", ctaText: "Get Expert Insurance Advice",         ctaPosition: "bottom" },
};
```

### New Types in `lib/blog-generator/types.ts`

```ts
export interface CTASettings {
  enableCTA: boolean;
  ctaType: "quote" | "consultation" | "contact";
  ctaText: string;
  ctaPosition: "top" | "middle" | "bottom" | "floating";
}
```

### Update `ReviewForm` in the page

Add `cta: CTASettings` to the form state. Pre-fill from `CATEGORY_CTA[content.category]` when the generation completes (in `runPipeline`).

When `form.category` changes in the Select, update `form.cta` from the mapping automatically.

### CTA UI in Review Stage

Add a new **CTA** card below the SEO card:

```
── CTA ─────────────────────────────────────────
Enable CTA  [toggle switch]

(when enabled:)
CTA Type     [select: quote | consultation | contact]
Button Text  [input]
Position     [select: top | middle | bottom | floating]
```

Use the shadcn `Switch` component for the enable toggle.

### Update `lib/blog-generator/sanity-publisher.ts`

Add `cta: CTASettings` parameter to `publishBilingualPost`. Write `leadCapture` to both posts:

```ts
leadCapture: cta.enableCTA ? {
  enableCTA: true,
  ctaType: cta.ctaType,
  ctaText: cta.ctaText,
  ctaPosition: cta.ctaPosition,
} : { enableCTA: false },
```

Update `PublishRequest` type and the publish API route to pass `cta` through.

---

## 3. Publish Status Control

### UI Change

In the review stage, replace the single "Publish as Draft" button with a status selector + publish button:

```
Publish as:  ● Draft  ○ Published     [Publish]
```

Use two `Button` variants or a `RadioGroup` to toggle between `"draft"` and `"published"`. Default to `"draft"`.

Add `publishStatus: "draft" | "published"` to the form state.

### Backend Changes

Pass `status` through the publish pipeline:

- `PublishRequest` type: add `status: "draft" | "published"`
- `publishBilingualPost` signature: add `status` parameter, use it instead of the hardcoded `"draft"` string on both posts
- Publish API route: read `status` from request body, default to `"draft"` if missing

---

## 4. Batch Mode

### Overview

A second tab on the admin page ("Batch") lets the admin paste multiple YouTube URLs and process them all sequentially without per-post review. Each is auto-published as a draft with no editing step.

### UI

Add tabs to the page using shadcn `Tabs`:

```
[Single]  [Batch]
```

**Batch tab:**
```
┌──────────────────────────────────────────────────┐
│ Paste YouTube URLs (one per line, max 10)        │
│                                                  │
│ https://youtube.com/watch?v=...                  │
│ https://youtube.com/watch?v=...                  │
│ https://youtube.com/watch?v=...                  │
└──────────────────────────────────────────────────┘

[Process All as Drafts]

── Progress ──────────────────────────────────────
✓ https://... → /en/blog/aca-guide-2026
⟳ https://... → processing...
○ https://... → queued
✗ https://... → Error: No transcript available
```

### State

```ts
interface BatchItem {
  url: string;
  status: "queued" | "processing" | "done" | "error";
  result?: SanityPublishResult;
  error?: string;
}

const [batchUrls, setBatchUrls] = useState("");
const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
const [batchRunning, setBatchRunning] = useState(false);
```

### Processing Logic

```ts
async function runBatch() {
  const urls = batchUrls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean)
    .slice(0, 10);

  const items: BatchItem[] = urls.map((url) => ({ url, status: "queued" }));
  setBatchItems(items);
  setBatchRunning(true);

  for (let i = 0; i < items.length; i++) {
    setBatchItems((prev) =>
      prev.map((item, idx) => idx === i ? { ...item, status: "processing" } : item)
    );
    try {
      // Extract
      const extractData = await postJson("/api/admin/blog-generator/extract", { url: items[i].url });
      // Generate
      const generateData = await postJson("/api/admin/blog-generator/generate", { extraction: extractData.data });
      // Publish (no editing — use AI output as-is, with auto CTA)
      const content = generateData.data;
      const cta = CATEGORY_CTA[content.category];
      const publishData = await postJson("/api/admin/blog-generator/publish", {
        content,
        extraction: extractData.data,
        cta: { enableCTA: true, ...cta },
        status: "draft",
      });
      setBatchItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "done", result: publishData.data } : item
        )
      );
    } catch (err) {
      setBatchItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "error", error: err instanceof Error ? err.message : "Failed" } : item
        )
      );
      // Continue to next URL — don't abort the whole batch
    }
  }
  setBatchRunning(false);
}
```

`postJson` is a small inline helper:
```ts
async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}
```

---

## File Structure After Phase 5

```
lib/
  blog-generator/
    types.ts                ← add CTASettings type
    cta-config.ts           ← NEW: CATEGORY_CTA mapping
    content-generator.ts    ← add regenerateField() export
    sanity-publisher.ts     ← add cta + status params to publishBilingualPost
app/
  api/
    admin/
      blog-generator/
        extract/route.ts    ← unchanged
        generate/route.ts   ← unchanged
        publish/route.ts    ← pass cta + status through
        regenerate/route.ts ← NEW
  [locale]/
    admin/
      blog-generator/
        page.tsx            ← add regenerate buttons, CTA card, status toggle, batch tab
```

---

## Success Criteria

Phase 5 is complete when:

- "Regenerate" button next to Title updates only the title without affecting other fields
- "Regenerate" button next to Excerpt updates only the excerpt
- "Regenerate" button next to Body replaces the markdown textarea content
- Switching category in the Select auto-updates the CTA text and type fields
- Enabling CTA and publishing results in Sanity posts with `leadCapture.enableCTA: true`
- Choosing "Published" status results in Sanity posts with `status: "published"` (visible on the blog immediately)
- Batch mode processes up to 10 URLs, continues on individual errors, and shows per-URL status
- TypeScript check passes: `pnpm tsc --noEmit`

---

## References

**Files to read before implementing:**

- `app/[locale]/admin/blog-generator/page.tsx` — Phase 4 UI to extend
- `lib/blog-generator/content-generator.ts` — add `regenerateField` alongside `generateBlogContent`
- `lib/blog-generator/sanity-publisher.ts` — add `cta` and `status` parameters
- `lib/blog-generator/types.ts` — add `CTASettings`; update `PublishRequest`
- `app/api/admin/blog-generator/publish/route.ts` — pass `cta` and `status` to publisher
- `sanity/schemaTypes/postType.ts` — `leadCapture` schema for field names and valid values
- `components/ui/switch.tsx`, `components/ui/tabs.tsx` — already available in the project
