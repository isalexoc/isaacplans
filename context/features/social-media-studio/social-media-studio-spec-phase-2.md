# Social Media Content Studio — Phase 2 Spec

## Context

Phase 1 established the TypeScript types and Sanity `socialPost` schema.

**Phase 2 (this doc):** Content Source API — fetch blog posts and lead magnets from Sanity as selectable source options; extract and normalize each into the `SocialPostSource` shape that the AI copy generator (Phase 3) expects as input.

**Remaining phases:** Phase 3 (AI copy), Phase 4 (AI images), Phase 5 (video scripts), Phase 6 (admin UI), Phase 7 (publish + history).

---

## Phase 2: Content Source API

### Goal

Build the service and API routes that feed the source picker in the Phase 6 UI. Two endpoints:
1. `GET /api/admin/social-media-studio/sources` — returns a paginated, searchable list of blog posts and lead magnets from Sanity
2. `GET /api/admin/social-media-studio/sources/[type]/[id]` — returns the full normalized `SocialPostSource` for a specific document (used as input to the Phase 3 copy generator)

Both routes are Clerk-auth-protected.

### What to Build

1. **`lib/social-media-studio/source-fetcher.ts`** — Sanity GROQ queries + content normalization
2. **`app/api/admin/social-media-studio/sources/route.ts`** — list endpoint
3. **`app/api/admin/social-media-studio/sources/[type]/[id]/route.ts`** — detail/extract endpoint

---

### Service: `lib/social-media-studio/source-fetcher.ts`

Use the existing read-only Sanity client from `lib/sanity/client.ts` (or wherever the project's `createClient` is initialized — check existing usage in `lib/blog-generator/` or `lib/lead-magnet-generator/`).

#### `fetchSourceList(options)`

```ts
interface FetchSourceListOptions {
  q?: string;       // search term — filters title (case-insensitive prefix)
  category?: string; // filter by insurance category slug
  locale?: string;  // blog post locale filter (default: "en")
  limit?: number;   // default: 30
}

interface SourceListResult {
  blogPosts: BlogPostSummary[];
  leadMagnets: LeadMagnetSummary[];
}

export async function fetchSourceList(options: FetchSourceListOptions = {}): Promise<SourceListResult>
```

**Blog posts GROQ:**
```groq
*[
  _type == "post"
  && locale == $locale
  && defined(slug.current)
  && ($q == null || title match $q + "*")
  && ($category == null || category == $category)
] | order(publishedAt desc) [0...$limit] {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  category,
  "featuredImageUrl": mainImage.asset->url,
  publishedAt
}
```

**Lead magnets GROQ:**
```groq
*[
  _type == "leadMagnet"
  && status == "published"
  && defined(slug.current)
  && ($q == null || title match $q + "*")
  && ($category == null || category == $category)
] | order(publishedAt desc) [0...$limit] {
  _id,
  title,
  subtitle,
  "slug": slug.current,
  category,
  "coverImageUrl": coverImage.asset->url,
  publishedAt
}
```

Pass params: `{ locale: options.locale ?? "en", q: options.q ?? null, category: options.category ?? null, limit: options.limit ?? 30 }`.

Run both GROQ queries in parallel with `Promise.all`. Return `{ blogPosts, leadMagnets }`.

---

#### `fetchBlogPostContent(id: string): Promise<SocialPostSource>`

Fetches the full blog post and normalizes it to `SocialPostSource`.

**GROQ:**
```groq
*[_type == "post" && _id == $id][0] {
  _id,
  title,
  "slug": slug.current,
  excerpt,
  category,
  locale,
  "featuredImageUrl": mainImage.asset->url,
  body
}
```

**Body text extraction:**

The `body` field is a Portable Text array. Extract plain text by walking the blocks:

```ts
function portableTextToPlainText(blocks: unknown[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b: any) => b._type === "block" && Array.isArray(b.children))
    .map((b: any) => b.children.map((span: any) => span.text ?? "").join(""))
    .join("\n\n");
}
```

Truncate the result to 3,000 characters. The full body is too long for a prompt — 3,000 chars gives the AI enough context without hitting token limits.

**Build `SocialPostSource`:**
```ts
{
  type: "blog_post",
  id: doc._id,
  slug: doc.slug,
  title: doc.title,
  subtitle: doc.excerpt ?? undefined,
  bodyText: portableTextToPlainText(doc.body).slice(0, 3000),
  category: doc.category ?? undefined,
  imageUrl: doc.featuredImageUrl ?? undefined,
  publicUrl: `https://isaacplans.com/${doc.locale ?? "en"}/blog/${doc.slug}`,
  locale: (doc.locale as SocialLocale) ?? "en",
}
```

Throw a descriptive error if the document is not found (GROQ returns `null`):
```ts
if (!doc) throw new Error(`Blog post not found: ${id}`);
```

---

#### `fetchLeadMagnetContent(id: string): Promise<SocialPostSource>`

Fetches the full lead magnet and normalizes it to `SocialPostSource`.

**GROQ:**
```groq
*[_type == "leadMagnet" && _id == $id][0] {
  _id,
  title,
  subtitle,
  "slug": slug.current,
  category,
  "coverImageUrl": coverImage.asset->url,
  keyBenefits,
  targetAudience,
  description
}
```

**Body text construction:**

Lead magnets don't have a full body for extraction the same way blogs do. Build a rich `bodyText` from available fields:

```ts
const parts = [
  doc.targetAudience ? `Who this is for: ${doc.targetAudience}` : null,
  doc.keyBenefits?.length
    ? `Key benefits:\n${doc.keyBenefits.map((b: string) => `• ${b}`).join("\n")}`
    : null,
  doc.description
    ? portableTextToPlainText(doc.description).slice(0, 1500)
    : null,
].filter(Boolean);

const bodyText = parts.join("\n\n");
```

**Build `SocialPostSource`:**
```ts
{
  type: "lead_magnet",
  id: doc._id,
  slug: doc.slug,
  title: doc.title,
  subtitle: doc.subtitle ?? undefined,
  bodyText,
  category: doc.category ?? undefined,
  imageUrl: doc.coverImageUrl ?? undefined,
  publicUrl: `https://isaacplans.com/en/lead-magnets/${doc.slug}`,
  locale: "en",
}
```

---

### API Route 1: List Sources

**File:** `app/api/admin/social-media-studio/sources/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchSourceList } from "@/lib/social-media-studio/source-fetcher";
import type { SocialStudioResponse } from "@/lib/social-media-studio/types";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q        = searchParams.get("q")        ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const locale   = searchParams.get("locale")   ?? "en";
  const limit    = parseInt(searchParams.get("limit") ?? "30", 10);

  try {
    const data = await fetchSourceList({ q, category, locale, limit });
    return NextResponse.json({ success: true, data } satisfies SocialStudioResponse<typeof data>);
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
```

**Success response shape:**
```json
{
  "success": true,
  "data": {
    "blogPosts": [
      { "_id": "...", "title": "...", "slug": "...", "excerpt": "...", "category": "final-expense", "featuredImageUrl": "https://...", "publishedAt": "..." }
    ],
    "leadMagnets": [
      { "_id": "...", "title": "...", "subtitle": "...", "slug": "...", "category": "aca", "coverImageUrl": "https://...", "publishedAt": "..." }
    ]
  }
}
```

---

### API Route 2: Fetch Source Content

**File:** `app/api/admin/social-media-studio/sources/[type]/[id]/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { fetchBlogPostContent, fetchLeadMagnetContent } from "@/lib/social-media-studio/source-fetcher";
import type { SocialStudioResponse, SocialPostSource } from "@/lib/social-media-studio/types";

export async function GET(
  _req: Request,
  { params }: { params: { type: string; id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { type, id } = params;

  try {
    let source: SocialPostSource;

    if (type === "blog_post") {
      source = await fetchBlogPostContent(id);
    } else if (type === "lead_magnet") {
      source = await fetchLeadMagnetContent(id);
    } else {
      return NextResponse.json({ success: false, error: `Unknown source type: ${type}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: source } satisfies SocialStudioResponse<SocialPostSource>);
  } catch (err) {
    const message = (err as Error).message;
    const status  = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
```

**Success response shape:**
```json
{
  "success": true,
  "data": {
    "type": "blog_post",
    "id": "abc123",
    "slug": "understanding-final-expense-insurance",
    "title": "Understanding Final Expense Insurance",
    "subtitle": "What seniors need to know before buying",
    "bodyText": "Final expense insurance is...",
    "category": "final-expense",
    "imageUrl": "https://cdn.sanity.io/images/...",
    "publicUrl": "https://isaacplans.com/en/blog/understanding-final-expense-insurance",
    "locale": "en"
  }
}
```

---

### File Structure After Phase 2

```
lib/
  social-media-studio/
    types.ts                                  ← Phase 1
    source-fetcher.ts                         ← NEW
app/
  api/
    admin/
      social-media-studio/
        sources/
          route.ts                            ← NEW (list endpoint)
          [type]/
            [id]/
              route.ts                        ← NEW (detail/extract endpoint)
```

---

### New Environment Variables

No new environment variables. Uses the existing read-only Sanity client (same project ID and dataset already configured).

---

### Success Criteria

Phase 2 is complete when:

1. `GET /api/admin/social-media-studio/sources` returns both `blogPosts` and `leadMagnets` arrays — non-empty if content exists in Sanity
2. `GET /api/admin/social-media-studio/sources?q=final+expense` returns only blog posts and lead magnets with "final expense" in the title
3. `GET /api/admin/social-media-studio/sources?category=aca` returns only ACA-category items
4. `GET /api/admin/social-media-studio/sources/blog_post/{id}` returns a fully populated `SocialPostSource` with non-empty `bodyText` (plain text extracted from Portable Text body)
5. `GET /api/admin/social-media-studio/sources/lead_magnet/{id}` returns a fully populated `SocialPostSource` with `keyBenefits` and `targetAudience` incorporated into `bodyText`
6. `publicUrl` is correctly formed on both source types (includes the full domain and locale path)
7. Both routes return 401 for unauthenticated requests
8. An invalid `id` returns 404 with a clear error message (not a 500)
9. `pnpm tsc --noEmit` passes

---

## References

**Files to read before implementing:**
- `lib/social-media-studio/types.ts` — `SocialPostSource`, `BlogPostSummary`, `LeadMagnetSummary`, `SocialStudioResponse` (all types used in this phase)
- `sanity/schemaTypes/postType.ts` — understand exact field names on blog post documents (especially `mainImage`, `body`, `locale`, `slug.current`)
- `sanity/schemaTypes/leadMagnetType.ts` — understand exact field names on lead magnet documents (`coverImage`, `keyBenefits`, `targetAudience`, `description`, `slug.current`)
- `lib/email/portable-text-to-html.ts` — existing Portable Text utility; adapt the block-walking logic for plain text extraction rather than HTML
- `app/api/admin/blog-generator/extract/route.ts` — Clerk auth guard pattern to replicate exactly
- Any existing Sanity read client file (check `lib/sanity/` or `sanity/lib/`) — import the same `client` instance rather than creating a new one
