import Link from "next/link";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { urlFor } from "@/sanity/lib/image";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const CATEGORY_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == $category
]|order(publishedAt desc){
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
// Category-specific tag allows granular revalidation
const getCategoryOptions = (category: string) => ({
  next: { 
    revalidate: 3600, // 1 hour fallback
    tags: [`blog-category-${category}`, 'blog-listing'] // Allows granular revalidation
  }
});

// Category labels mapping
const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  aca: { en: "ACA / Obamacare", es: "ACA / Obamacare" },
  "short-term-medical": {
    en: "Short Term Medical",
    es: "Seguro Médico de Corto Plazo",
  },
  "dental-vision": { en: "Dental & Vision", es: "Dental y Visión" },
  "hospital-indemnity": {
    en: "Hospital Indemnity",
    es: "Indemnización Hospitalaria",
  },
  iul: { en: "IUL", es: "IUL" },
  "final-expense": { en: "Final Expense", es: "Gastos Finales" },
  "cancer-plans": { en: "Cancer Plans", es: "Planes de Cáncer" },
  "heart-stroke": { en: "Heart & Stroke", es: "Corazón y Derrame" },
  general: { en: "General Insurance", es: "Seguro General" },
  "tips-guides": { en: "Tips & Guides", es: "Consejos y Guías" },
  news: { en: "Industry News", es: "Noticias de la Industria" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; locale: string }>;
}): Promise<Metadata> {
  const { category, locale } = await params;
  const categoryLabel =
    CATEGORY_LABELS[category]?.[locale as "en" | "es"] || category;

  const title = `${categoryLabel} Blog Posts | Isaac Plans Insurance`;
  const description = `Browse all ${categoryLabel} blog posts and articles from Isaac Plans Insurance.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale as SupportedLocale),
      type: "website",
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string; locale: string }>;
}) {
  const { category, locale } = await params;
  const localeTyped = locale as SupportedLocale;
  const categoryLabel =
    CATEGORY_LABELS[category]?.[localeTyped] || category;

  const postsResult = await sanityFetch({
    query: CATEGORY_POSTS_QUERY,
    params: { locale, category },
    ...getCategoryOptions(category)
  });
  const posts: SanityDocument[] = postsResult.data || [];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {posts.map((post) => {
            const imageUrl = post.image
              ? urlFor(post.image).width(600).height(400).url()
              : null;

            return (
              <Link
                key={post._id}
                href={`/${locale}/blog/${post.slug.current}`}
                className="group"
              >
                <article className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                  {imageUrl ? (
                    <div className="relative w-full h-48 overflow-hidden">
                      <Image
                        src={imageUrl}
                        alt={post.image?.alt || post.title}
                        fill
                        className="object-cover object-top group-hover:scale-110 transition-transform duration-300"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
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

                  <div className="flex-1 flex flex-col p-6">
                    <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
                      <time dateTime={post.publishedAt}>
                        {new Date(post.publishedAt).toLocaleDateString(locale, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </time>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

