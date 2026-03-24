import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BlogPagination } from "@/components/blog-pagination";
import { BlogSearch } from "@/components/blog-search";
import { BlogPostCard } from "@/components/blog-post-card";

const POSTS_PER_PAGE = 12;

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

// ISR with 1 hour fallback - on-demand revalidation via webhook is preferred
const searchOptions = { 
  next: { 
    revalidate: 3600, // 1 hour fallback
    tags: ['blog-search'] // Allows granular revalidation
  } 
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const params = await searchParams;
  const query = params?.q || "";
  const currentPage = params?.page ? parseInt(params.page, 10) : 1;

  const baseTitle = query
    ? `Search Results for "${query}" | Isaac Plans Insurance`
    : "Search Blog | Isaac Plans Insurance";
  const title =
    currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = query
    ? `Search results for "${query}" in our blog posts about insurance, ACA, IUL, and more.`
    : "Search our blog posts about insurance, ACA, IUL, and more.";

  const baseUrl = `/${locale}/blog/search`;
  const searchUrl = query ? `${baseUrl}?q=${encodeURIComponent(query)}` : baseUrl;
  const canonical =
    currentPage === 1
      ? withLocalePrefix(locale, searchUrl)
      : `${withLocalePrefix(locale, searchUrl)}&page=${currentPage}`;

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
      locale: ogLocaleOf(locale),
      type: "website",
    },
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const locale = (await getLocale()) as SupportedLocale;
  const params = await searchParams;
  const query = params?.q?.trim() || "";
  const currentPage = params?.page ? Math.max(1, parseInt(params.page, 10)) : 1;

  // If no query, show empty state
  if (!query || query.length < 2) {
    return (
      <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-4">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
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
        </div>
        <div className="text-center py-16">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            {locale === "en" ? "Search Blog Posts" : "Buscar Publicaciones"}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {locale === "en"
              ? "Enter a search term to find blog posts."
              : "Ingresa un término de búsqueda para encontrar publicaciones."}
          </p>
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            {locale === "en" ? "Back to Blog" : "Volver al Blog"}
          </Link>
        </div>
      </main>
    );
  }

  // Sanitize search term for GROQ
  const searchTerm = `*${query.replace(/[^\w\s]/g, "")}*`;

  // Calculate pagination offsets
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  const end = start + POSTS_PER_PAGE - 1;
  // Fetch a few extra posts on page 1 to ensure we have 12 after any edge cases
  const fetchEnd = currentPage === 1 && start === 0 ? start + 14 : end; // Fetch 15 posts on page 1

  // Fetch search results and total count
  const [postsResult, totalCountResult] = await Promise.all([
    sanityFetch({
      query: SEARCH_POSTS_QUERY,
      params: { locale, searchTerm, start, end: fetchEnd },
      ...searchOptions,
    }),
    sanityFetch({
      query: SEARCH_POSTS_COUNT_QUERY,
      params: { locale, searchTerm },
      ...searchOptions,
    }),
  ]);

  const allPosts: SanityDocument[] = postsResult.data || [];
  const totalPosts = (totalCountResult.data as number) || 0;
  const totalPages = Math.ceil(totalPosts / POSTS_PER_PAGE);
  
  // Take exactly POSTS_PER_PAGE posts to ensure we always have 12
  const posts = allPosts.slice(0, POSTS_PER_PAGE);

  // Debug: Log to verify we're getting the right number of posts
  if (process.env.NODE_ENV === 'development') {
    console.log(`Search: Page ${currentPage}, Fetched ${allPosts.length} posts, Displaying ${posts.length} posts, Total: ${totalPosts}, Range: [${start}...${fetchEnd}]`);
  }

  return (
    <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
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
      </div>

      {/* Search Bar */}
      <div className="mb-6 flex justify-center">
        <BlogSearch locale={locale} />
      </div>

      <div className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
          {locale === "en" ? "Search Results" : "Resultados de Búsqueda"}
        </h1>
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {locale === "en" ? (
            <>
              {totalPosts > 0 ? (
                <>
                  Found <strong>{totalPosts}</strong> result{totalPosts !== 1 ? "s" : ""} for{" "}
                  <strong>&quot;{query}&quot;</strong>
                </>
              ) : (
                <>
                  No results found for <strong>&quot;{query}&quot;</strong>
                </>
              )}
            </>
          ) : (
            <>
              {totalPosts > 0 ? (
                <>
                  Se encontraron <strong>{totalPosts}</strong> resultado{totalPosts !== 1 ? "s" : ""} para{" "}
                  <strong>&quot;{query}&quot;</strong>
                </>
              ) : (
                <>
                  No se encontraron resultados para <strong>&quot;{query}&quot;</strong>
                </>
              )}
            </>
          )}
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-6">
            {locale === "en"
              ? "Try searching with different keywords or browse our categories."
              : "Intenta buscar con diferentes palabras clave o explora nuestras categorías."}
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href={`/${locale}/blog`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
              {locale === "en" ? "Browse All Posts" : "Ver Todas las Publicaciones"}
            </Link>
            <Link
              href={`/${locale}/blog/categories`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-semibold rounded-lg transition-colors"
            >
              {locale === "en" ? "Browse Categories" : "Explorar Categorías"}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            {totalPosts > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {locale === "en"
                  ? `Showing ${start + 1}-${Math.min(start + posts.length, totalPosts)} of ${totalPosts} results`
                  : `Mostrando ${start + 1}-${Math.min(start + posts.length, totalPosts)} de ${totalPosts} resultados`}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {posts.map((post) => (
              <BlogPostCard key={post._id} post={post} locale={locale} />
            ))}
          </div>

          {/* Pagination */}
          <BlogPagination
            currentPage={currentPage}
            totalPages={totalPages}
            baseUrl={`/${locale}/blog/search?q=${encodeURIComponent(query)}`}
            locale={locale}
          />
        </>
      )}
    </main>
  );
}
