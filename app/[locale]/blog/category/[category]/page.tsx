import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { getBlogCategoryLabel } from "@/lib/blog-category-labels";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { BlogPagination } from "@/components/blog-pagination";
import { BlogPostCard } from "@/components/blog-post-card";
import BlogCategoryCTA from "@/components/blog-category-cta";
import {
  getBlogCategoryCollectionPageLd,
  getBlogCategoryBreadcrumbLd,
} from "@/lib/seo/jsonld";

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
  const altLocale = locale === "en" ? "es" : "en";

  const baseTitle = locale === "en"
    ? `${categoryLabel} Insurance Articles | Isaac Plans`
    : `Artículos de ${categoryLabel} | Isaac Plans`;
  const title = currentPage > 1 ? `${baseTitle} - Page ${currentPage}` : baseTitle;
  const description = locale === "en"
    ? `Expert ${categoryLabel} insurance articles from licensed agent Isaac Orraiz. Learn what you need to know and get a free quote.`
    : `Artículos expertos sobre ${categoryLabel} del agente licenciado Isaac Orraiz. Aprende lo que necesitas saber y obtén una cotización gratuita.`;
  const keywords = locale === "en"
    ? `${categoryLabel.toLowerCase()}, ${categoryLabel.toLowerCase()} insurance, insurance articles, Isaac Plans`
    : `${categoryLabel.toLowerCase()}, seguro ${categoryLabel.toLowerCase()}, artículos de seguros, Isaac Plans`;

  const baseUrl = `/${locale}/blog/category/${category}`;
  const altBaseUrl = `/${altLocale}/blog/category/${category}`;
  const canonical = currentPage === 1
    ? withLocalePrefix(locale as SupportedLocale, baseUrl)
    : `${withLocalePrefix(locale as SupportedLocale, baseUrl)}?page=${currentPage}`;
  const altCanonical = withLocalePrefix(altLocale as SupportedLocale, altBaseUrl);
  const ogImage = cloudinaryOgImageUrl("https://www.isaacplans.com/images/blog.png");

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: {
        [locale]: canonical,
        [altLocale]: altCanonical,
        "x-default": withLocalePrefix("en", `/${locale === "en" ? locale : "en"}/blog/category/${category}`),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale as SupportedLocale),
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${categoryLabel} insurance articles` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImage, alt: `${categoryLabel} insurance articles` }],
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

  const description = locale === "en"
    ? `Expert ${categoryLabel} insurance articles from licensed agent Isaac Orraiz. Learn what you need to know and get a free quote.`
    : `Artículos expertos sobre ${categoryLabel} del agente licenciado Isaac Orraiz. Aprende lo que necesitas saber y obtén una cotización gratuita.`;

  const collectionLd = getBlogCategoryCollectionPageLd({
    locale,
    category,
    categoryLabel,
    description,
    posts: posts.map((p) => ({ title: p.title, slug: p.slug.current })),
    currentPage,
  });

  const breadcrumbLd = getBlogCategoryBreadcrumbLd(locale, category, categoryLabel);

  return (
    <>
    <Script
      id="category-collection-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
    />
    <Script
      id="category-breadcrumb-jsonld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
    />
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

      {/* Category CTA — converts readers into leads */}
      <div className="mb-10">
        <BlogCategoryCTA category={category} />
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
    </>
  );
}

