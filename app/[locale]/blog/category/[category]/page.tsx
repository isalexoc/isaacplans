import Link from "next/link";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { getBlogCategoryLabel } from "@/lib/blog-category-labels";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BlogPagination } from "@/components/blog-pagination";
import { BlogPostCard } from "@/components/blog-post-card";

const POSTS_PER_PAGE = 12;

const CATEGORY_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == $category
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

const CATEGORY_POSTS_COUNT_QUERY = `count(*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == $category
])`;

// ISR with 1 hour fallback - on-demand revalidation via webhook is preferred
// Category-specific tag allows granular revalidation
const getCategoryOptions = (category: string) => ({
  next: { 
    revalidate: 3600, // 1 hour fallback
    tags: [`blog-category-${category}`, 'blog-listing'] // Allows granular revalidation
  }
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { category, locale } = await params;
  const paramsSearch = await searchParams;
  const currentPage = paramsSearch?.page ? parseInt(paramsSearch.page, 10) : 1;
  
  const categoryLabel = getBlogCategoryLabel(category, locale);

  const baseTitle = `${categoryLabel} Blog Posts | Isaac Plans Insurance`;
  const title = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = `Browse all ${categoryLabel} blog posts and articles from Isaac Plans Insurance.`;

  const baseUrl = `/${locale}/blog/category/${category}`;
  const canonical = currentPage === 1 
    ? withLocalePrefix(locale as SupportedLocale, baseUrl)
    : `${withLocalePrefix(locale as SupportedLocale, baseUrl)}?page=${currentPage}`;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale as SupportedLocale),
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ category: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { category, locale } = await params;
  const paramsSearch = await searchParams;
  const localeTyped = locale as SupportedLocale;
  const categoryLabel = getBlogCategoryLabel(category, localeTyped);

  // Get current page from search params, default to 1
  const currentPage = paramsSearch?.page ? Math.max(1, parseInt(paramsSearch.page, 10)) : 1;
  
  // Calculate pagination offsets
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  const end = start + POSTS_PER_PAGE - 1;
  // Fetch a few extra posts on page 1 to ensure we have 12 after any edge cases
  const fetchEnd = currentPage === 1 && start === 0 ? start + 14 : end; // Fetch 15 posts on page 1

  // Fetch paginated posts and total count
  const [postsResult, totalCountResult] = await Promise.all([
    sanityFetch({
      query: CATEGORY_POSTS_QUERY,
      params: { locale, category, start, end: fetchEnd },
      ...getCategoryOptions(category)
    }),
    sanityFetch({
      query: CATEGORY_POSTS_COUNT_QUERY,
      params: { locale, category },
      ...getCategoryOptions(category)
    }),
  ]);
  
  const allPosts: SanityDocument[] = postsResult.data || [];
  const totalPosts = (totalCountResult.data as number) || 0;
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  
  // Take exactly POSTS_PER_PAGE posts to ensure we always have 12
  const posts = allPosts.slice(0, POSTS_PER_PAGE);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log(`Category Page ${currentPage}: Fetched ${allPosts.length} posts, Displaying ${posts.length} posts, Total: ${totalPosts}, Range: [${start}...${fetchEnd}]`);
  }

  return (
    <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mb-4"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {locale === "en" ? "Back to Blog" : "Volver al Blog"}
        </Link>
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
          {categoryLabel}
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {locale === "en"
            ? `All posts about ${categoryLabel.toLowerCase()}`
            : `Todas las publicaciones sobre ${categoryLabel.toLowerCase()}`}
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {locale === "en"
              ? "No posts found in this category."
              : "No se encontraron publicaciones en esta categoría."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            {totalPosts > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {locale === "en"
                  ? `Showing ${start + 1}-${Math.min(end + 1, totalPosts)} of ${totalPosts} posts`
                  : `Mostrando ${start + 1}-${Math.min(end + 1, totalPosts)} de ${totalPosts} publicaciones`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {posts.map((post) => (
              <BlogPostCard
                key={post._id}
                post={post}
                locale={localeTyped}
              />
            ))}
          </div>
          
          {/* Pagination */}
          <BlogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={`/${locale}/blog/category/${category}`}
            locale={localeTyped}
          />
        </>
      )}
    </main>
  );
}

