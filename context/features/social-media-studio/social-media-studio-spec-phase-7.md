# Social Media Content Studio — Phase 7 Spec

## Context

Phases 1–6 built the complete pipeline: data model, source API, AI copy, AI images, video scripts, and the admin UI wizard.

**Phase 7 (this doc):** Sanity Publish + Content History — save generated social post packages to Sanity CMS for history tracking, and add a content history page at `/admin/social-media-studio/history` that shows all past generated packages in a simple list/calendar view. This completes the Social Media Content Studio feature.

---

## Phase 7: Sanity Publish + Content History

### Goal

Build two things:

1. **Publish route** — `POST /api/admin/social-media-studio/publish` that saves the complete generated package (`SocialPostSource` + `SocialPostCopy[]` + `SocialCreativeImages` + optional `VideoScript`) as a `socialPost` document in Sanity CMS. This is the route called by the "Save to Sanity" button in Phase 6's Export step.

2. **History page** — `app/[locale]/admin/social-media-studio/history/page.tsx` — a simple list view showing all saved `socialPost` documents from Sanity, paginated, filterable by source type and date. Lets Isaac review what has been generated and find past copy when needed.

### What to Build

1. **`lib/social-media-studio/sanity-publisher.ts`** — Sanity write client + document builder + publish function
2. **`app/api/admin/social-media-studio/publish/route.ts`** — Clerk-authenticated POST route
3. **`app/[locale]/admin/social-media-studio/history/page.tsx`** — content history list (Server Component)

---

### Service: `lib/social-media-studio/sanity-publisher.ts`

#### Sanity write client

```ts
import { createClient } from "@sanity/client";

function getWriteClient() {
  return createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
    apiVersion: "2024-01-01",
    token:      process.env.SANITY_API_WRITE_TOKEN,
    useCdn:     false,
  });
}
```

Replicate this exactly from `lib/lead-magnet-generator/sanity-publisher.ts` — the pattern is identical.

#### Slug generation

```ts
async function generateUniqueSlug(client: ReturnType<typeof getWriteClient>, title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);

  // Fetch all existing socialPost slugs
  const existing: string[] = await client.fetch(
    `*[_type == "socialPost" && defined(slug.current)].slug.current`
  );

  const existingSet = new Set(existing);
  if (!existingSet.has(base)) return base;

  let counter = 2;
  while (existingSet.has(`${base}-${counter}`)) counter++;
  return `${base}-${counter}`;
}
```

#### Main publish function

```ts
import type {
  SocialPostPublishRequest,
  PublishedSocialPost,
} from "./types";

export async function publishSocialPost(
  req: SocialPostPublishRequest
): Promise<PublishedSocialPost> {
  const client = getWriteClient();
  const slug   = await generateUniqueSlug(client, req.source.title);
  const now    = new Date().toISOString();

  // Map SocialPostCopy[] to Sanity array format
  const generatedCopies = req.copies.map((copy) => ({
    _type:          "object",
    _key:           `${copy.platform}_${copy.locale}`,
    platform:       copy.platform,
    locale:         copy.locale,
    hook:           copy.hook,
    body:           copy.body,
    cta:            copy.cta,
    hashtags:       copy.hashtags,
    fullPost:       copy.fullPost,
    characterCount: copy.characterCount,
  }));

  // Build the videoScript sub-object (undefined if not provided)
  const videoScript = req.videoScript
    ? {
        duration:               req.videoScript.duration,
        hookScript:             req.videoScript.hookScript,
        fullScript:             req.videoScript.fullScript,
        onScreenText:           req.videoScript.onScreenTextSuggestions,
        brollSuggestions:       req.videoScript.brollSuggestions,
        voiceoverTips:          req.videoScript.voiceoverTips,
        suggestedCaption:       req.videoScript.suggestedCaption,
      }
    : undefined;

  const doc: Record<string, unknown> & { _type: string } = {
    _type:           "socialPost",
    sourceType:      req.source.type,
    sourceId:        req.source.id ?? null,
    sourceTitle:     req.source.title,
    sourceSlug:      req.source.slug ?? null,
    sourceUrl:       req.source.publicUrl ?? null,
    sourceImageUrl:  req.source.imageUrl ?? null,
    sourceCategory:  req.source.category ?? null,
    generatedCopies,
    squareImageUrl:  req.images.square,
    verticalImageUrl: req.images.vertical,
    imageHeadline:   req.images.headline,
    ...(videoScript ? { videoScript } : {}),
    status:          req.status,
    tags:            req.tags ?? [],
    createdAt:       now,
    updatedAt:       now,
  };

  const created = await client.create(doc);

  return {
    sanityDocumentId: created._id,
    slug,
  };
}
```

---

### API Route: Publish

**File:** `app/api/admin/social-media-studio/publish/route.ts`

```ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { publishSocialPost } from "@/lib/social-media-studio/sanity-publisher";
import type {
  SocialPostPublishRequest,
  PublishedSocialPost,
  SocialStudioResponse,
} from "@/lib/social-media-studio/types";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body: SocialPostPublishRequest = await req.json();

  if (!body.source?.title) {
    return NextResponse.json({ success: false, error: "source.title is required" }, { status: 400 });
  }
  if (!body.copies?.length) {
    return NextResponse.json({ success: false, error: "copies array is required and must not be empty" }, { status: 400 });
  }

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: "SANITY_API_WRITE_TOKEN is not configured" }, { status: 400 });
  }

  try {
    const result = await publishSocialPost(body);
    const response: SocialStudioResponse<PublishedSocialPost> = {
      success: true,
      data:    result,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[social-media-studio/publish] Error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
```

**Request body:**
```json
{
  "source": {
    "type": "blog_post",
    "id": "abc123",
    "title": "Understanding Final Expense Insurance",
    "slug": "understanding-final-expense-insurance",
    "category": "final-expense",
    "imageUrl": "https://cdn.sanity.io/...",
    "publicUrl": "https://isaacplans.com/en/blog/understanding-final-expense-insurance"
  },
  "copies": [{ "platform": "facebook", "locale": "en", ... }, ...],
  "images": {
    "square": "https://res.cloudinary.com/...",
    "vertical": "https://res.cloudinary.com/...",
    "headline": "Understanding Final Expense Insurance",
    "sourceImageUrl": "https://cdn.sanity.io/...",
    "generatedByAI": false
  },
  "videoScript": { ... },
  "status": "draft",
  "tags": ["final-expense", "week-24"]
}
```

**Success response:**
```json
{
  "success": true,
  "data": {
    "sanityDocumentId": "xyz789",
    "slug": "understanding-final-expense-insurance"
  }
}
```

---

### History Page

**File:** `app/[locale]/admin/social-media-studio/history/page.tsx`

This is a **Server Component** (no `"use client"`). It fetches data at request time from Sanity using the read-only client.

**Route:** `/en/admin/social-media-studio/history`

#### GROQ query

```groq
*[_type == "socialPost"] | order(createdAt desc) [0...50] {
  _id,
  sourceType,
  sourceTitle,
  sourceCategory,
  status,
  tags,
  createdAt,
  "platforms": generatedCopies[].platform,
  "locales": generatedCopies[].locale,
  squareImageUrl,
}
```

#### Page UI

```tsx
import { client } from "@/lib/sanity/client"; // or wherever the read-only client is
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SocialHistoryPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const posts = await client.fetch(HISTORY_QUERY);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content History</h1>
          <p className="text-gray-500 text-sm">{posts.length} packages generated</p>
        </div>
        <a href="/en/admin/social-media-studio" className="...">
          + Generate New Post
        </a>
      </div>

      {/* Filter bar */}
      {/* Simple client-side filter chips for sourceType and status */}

      {/* Results table */}
      <div className="space-y-3">
        {posts.map((post) => (
          <div key={post._id} className="border rounded-lg p-4 flex items-center gap-4">
            {post.squareImageUrl && (
              <img
                src={post.squareImageUrl + "?w=64&h=64&fit=crop"}
                alt=""
                className="w-16 h-16 rounded object-cover flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{post.sourceTitle}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 capitalize">{post.sourceType?.replace("_", " ")}</span>
                {post.sourceCategory && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {post.sourceCategory}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded ${post.status === "published" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  {post.status}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {/* Unique platforms generated */}
              {[...new Set(post.platforms as string[])].map((p) => (
                <span key={p} className="bg-gray-100 px-2 py-0.5 rounded capitalize">
                  {p.replace("_", " ")}
                </span>
              ))}
            </div>
            <a
              href={`https://www.sanity.io/manage/project/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/dataset/production/document/${post._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex-shrink-0"
            >
              View in Studio →
            </a>
          </div>
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No posts generated yet.</p>
          <a href="/en/admin/social-media-studio" className="text-blue-600 hover:underline mt-2 inline-block">
            Generate your first post →
          </a>
        </div>
      )}
    </div>
  );
}
```

---

### Navigation: Link History Page from the Studio

In `app/[locale]/admin/social-media-studio/page.tsx` (Phase 6), add a link to the history page in the page header:

```tsx
<header>
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">Social Media Content Studio</h1>
      <p className="text-sm text-gray-500">Generate a complete post package from any blog post or guide.</p>
    </div>
    <a href={`/${locale}/admin/social-media-studio/history`} className="text-sm text-blue-600 hover:underline">
      View History →
    </a>
  </div>
</header>
```

---

### File Structure After Phase 7 (Complete Feature)

```
lib/
  social-media-studio/
    types.ts                ← Phase 1
    source-fetcher.ts       ← Phase 2
    prompts.ts              ← Phase 3 + Phase 5 additions
    copy-generator.ts       ← Phase 3
    image-generator.ts      ← Phase 4
    script-generator.ts     ← Phase 5
    sanity-publisher.ts     ← NEW (Phase 7)
sanity/
  schemaTypes/
    socialPostType.ts       ← Phase 1
app/
  [locale]/
    admin/
      social-media-studio/
        page.tsx            ← Phase 6 (wizard)
        history/
          page.tsx          ← NEW (Phase 7)
  api/
    admin/
      social-media-studio/
        sources/
          route.ts                    ← Phase 2
          [type]/[id]/route.ts        ← Phase 2
        generate-copy/route.ts        ← Phase 3
        generate-images/route.ts      ← Phase 4
        generate-video-script/route.ts ← Phase 5
        publish/route.ts              ← NEW (Phase 7)
```

---

### No New Environment Variables

All required env vars were established in previous phases:
- `SANITY_API_WRITE_TOKEN` — write access to Sanity (used by lead magnet publisher; same token)
- `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` — already configured

---

### Success Criteria

Phase 7 is complete when:

1. `POST /api/admin/social-media-studio/publish` creates a real `socialPost` document in Sanity Studio — verify by opening Studio and confirming the document appears in the "Social Media Posts" list
2. The saved document has all `generatedCopies` entries (10 items: 5 platforms × 2 locales)
3. `squareImageUrl` and `verticalImageUrl` are stored correctly on the saved document
4. `videoScript` object is saved when provided; absent when not provided
5. `/en/admin/social-media-studio/history` renders a list of all saved posts with source title, type badge, status, and date
6. "View in Studio →" link opens the correct Sanity document
7. "+ Generate New Post" link returns to the wizard page
8. The publish route returns 401 for unauthenticated requests
9. The history page redirects unauthenticated users to `/sign-in`
10. `pnpm tsc --noEmit` passes
11. `pnpm build` passes with no new errors — this is the final phase

---

## References

**Files to read before implementing:**
- `lib/lead-magnet-generator/sanity-publisher.ts` — the primary reference: `getWriteClient()`, `generateUniqueSlug()`, `client.create()` with `Record<string, unknown> & { _type: string }` typing, non-fatal image upload pattern
- `lib/social-media-studio/types.ts` — `SocialPostPublishRequest`, `PublishedSocialPost`, `SocialStudioResponse`
- `sanity/schemaTypes/socialPostType.ts` — exact field names to use when building the Sanity document object (must match schema exactly)
- `app/[locale]/admin/lead-magnet-generator/page.tsx` — the "Save to Sanity" submit handler pattern to replicate in Phase 6's Export step when calling this new route
- Any existing Sanity read client (check `lib/sanity/client.ts` or equivalent) — import for the history page query
