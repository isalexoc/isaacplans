# Blog Generation from YouTube — Phase 4 Spec

## Context

This is Phase 4 of a multi-phase feature that allows an admin user to paste a YouTube URL and generate a professional bilingual blog post published to Sanity CMS.

**Phase 1 (complete):** YouTube data extraction
**Phase 2 (complete):** OpenAI content generation (English)
**Phase 3 (complete):** Spanish translation + Sanity publishing
**Phase 4 (this doc):** Admin UI — URL input, progress indicators, review/edit, publish
**Remaining:** Phase 5 — Polish (regeneration controls, batch processing)

---

## Phase 4: Admin UI

### Goal

Build a protected admin page that orchestrates the full Phase 1→2→3 pipeline with a clear multi-stage UI: URL input → extraction → generation → review & edit → publish → success. The admin can edit any generated field before publishing.

---

### Updates to Existing Code

Before building the UI, make one small fix to `lib/blog-generator/sanity-publisher.ts`:

**Problem:** `publishBilingualPost` uses `enContent.bodyBlocks` directly. If the admin edits `bodyMarkdown` in the review step, the pre-computed `bodyBlocks` become stale.

**Fix:** Re-convert `bodyMarkdown → bodyBlocks` inside `publishBilingualPost` so the markdown is always the source of truth:

```ts
// In publishBilingualPost, replace enContent.bodyBlocks with:
import { textToBlocks } from "./portable-text";

// ...
body: textToBlocks(enContent.bodyMarkdown),
```

Apply the same for `esContent.bodyBlocks` → `textToBlocks(esContent.bodyMarkdown)`.

---

### Route & Auth Setup

**1. Add to `i18n/routing.ts` pathnames** (same path in both locales — admin tool, not translated):

```ts
"/admin/blog-generator": {
  en: "/admin/blog-generator",
  es: "/admin/blog-generator",
},
```

**2. Update `middleware.ts` — add admin routes to `isProtectedRoute`:**

```ts
const isProtectedRoute = createRouteMatcher([
  '/presentations(.*)',
  '/en/presentations(.*)',
  '/es/presentations(.*)',
  '/admin(.*)',           // add
  '/en/admin(.*)',        // add
  '/es/admin(.*)',        // add
]);
```

---

### Page File

**`app/[locale]/admin/blog-generator/page.tsx`**

This is a single `"use client"` page component. No sub-component files needed for Phase 4 — keep everything inline.

---

### Stage Model

```ts
type Stage =
  | "idle"        // URL input form
  | "extracting"  // POST /api/admin/blog-generator/extract
  | "generating"  // POST /api/admin/blog-generator/generate
  | "review"      // Admin edits generated content
  | "publishing"  // POST /api/admin/blog-generator/publish
  | "success";    // Both posts created — show links
```

---

### State Shape

```ts
// Held across stages
const [stage, setStage] = useState<Stage>("idle");
const [url, setUrl] = useState("");
const [error, setError] = useState<string | null>(null);
const [extraction, setExtraction] = useState<YouTubeExtractionResult | null>(null);
const [result, setResult] = useState<SanityPublishResult | null>(null);

// Review form — populated after generation, editable by admin
const [form, setForm] = useState<ReviewForm>({
  title: "",
  excerpt: "",
  category: "general",
  tags: "",           // comma-separated string
  readingTime: 5,
  bodyMarkdown: "",
  seo: {
    metaTitle: "",
    metaDescription: "",
    focusKeyword: "",
    keywords: "",     // comma-separated string
  },
});
```

The `ReviewForm` type uses comma-separated strings for `tags` and `seo.keywords` — simpler than a tag input component. Convert back to arrays before sending to the publish API.

---

### Pipeline Function

```ts
async function runPipeline(youtubeUrl: string) {
  setError(null);

  // Stage 1: Extract
  setStage("extracting");
  const extractRes = await fetch("/api/admin/blog-generator/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: youtubeUrl }),
  });
  const extractData = await extractRes.json();
  if (!extractData.success) throw new Error(extractData.error);
  setExtraction(extractData.data);

  // Stage 2: Generate
  setStage("generating");
  const generateRes = await fetch("/api/admin/blog-generator/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extraction: extractData.data }),
  });
  const generateData = await generateRes.json();
  if (!generateData.success) throw new Error(generateData.error);

  // Populate review form
  const content: GeneratedBlogContent = generateData.data;
  setForm({
    title: content.title,
    excerpt: content.excerpt,
    category: content.category,
    tags: content.tags.join(", "),
    readingTime: content.readingTime,
    bodyMarkdown: content.bodyMarkdown,
    seo: {
      metaTitle: content.seo.metaTitle,
      metaDescription: content.seo.metaDescription,
      focusKeyword: content.seo.focusKeyword,
      keywords: content.seo.keywords.join(", "),
    },
  });

  setStage("review");
}
```

Wrap the call in a try/catch: on error, set `setError(message)` and return to `"idle"` stage so the user can retry.

---

### Publish Function

```ts
async function handlePublish() {
  if (!extraction) return;
  setError(null);
  setStage("publishing");

  // Rebuild GeneratedBlogContent from the edited form
  const content: GeneratedBlogContent = {
    title: form.title,
    excerpt: form.excerpt,
    bodyMarkdown: form.bodyMarkdown,
    bodyBlocks: [],  // sanity-publisher re-converts from bodyMarkdown
    category: form.category,
    tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    readingTime: form.readingTime,
    seo: {
      metaTitle: form.seo.metaTitle,
      metaDescription: form.seo.metaDescription,
      focusKeyword: form.seo.focusKeyword,
      keywords: form.seo.keywords.split(",").map((k) => k.trim()).filter(Boolean),
    },
  };

  const res = await fetch("/api/admin/blog-generator/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, extraction }),
  });
  const data = await res.json();
  if (!data.success) {
    setError(data.error);
    setStage("review");
    return;
  }
  setResult(data.data);
  setStage("success");
}
```

---

### UI Layout Per Stage

All stages share a centered max-w-3xl container with a page title "Blog Generator".

#### `idle` — URL Input

```
┌─────────────────────────────────────────────────┐
│  Blog Generator                                 │
│  Generate a bilingual blog post from a YouTube  │
│  video using AI.                                │
│                                                 │
│  YouTube URL                                    │
│  ┌─────────────────────────────────────┐  [Generate] │
│  │ https://youtube.com/watch?v=...     │        │
│  └─────────────────────────────────────┘        │
│                                                 │
│  [error message if any]                         │
└─────────────────────────────────────────────────┘
```

- `Input` for URL, full width
- `Button` disabled while URL is empty
- Error shown in a red `<p>` below the form if `error` is set

#### `extracting` / `generating` / `publishing` — Loading

```
┌─────────────────────────────────────────────────┐
│  Blog Generator                                 │
│                                                 │
│  ⟳  Extracting transcript and metadata...       │
│     (or "Generating blog post with AI..."       │
│      or "Translating and publishing...")        │
└─────────────────────────────────────────────────┘
```

- Centered spinner (`animate-spin` on a Lucide `Loader2` icon) + status text
- No cancel button — these are fast operations

#### `review` — Edit Generated Content

```
┌─────────────────────────────────────────────────┐
│  Blog Generator                    [Start Over] │
│                                                 │
│  ── Video ──────────────────────────────────── │
│  [thumbnail img]  Title: ...                    │
│                   Channel: ...  Duration: ...   │
│                                                 │
│  ── Content ──────────────────────────────────  │
│  Title *          [input]                       │
│  Excerpt *        [textarea, 3 rows]            │
│  Category *       [select dropdown]             │
│  Tags             [input, comma-separated]      │
│  Reading Time     [number input] min            │
│                                                 │
│  ── Body ─────────────────────────────────────  │
│  [textarea, 20 rows, monospace, bodyMarkdown]   │
│                                                 │
│  ── SEO ───────────────────────────────────────  │
│  Meta Title       [input]  (N/60 chars)         │
│  Meta Description [textarea, 2 rows] (N/160)    │
│  Focus Keyword    [input]                       │
│  Keywords         [input, comma-separated]      │
│                                                 │
│              [Publish as Draft]                 │
│  [error if publish failed]                      │
└─────────────────────────────────────────────────┘
```

- All fields are controlled inputs bound to `form` state
- Character counters on `title` (N/70), `seo.metaTitle` (N/60), `seo.metaDescription` (N/160) — rendered as `<span className="text-muted-foreground text-xs">{value.length}/N</span>` next to each label
- Body textarea uses `font-mono text-sm` class
- "Start Over" button resets to `idle` stage
- "Publish as Draft" calls `handlePublish()`
- The thumbnail is shown as a small `<img>` (max-w-[160px]) next to video metadata

#### `success` — Done

```
┌─────────────────────────────────────────────────┐
│  Blog Generator                                 │
│                                                 │
│  ✓ Posts created as drafts in Sanity            │
│                                                 │
│  English post → [Open in Sanity Studio]         │
│  Spanish post → [Open in Sanity Studio]         │
│                                                 │
│  Preview (once published):                      │
│  /en/blog/{enSlug}                              │
│  /es/blog/{esSlug}                              │
│                                                 │
│             [Generate Another Post]             │
└─────────────────────────────────────────────────┘
```

- Sanity Studio links: `https://isaacplans.sanity.studio/structure/post;{postId}` (or use `/studio/structure/post;{postId}` for local)
- Preview links shown as plain text (posts are drafts, not yet public)
- "Generate Another Post" resets all state back to `idle`

---

### Sanity Studio Deep Links

To link directly to a post in Sanity Studio:

```
/studio/structure/post;{postId}
```

Use `result.enPostId` and `result.esPostId` from the publish response.

---

### File Structure After Phase 4

```
app/
  [locale]/
    admin/
      blog-generator/
        page.tsx        ← NEW: "use client" page, full pipeline UI
i18n/
  routing.ts            ← updated: add /admin/blog-generator pathname
middleware.ts           ← updated: add /admin(.*) to isProtectedRoute
lib/
  blog-generator/
    sanity-publisher.ts ← updated: re-convert bodyMarkdown→blocks at publish time
```

---

### Success Criteria

Phase 4 is complete when:

- Navigating to `/en/admin/blog-generator` while unauthenticated redirects to Clerk sign-in
- Authenticated admin can paste a YouTube URL, click Generate, and see loading states for each stage
- After generation, all fields are pre-filled and editable
- Editing the body markdown textarea and publishing results in the edited content being saved to Sanity (not the original AI-generated version)
- Clicking "Publish as Draft" creates both EN and ES draft posts in Sanity and shows the Studio links
- Errors at any stage display a clear message and allow retry without losing progress
- "Start Over" and "Generate Another Post" correctly reset all state
- TypeScript check passes: `pnpm tsc --noEmit`

---

## References

**Files to read before implementing:**

- `app/[locale]/admin/blog-generator/page.tsx` — does not exist yet; create it
- `middleware.ts` — add admin routes to `isProtectedRoute` and the existing pattern as reference
- `i18n/routing.ts` — add `/admin/blog-generator` pathname following the existing pattern
- `lib/blog-generator/types.ts` — all types used in the page (`YouTubeExtractionResult`, `GeneratedBlogContent`, `SanityPublishResult`, `BlogCategory`, `VALID_CATEGORIES`)
- `lib/blog-generator/sanity-publisher.ts` — update `publishBilingualPost` to re-convert markdown to blocks
- `lib/blog-generator/portable-text.ts` — `textToBlocks` used in the publisher update
- `components/ui/` — `Button`, `Input`, `Textarea`, `Label`, `Select`, `Card`, `Separator`, `Badge` are all available

**Environment variables:** No new env vars needed — all already configured in Phases 1–3.
