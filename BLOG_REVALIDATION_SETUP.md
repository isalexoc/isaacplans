# Blog Revalidation Strategy

This document explains the revalidation strategy for the blog implementation and how to set up automatic revalidation when content changes in Sanity.

## Overview

The blog uses a **hybrid revalidation strategy** combining:
1. **On-demand revalidation** (preferred) - Immediate updates when content changes
2. **ISR with time-based fallback** - 1 hour cache as backup

## Revalidation API

An on-demand revalidation API is available at `/api/revalidate/blog` that can be called when blog posts are created, updated, or deleted in Sanity.

### API Endpoint

**POST** `/api/revalidate/blog`

**Headers:**
```
Authorization: Bearer <REVALIDATION_SECRET>
```

**Request Body Examples:**

1. **Revalidate a specific post:**
```json
{
  "type": "post",
  "slug": "my-blog-post",
  "locale": "en",
  "category": "aca"
}
```

2. **Revalidate blog listing:**
```json
{
  "type": "listing",
  "locale": "en"
}
```

3. **Revalidate a category page:**
```json
{
  "type": "category",
  "category": "aca",
  "locale": "en"
}
```

4. **Revalidate everything:**
```json
{
  "type": "all"
}
```

### What Gets Revalidated

When a post is revalidated, the following paths are automatically updated:
- The post page itself (`/en/blog/[slug]` and `/es/blog/[slug]`)
- Blog listing page (`/en/blog` and `/es/blog`)
- Category page (if category is provided)
- Home page (shows blog posts)
- Sitemap (`/sitemap.xml`)

## Setting Up Sanity Webhook

To automatically revalidate when content changes in Sanity, set up a webhook:

### Step 1: Get Your Revalidation Secret

Add to your `.env.local` (or environment variables in production):

```bash
REVALIDATION_SECRET=your-secret-token-here
```

Generate a strong random secret:
```bash
# Generate a secure random token
openssl rand -base64 32
```

### Step 2: Configure Sanity Webhook

1. Go to your Sanity project dashboard: https://www.sanity.io/manage
2. Navigate to **API** → **Webhooks**
3. Click **Create webhook**
4. Configure the webhook:

   **Name:** `Blog Revalidation`
   
   **URL:** `https://www.isaacplans.com/api/revalidate/blog`
   
   **Dataset:** Your dataset name (e.g., `production`)
   
   **Trigger on:**
   - ✅ Create
   - ✅ Update
   - ✅ Delete
   
   **Filter:** 
   ```
   _type == "post"
   ```
   
   **Projection:** (optional, but recommended)
   ```json
   {
     "slug": slug.current,
     "locale": locale,
     "category": category,
     "status": status
   }
   ```
   
   **HTTP method:** `POST`
   
   **API version:** `v2021-03-25` or later
   
   **Secret:** Leave empty (we use Bearer token auth instead)
   
   **HTTP Headers:** 
   ```
   Authorization: Bearer your-secret-token-here
   Content-Type: application/json
   ```

### Step 3: Create Webhook Handler (Optional - Advanced)

If you need more control, you can create a custom webhook handler that processes Sanity webhook payloads. Here's an example:

```typescript
// app/api/webhooks/sanity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.REVALIDATION_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Sanity webhook payload structure
    const { _type, slug, locale, category, status } = body;

    if (_type !== "post") {
      return NextResponse.json({ message: "Not a post" }, { status: 200 });
    }

    // Only revalidate published posts
    if (status !== "published") {
      return NextResponse.json({ message: "Post not published" }, { status: 200 });
    }

    // Call the revalidation API
    const revalidateResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.isaacplans.com'}/api/revalidate/blog`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.REVALIDATION_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "post",
          slug: slug?.current,
          locale,
          category,
        }),
      }
    );

    if (!revalidateResponse.ok) {
      throw new Error("Revalidation failed");
    }

    return NextResponse.json({ 
      revalidated: true,
      slug: slug?.current,
      locale 
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
```

## Manual Revalidation

You can manually trigger revalidation using curl:

```bash
# Revalidate a specific post
curl -X POST https://www.isaacplans.com/api/revalidate/blog \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "post",
    "slug": "my-post-slug",
    "locale": "en",
    "category": "aca"
  }'

# Revalidate everything
curl -X POST https://www.isaacplans.com/api/revalidate/blog \
  -H "Authorization: Bearer YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type": "all"}'
```

## Cache Tags

The implementation uses Next.js cache tags for granular revalidation:

- `blog-listing` - Blog listing pages
- `blog-post-{slug}` - Specific post (all locales)
- `blog-post-{slug}-{locale}` - Specific post in specific locale
- `blog-category-{category}` - Category pages
- `home-blog-posts` - Home page blog section

## ISR Fallback

If on-demand revalidation fails or isn't configured, pages will automatically revalidate after:
- **1 hour (3600 seconds)** for blog pages
- **1 hour** for sitemap

This ensures content is never stale for more than 1 hour, even without webhooks.

## Testing

1. **Test the revalidation API:**
   ```bash
   curl -X POST http://localhost:3000/api/revalidate/blog \
     -H "Authorization: Bearer your-secret" \
     -H "Content-Type: application/json" \
     -d '{"type": "post", "slug": "test-post", "locale": "en"}'
   ```

2. **Test Sanity webhook:**
   - Create or update a post in Sanity
   - Check your deployment logs for revalidation messages
   - Verify the page updates immediately

## Troubleshooting

### Revalidation not working

1. **Check environment variable:**
   - Ensure `REVALIDATION_SECRET` is set in production
   - Verify the secret matches in Sanity webhook configuration

2. **Check webhook logs:**
   - Sanity dashboard → API → Webhooks → View logs
   - Look for failed requests or errors

3. **Check Next.js logs:**
   - Look for `[REVALIDATE]` log messages
   - Verify paths are being revalidated

4. **Verify webhook URL:**
   - Ensure the URL is correct (production vs staging)
   - Check if the endpoint is accessible

### Content still stale

- Wait up to 1 hour for ISR fallback
- Manually trigger revalidation via API
- Clear Next.js cache in production (if using custom cache)

## Best Practices

1. **Always use on-demand revalidation** for immediate updates
2. **Keep ISR fallback** as safety net (1 hour is reasonable)
3. **Use cache tags** for granular control
4. **Monitor webhook logs** regularly
5. **Test revalidation** after deploying changes

## Next.js 15.2.4 Compatibility

This implementation uses:
- ✅ `revalidatePath()` - For path-based revalidation
- ✅ `revalidateTag()` - For tag-based revalidation
- ✅ ISR with `next: { revalidate, tags }` - For time-based and tag-based caching
- ✅ Server Actions compatible (if you add them later)

All features are compatible with Next.js 15.2.4 and follow current best practices.
