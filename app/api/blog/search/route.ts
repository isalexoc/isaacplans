import { NextRequest, NextResponse } from "next/server";
import { client } from "@/sanity/lib/client";
import type { SupportedLocale } from "@/lib/seo/i18n";

const POSTS_PER_PAGE = 12;

// Type for search results
interface SearchResult {
  _id: string;
  title: string;
  slug: { current: string };
  publishedAt: string;
  image?: any;
  locale: string;
  category?: string;
  excerpt?: string;
  featured?: boolean;
  tags?: string[];
  readingTime?: number;
  author?: any;
}

// Sanity GROQ query for searching posts
// Uses match() for full-text search across title, excerpt, and tags
const SEARCH_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && (
    title match $searchTerm
    || excerpt match $searchTerm
    || count(tags[@ match $searchTerm]) > 0
  )
]|order(publishedAt desc)[$start...$end]{
  _id, 
  title, 
  slug, 
  publishedAt, 
  image, 
  locale,
  category,
  excerpt,
  featured,
  tags,
  readingTime,
  author
}`;

const SEARCH_POSTS_COUNT_QUERY = `count(*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && (
    title match $searchTerm
    || excerpt match $searchTerm
    || count(tags[@ match $searchTerm]) > 0
  )
])`;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");
    const locale = searchParams.get("locale") as SupportedLocale;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || String(POSTS_PER_PAGE), 10);

    // Validate inputs
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    if (!locale || !["en", "es"].includes(locale)) {
      return NextResponse.json(
        { error: "Valid locale is required" },
        { status: 400 }
      );
    }

    // Sanitize search term - remove special characters that might break GROQ
    // GROQ match() is case-insensitive and supports partial matches
    const searchTerm = `*${query.trim().replace(/[^\w\s]/g, "")}*`;

    // Calculate pagination
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    // Fetch search results and count
    const [posts, total] = await Promise.all([
      client.fetch<SearchResult[]>(
        SEARCH_POSTS_QUERY,
        { locale, searchTerm, start, end },
        { next: { revalidate: 3600, tags: ["blog-search"] } }
      ),
      client.fetch<number>(
        SEARCH_POSTS_COUNT_QUERY,
        { locale, searchTerm },
        { next: { revalidate: 3600, tags: ["blog-search"] } }
      ),
    ]);

    const postsArray = posts || [];
    const totalCount = total || 0;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      posts: postsArray,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasMore: page < totalPages,
      },
      query,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
