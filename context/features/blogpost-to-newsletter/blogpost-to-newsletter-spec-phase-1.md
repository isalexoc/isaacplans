# Blog Post to Newsletter — Phase 1 Spec

## Full Feature Overview (All Phases)

Allow an authenticated admin to send any published blog post as a newsletter email directly from Sanity Studio. English subscribers receive the English version of the post; Spanish subscribers receive the Spanish version. The system uses the existing Neon `newsletterSubscribers` table and the existing Nodemailer SMTP setup — no new external services required.

**Planned phases:**
- **Phase 1 (this doc):** Backend — Sanity schema field, portable text → HTML renderer, email template function, subscriber-count endpoint, and the main send-post API route
- **Phase 2:** Sanity Studio document action — custom button in the Studio toolbar, confirmation dialog with live subscriber counts, and write-back of send timestamp

---

## Phase 1: Backend — Email Template & Send API

### Goal

Build the complete server-side infrastructure for sending a blog post as a newsletter. This phase produces a working API route that can be tested with `curl` or a REST client before the Studio UI (Phase 2) is wired up. No Studio changes yet — just the data layer, email rendering, and HTTP endpoints.

### Architecture Notes

**Post ↔ language model:** Each blog post in Sanity is a separate document with a `locale` field (`"en"` or `"es"`). The English and Spanish versions are linked via the `relatedPost` reference field. When the send-post route receives a post ID, it must:
1. Fetch the post and its `relatedPost` from Sanity
2. Map each document to its locale
3. Send the correct language email to the matching subscriber segment

**Subscriber table:** `newsletterSubscribers` in Neon already has `email`, `locale` (`"en"` | `"es"`), and `status`. Only rows where `status = 'confirmed'` receive the email.

**Duplicate prevention:** The Sanity post schema will gain a `newsletterSentAt` datetime field. The send-post route checks this field and returns an error if already set — unless the caller passes `{ force: true }`.

**Email sending:** Uses the existing `createTransporter()` pattern from `lib/email/notifications.ts`. Sends are sequential per locale batch — no parallelism — to stay within SMTP rate limits on shared hosting.

---

### What to Build

1. `newsletterSentAt` field added to `sanity/schemaTypes/postType.ts`
2. `lib/email/portable-text-to-html.ts` — converts Sanity portable text blocks to email-safe HTML
3. `lib/email/newsletter-post.ts` — bilingual email template + `sendNewsletterPost()` orchestrator
4. `GET /api/newsletter/subscriber-counts` — returns confirmed subscriber counts by locale (used by the Studio dialog in Phase 2)
5. `POST /api/newsletter/send-post` — main send endpoint, Clerk-authenticated

---

### 1. Sanity Schema: `newsletterSentAt` Field

Add to `sanity/schemaTypes/postType.ts` inside the `// ========== PUBLISHING ==========` section, after the `updatedAt` field:

```ts
defineField({
  name: 'newsletterSentAt',
  type: 'datetime',
  title: 'Newsletter Sent At',
  description: 'Set automatically when this post is sent as a newsletter. Do not edit manually.',
  readOnly: true,
}),
```

This field is **readOnly** in the Studio — it is written only by the API route using the Sanity write client. It surfaces in the Studio form so editors know whether/when the post was sent.

---

### 2. Portable Text → Email-Safe HTML

**Install:** `pnpm add @portabletext/to-html`

**File:** `lib/email/portable-text-to-html.ts`

Convert Sanity portable text blocks (the `body` field array) to inline-styled HTML suitable for email clients. Email clients strip `<style>` tags and CSS classes — all styles must be inline.

**Supported block types to handle:**
- `block` with styles: `normal` (paragraph), `h1`, `h2`, `h3`, `h4`, `blockquote`
- Marks: `strong`, `em`, `code`, `link` (with `href`)
- `image` blocks: render as `<img>` with `src` from Sanity CDN URL, `alt` text, max-width 100%

**TypeScript contract:**

```ts
export function portableTextToEmailHtml(blocks: unknown[]): string
```

**Style reference** (inline, matches existing email aesthetic in `notifications.ts`):
- Paragraphs: `margin: 0 0 16px 0; font-size: 16px; color: #374151; line-height: 1.7;`
- H2: `margin: 24px 0 12px 0; font-size: 22px; color: #111827; font-weight: 700;`
- H3: `margin: 20px 0 8px 0; font-size: 18px; color: #111827; font-weight: 600;`
- Blockquote: `border-left: 3px solid #0077B6; padding: 12px 16px; margin: 16px 0; background: #f0f9ff; color: #374151;`
- Links: `color: #0077B6; text-decoration: underline;`
- Code: `background: #f3f4f6; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 14px;`
- Images: `max-width: 100%; height: auto; border-radius: 6px; margin: 16px 0; display: block;`

For Sanity image blocks, build the URL with: `https://cdn.sanity.io/images/${projectId}/production/${assetRef.replace('image-', '').replace(/-(\w+)$/, '.$1')}`

Where `projectId` is `process.env.NEXT_PUBLIC_SANITY_PROJECT_ID`.

---

### 3. Email Template Function

**File:** `lib/email/newsletter-post.ts`

**Interfaces:**

```ts
export interface NewsletterPostData {
  subscriberEmail: string;
  unsubscribeToken: string;
  locale: 'en' | 'es';
  post: {
    title: string;
    slug: string;
    excerpt?: string;
    body: unknown[];          // portable text blocks
    imageUrl?: string;        // Sanity CDN URL for featured image
    imageAlt?: string;
    publishedAt: string;      // ISO date string
    category: string;
  };
}

export interface SendNewsletterPostResult {
  enSent: number;
  esSent: number;
  enFailed: number;
  esFailed: number;
  errors: Array<{ email: string; error: string }>;
}
```

**Function:** `buildNewsletterPostEmail(data: NewsletterPostData): { subject: string; html: string; text: string }`

Builds the full email for one subscriber. The layout (inline-styled HTML, consistent with existing emails in `notifications.ts`):

```
┌────────────────────────────────────────────┐
│  Isaac Plans Insurance  (header bar, blue) │
├────────────────────────────────────────────┤
│  [Featured image — full width]             │
│  Category label (small caps, brand color)  │
│  H1: Post title                            │
│  Excerpt paragraph                         │
│  ─────────────────────────────────────────│
│  [Rendered body content via portableText]  │
│  ─────────────────────────────────────────│
│  [CTA button: "Read on isaacplans.com"]    │
├────────────────────────────────────────────┤
│  Footer: unsubscribe link · privacy        │
└────────────────────────────────────────────┘
```

Subject line format:
- EN: `"[Newsletter] {post title}"`
- ES: `"[Boletín] {post title}"`

CTA button link: `https://www.isaacplans.com/{locale}/blog/{slug}`

Unsubscribe link: `https://www.isaacplans.com/api/newsletter/unsubscribe?token={unsubscribeToken}`

**Function:** `sendNewsletterPost(postId: string, force?: boolean): Promise<SendNewsletterPostResult>`

This is the orchestrator called by the API route:

1. Fetch the post from Sanity: `title`, `slug`, `excerpt`, `body`, `image`, `publishedAt`, `category`, `locale`, `newsletterSentAt`, `relatedPost->{ title, slug, excerpt, body, image, publishedAt, category, locale }`
2. If `newsletterSentAt` is set and `force !== true`, throw `Error("already_sent")`
3. Map both documents into a `{ en: PostData | null, es: PostData | null }` structure using their `locale` field
4. Query DB: `SELECT email, unsubscribeToken FROM newsletterSubscribers WHERE status = 'confirmed' AND locale = 'en'`
5. Query DB: same for `locale = 'es'`
6. For each EN subscriber: build + send email using the EN post data; collect errors
7. For each ES subscriber: build + send email using the ES post data; collect errors (skip locale if no ES post exists)
8. After sends complete, update Sanity: `client.patch(postId).set({ newsletterSentAt: new Date().toISOString() }).commit()`  
   Use `createClient` with `token: process.env.SANITY_API_WRITE_TOKEN`
9. Return `SendNewsletterPostResult`

Use the same `createTransporter()` pattern from `notifications.ts` — one fresh transporter per batch, not per email. Wrap each `sendMail()` call in try/catch; failed sends accumulate in `errors` but do not abort the batch.

---

### 4. Subscriber Count Endpoint

**File:** `app/api/newsletter/subscriber-counts/route.ts`

**Method:** GET  
**Auth:** Clerk `auth()` — returns 401 if not signed in  

Query: `SELECT locale, COUNT(*) FROM newsletterSubscribers WHERE status = 'confirmed' GROUP BY locale`

**Success response (200):**
```json
{
  "success": true,
  "counts": { "en": 142, "es": 87 }
}
```

This endpoint is consumed by the Studio document action in Phase 2 to show the user how many subscribers will receive the email before confirming.

---

### 5. Send-Post API Route

**File:** `app/api/newsletter/send-post/route.ts`

**Method:** POST  
**Auth:** Clerk `auth()` — returns 401 if not signed in  

**Request body:**
```json
{ "postId": "sanity-document-id", "force": false }
```

**Success response (200):**
```json
{
  "success": true,
  "result": {
    "enSent": 142,
    "esSent": 87,
    "enFailed": 0,
    "esFailed": 1,
    "errors": [{ "email": "bad@example.com", "error": "Invalid address" }]
  }
}
```

**Error responses:**
```json
{ "success": false, "error": "already_sent", "sentAt": "2026-06-05T14:00:00.000Z" }
{ "success": false, "error": "Post not found in Sanity" }
{ "success": false, "error": "Post must be published before sending" }
```

Guard: If the fetched post has `status !== 'published'`, return 400 with `"Post must be published before sending"`.

---

### TypeScript Contracts Summary

All types for this feature live in `lib/email/newsletter-post.ts` and are imported by the API routes.

---

### File Structure After Phase 1

```
sanity/
  schemaTypes/
    postType.ts                          ← add newsletterSentAt field

lib/
  email/
    portable-text-to-html.ts            ← NEW: portable text → email HTML
    newsletter-post.ts                  ← NEW: template builder + sendNewsletterPost()
    notifications.ts                    ← unchanged (existing confirmation/welcome emails)

app/
  api/
    newsletter/
      subscriber-counts/
        route.ts                        ← NEW: GET — confirmed counts by locale
      send-post/
        route.ts                        ← NEW: POST — send post to subscribers
```

---

### New Dependency

```
pnpm add @portabletext/to-html
```

---

### Success Criteria

Phase 1 is complete when:

- `GET /api/newsletter/subscriber-counts` returns `{ en: N, es: M }` for confirmed subscribers (returns 401 if unauthenticated)
- `POST /api/newsletter/send-post` with a valid published post ID sends emails to all confirmed subscribers, segmented by locale
- English subscribers receive the English post content; Spanish subscribers receive the Spanish post content
- If a post has no `relatedPost`, only the locale that exists is sent — no 500 error
- After a successful send, the post's `newsletterSentAt` field is set in Sanity
- Calling the route a second time returns `{ success: false, error: "already_sent", sentAt: "..." }` unless `force: true`
- Calling the route on a non-published post returns `{ success: false, error: "Post must be published before sending" }`
- Route returns 401 if Clerk session is absent
- Individual send failures are captured in `errors[]` and do not abort the batch

---

## References

**Existing files to read before implementing:**
- `lib/db/schema.ts` — `newsletterSubscribers` table definition (lines 113–132)
- `lib/email/notifications.ts` — `createTransporter()` and existing email HTML style patterns to match
- `sanity/schemaTypes/postType.ts` — full post schema; add `newsletterSentAt` in the PUBLISHING section
- `lib/sanity/queries/` — existing GROQ query patterns to follow
- `app/api/newsletter/subscribe/route.ts` — example of Clerk auth + DB query pattern in this project

**External docs:**
- `@portabletext/to-html` npm: https://www.npmjs.com/package/@portabletext/to-html
- Sanity client patch API: https://www.sanity.io/docs/js-client#patch--mutate
- Sanity image URL construction: https://www.sanity.io/docs/image-url
