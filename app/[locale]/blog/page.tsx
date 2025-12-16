import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { BlogCategoryFilter } from "@/components/blog-category-filter";
import { BlogUserAuth } from "@/components/blog-user-auth";
import { BackHome } from "@/components/back-home";

const POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
]|order(publishedAt desc)[0...24]{
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

const FEATURED_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && featured == true
]|order(publishedAt desc)[0...3]{
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

// ISR with 1 hour fallback - on-demand revalidation via webhook is preferred
const options = { 
  next: { 
    revalidate: 3600, // 1 hour fallback
    tags: ['blog-listing'] // Allows granular revalidation
  } 
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "blogPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/blog.png",
  }) as string;
  const alt = t("imageAlt", { default: "Isaac Plans Insurance Blog" });

  const routeKey = "/blog";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const ogLocale = ogLocaleOf(locale);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
  };
}

// Category labels mapping
const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  'aca': { en: 'ACA / Obamacare', es: 'ACA / Obamacare' },
  'short-term-medical': { en: 'Short Term Medical', es: 'Seguro Médico de Corto Plazo' },
  'dental-vision': { en: 'Dental & Vision', es: 'Dental y Visión' },
  'hospital-indemnity': { en: 'Hospital Indemnity', es: 'Indemnización Hospitalaria' },
  'iul': { en: 'IUL', es: 'IUL' },
  'final-expense': { en: 'Final Expense', es: 'Gastos Finales' },
  'cancer-plans': { en: 'Cancer Plans', es: 'Planes de Cáncer' },
  'heart-stroke': { en: 'Heart & Stroke', es: 'Corazón y Derrame' },
  'general': { en: 'General Insurance', es: 'Seguro General' },
  'tips-guides': { en: 'Tips & Guides', es: 'Consejos y Guías' },
  'news': { en: 'Industry News', es: 'Noticias de la Industria' },
};

export default async function BlogPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "blogPage" });
  
  // Fetch featured posts and regular posts
  const [featuredPosts, allPosts] = await Promise.all([
    client.fetch<SanityDocument[]>(FEATURED_POSTS_QUERY, { locale }, options),
    client.fetch<SanityDocument[]>(POSTS_QUERY, { locale }, options),
  ]);

  // Filter out featured posts from all posts to avoid duplicates
  const featuredIds = new Set(featuredPosts.map((p) => p._id));
  const regularPosts = allPosts.filter((p) => !featuredIds.has(p._id));

  // Get unique categories from posts
  const categories = Array.from(
    new Set(allPosts.map((p) => p.category).filter(Boolean))
  ).sort();

  const alternateLocale = locale === "en" ? "es" : "en";
  const alternateText = locale === "en" ? "Leer en español" : "Read in English";

  return (
    <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        {/* Back Home - Top Left */}
        <div className="mb-4">
          <BackHome variant="inline" />
        </div>
        {/* Language Switcher and User Auth - Top */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <Link
            href={`/${alternateLocale}/blog`}
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
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            {alternateText}
          </Link>
          <BlogUserAuth />
        </div>
        
        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
            {t("hero.title")}
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto mb-6">
            {t("hero.description")}
          </p>
          <Link
            href={`/${locale}/blog/categories`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            {locale === "en" ? "Browse Categories" : "Explorar Categorías"}
          </Link>
        </div>
      </div>

      {/* Featured Posts Section */}
      {featuredPosts.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-yellow-500">⭐</span>
            {locale === 'en' ? 'Featured Posts' : 'Publicaciones Destacadas'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {featuredPosts.map((post) => (
              <BlogCard key={post._id} post={post} locale={locale} featured />
            ))}
          </div>
        </section>
      )}

      {/* Category Filter */}
      <BlogCategoryFilter categories={categories} />

      {/* All Posts */}
      {allPosts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-600 dark:text-gray-400 text-lg">{t("empty")}</p>
        </div>
      ) : (
        <section>
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            {locale === 'en' ? 'All Posts' : 'Todas las Publicaciones'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {regularPosts.map((post) => (
              <BlogCard key={post._id} post={post} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// Blog Card Component
function BlogCard({
  post,
  locale,
  featured = false,
}: {
  post: SanityDocument;
  locale: string;
  featured?: boolean;
}) {
  const imageUrl = post.image
    ? urlFor(post.image).width(600).height(400).fit('crop').crop('top').url()
    : null;

  const categoryLabel =
    CATEGORY_LABELS[post.category as string]?.[locale as 'en' | 'es'] ||
    post.category;

  return (
    <Link
      href={`/${locale}/blog/${post.slug.current}`}
      className="group"
    >
      <article className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        {/* Featured Badge */}
        {featured && (
          <div className="absolute top-4 right-4 z-10 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            <span>⭐</span>
            {locale === 'en' ? 'Featured' : 'Destacado'}
          </div>
        )}

        {/* Image */}
        {imageUrl ? (
          <div className="relative w-full h-48 overflow-hidden">
            <Image
              src={imageUrl}
              alt={post.image?.alt || post.title}
              fill
              className="object-cover object-top group-hover:scale-110 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        ) : (
          <div className="relative w-full h-48 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-blue-300 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col p-6">
          {/* Category Badge */}
          {post.category && (
            <span className="inline-block mb-2 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {categoryLabel}
            </span>
          )}

          <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {post.title}
          </h2>

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <time dateTime={post.publishedAt} className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {new Date(post.publishedAt).toLocaleDateString(locale, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
            {post.readingTime && (
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {post.readingTime} {locale === 'en' ? 'min' : 'min'}
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

