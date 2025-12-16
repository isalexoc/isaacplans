import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * On-demand revalidation API route for blog posts
 * 
 * This endpoint should be called by Sanity webhooks when blog posts are:
 * - Created
 * - Updated
 * - Deleted
 * - Published/Unpublished
 * 
 * Usage:
 * POST /api/revalidate/blog
 * Body: { slug?: string, locale?: string, category?: string, type: 'post' | 'listing' | 'category' | 'all' }
 * 
 * Headers:
 * Authorization: Bearer <REVALIDATION_SECRET>
 * 
 * Examples:
 * - Revalidate specific post: { type: 'post', slug: 'my-post', locale: 'en' }
 * - Revalidate blog listing: { type: 'listing', locale: 'en' }
 * - Revalidate category: { type: 'category', category: 'aca', locale: 'en' }
 * - Revalidate everything: { type: 'all' }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const expectedToken = process.env.REVALIDATION_SECRET;
    
    if (!expectedToken) {
      console.error("[REVALIDATE] REVALIDATION_SECRET is not set in environment variables");
      return NextResponse.json(
        { error: "Revalidation secret not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { type, slug, locale, category } = body;

    // Validate required fields based on type
    if (!type) {
      return NextResponse.json(
        { error: "Missing required field: type" },
        { status: 400 }
      );
    }

    const revalidatedPaths: string[] = [];
    const revalidatedTags: string[] = [];

    switch (type) {
      case "post": {
        // Revalidate specific blog post
        if (!slug || !locale) {
          return NextResponse.json(
            { error: "Missing required fields: slug and locale" },
            { status: 400 }
          );
        }

        // Revalidate the post page for both locales (in case of language switching)
        const locales = ["en", "es"];
        for (const loc of locales) {
          const path = `/${loc}/blog/${slug}`;
          revalidatePath(path);
          revalidatedPaths.push(path);
        }

        // Revalidate tags for the post
        revalidateTag(`blog-post-${slug}`);
        revalidateTag(`blog-post-${slug}-${locale}`);
        revalidatedTags.push(`blog-post-${slug}`, `blog-post-${slug}-${locale}`);

        // Also revalidate blog listing and category pages (they show this post)
        for (const loc of locales) {
          revalidatePath(`/${loc}/blog`);
          revalidatedPaths.push(`/${loc}/blog`);
          
          if (category) {
            revalidatePath(`/${loc}/blog/category/${category}`);
            revalidatedPaths.push(`/${loc}/blog/category/${category}`);
          }
        }

        // Revalidate home page (shows blog posts)
        for (const loc of locales) {
          revalidatePath(`/${loc}`);
          revalidatedPaths.push(`/${loc}`);
        }

        // Revalidate sitemap
        revalidatePath("/sitemap.xml");
        revalidatedPaths.push("/sitemap.xml");

        break;
      }

      case "listing": {
        // Revalidate blog listing page
        const locales = locale ? [locale] : ["en", "es"];
        for (const loc of locales) {
          const path = `/${loc}/blog`;
          revalidatePath(path);
          revalidatedPaths.push(path);
        }

        revalidateTag("blog-listing");
        revalidatedTags.push("blog-listing");

        // Also revalidate home page
        for (const loc of locales) {
          revalidatePath(`/${loc}`);
          revalidatedPaths.push(`/${loc}`);
        }

        break;
      }

      case "category": {
        // Revalidate category page
        if (!category) {
          return NextResponse.json(
            { error: "Missing required field: category" },
            { status: 400 }
          );
        }

        const locales = locale ? [locale] : ["en", "es"];
        for (const loc of locales) {
          const path = `/${loc}/blog/category/${category}`;
          revalidatePath(path);
          revalidatedPaths.push(path);
        }

        revalidateTag(`blog-category-${category}`);
        revalidatedTags.push(`blog-category-${category}`);

        // Also revalidate blog listing
        for (const loc of locales) {
          revalidatePath(`/${loc}/blog`);
          revalidatedPaths.push(`/${loc}/blog`);
        }

        break;
      }

      case "all": {
        // Revalidate all blog-related pages
        const locales = ["en", "es"];
        
        // Revalidate all blog listing pages
        for (const loc of locales) {
          revalidatePath(`/${loc}/blog`);
          revalidatedPaths.push(`/${loc}/blog`);
        }

        // Revalidate home pages
        for (const loc of locales) {
          revalidatePath(`/${loc}`);
          revalidatedPaths.push(`/${loc}`);
        }

        // Revalidate sitemap
        revalidatePath("/sitemap.xml");
        revalidatedPaths.push("/sitemap.xml");

        // Revalidate all blog-related tags
        revalidateTag("blog-listing");
        revalidatedTags.push("blog-listing");

        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid type: ${type}. Must be 'post', 'listing', 'category', or 'all'` },
          { status: 400 }
        );
    }

    console.log(`[REVALIDATE] Successfully revalidated:`, {
      type,
      paths: revalidatedPaths,
      tags: revalidatedTags,
    });

    return NextResponse.json({
      revalidated: true,
      type,
      paths: revalidatedPaths,
      tags: revalidatedTags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[REVALIDATE] Error revalidating:", error);
    return NextResponse.json(
      { error: "Error revalidating", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
