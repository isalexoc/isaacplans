import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { type SupportedLocale } from "@/lib/seo/i18n";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const LATEST_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
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
    tags: ['blog-listing', 'home-blog-posts'] // Allows granular revalidation
  } 
};

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

export default async function HomeBlogPosts() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "HomePage" });

  // Try to get featured posts first, fallback to latest posts
  const featuredPosts = await client.fetch<SanityDocument[]>(
    FEATURED_POSTS_QUERY,
    { locale },
    options
  );

  const posts = featuredPosts.length >= 3
    ? featuredPosts.slice(0, 3)
    : await client.fetch<SanityDocument[]>(
        LATEST_POSTS_QUERY,
        { locale },
        options
      ).then((latest) => {
        // If we have some featured posts but less than 3, combine with latest
        if (featuredPosts.length > 0 && featuredPosts.length < 3) {
          const featuredIds = new Set(featuredPosts.map((p) => p._id));
          const additional = latest
            .filter((p) => !featuredIds.has(p._id))
            .slice(0, 3 - featuredPosts.length);
          return [...featuredPosts, ...additional];
        }
        return latest.slice(0, 3);
      });

  // Don't render if no posts
  if (posts.length === 0) {
    return null;
  }

  const sectionTitle = t("blogSection.title", {
    default: locale === "en" ? "Latest Articles" : "Últimos Artículos",
  });
  const sectionDescription = t("blogSection.description", {
    default:
      locale === "en"
        ? "Stay informed with our latest insurance insights and tips"
        : "Mantente informado con nuestros últimos consejos e información sobre seguros",
  });
  const viewAllText = t("blogSection.viewAll", {
    default: locale === "en" ? "View All Posts" : "Ver Todas las Publicaciones",
  });

  return (
    <section className="w-full bg-gray-50 dark:bg-gray-900 py-16 lg:py-24">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {sectionTitle}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {sectionDescription}
          </p>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 mb-10">
          {posts.map((post) => (
            <BlogPostCard key={post._id} post={post} locale={locale} />
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center">
          <Button
            asChild
            size="lg"
            className="bg-[hsl(var(--custom))] hover:bg-blue-600 text-white hover:text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Link href={`/${locale}/blog`} className="inline-flex items-center gap-2 text-white hover:text-white">
              {viewAllText}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// Blog Post Card Component
function BlogPostCard({
  post,
  locale,
}: {
  post: SanityDocument;
  locale: string;
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
      className="group block h-full"
    >
      <article className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
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

          <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
            {post.title}
          </h3>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
              {post.excerpt}
            </p>
          )}

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

