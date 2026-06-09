import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { BlogPostCard } from "@/components/blog-post-card";
import { getIsaacPersonLd } from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { getLicensedStateCount } from "@/lib/licensed-states";
import Script from "next/script";

const AUTHOR_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
]|order(publishedAt desc)[0...24]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime, featured
}`;

const AUTHOR_POSTS_COUNT_QUERY = `count(*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
])`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const altLocale = locale === "en" ? "es" : "en";
  const stateCount = await getLicensedStateCount();

  const title = locale === "en"
    ? "Isaac Orraiz — Licensed Insurance Agent | Isaac Plans Blog"
    : "Isaac Orraiz — Agente de Seguros Licenciado | Blog Isaac Plans";
  const description = locale === "en"
    ? `Isaac Orraiz is a licensed insurance agent and Certified Health Care Reform Specialist. Licensed in ${stateCount} states, 10+ years helping families find the right coverage.`
    : `Isaac Orraiz es un agente de seguros licenciado y Especialista Certificado en Reforma de Salud. Licenciado en ${stateCount} estados, 10+ años ayudando a familias a encontrar la cobertura adecuada.`;

  const canonical = withLocalePrefix(locale, `/${locale}/blog/author`);
  const altCanonical = withLocalePrefix(altLocale as SupportedLocale, `/${altLocale}/blog/author`);
  const ogImage = cloudinaryOgImageUrl(
    "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_face/isaacpic_c8kca5.jpg"
  );

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        [locale]: canonical,
        [altLocale]: altCanonical,
        "x-default": withLocalePrefix("en", "/en/blog/author"),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocaleOf(locale),
      alternateLocale: locale === "en" ? ["es_ES"] : ["en_US"],
      type: "profile",
      images: [{ url: ogImage, width: 1200, height: 630, alt: "Isaac Orraiz — Insurance Agent" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImage, alt: "Isaac Orraiz" }],
    },
  };
}

export default async function AuthorPage() {
  const locale = (await getLocale()) as SupportedLocale;

  const [postsResult, countResult, stateCount] = await Promise.all([
    sanityFetch({ query: AUTHOR_POSTS_QUERY, params: { locale } }),
    sanityFetch({ query: AUTHOR_POSTS_COUNT_QUERY, params: { locale } }),
    getLicensedStateCount(),
  ]);

  const posts: SanityDocument[] = postsResult.data || [];
  const totalPosts = (countResult.data as number) || 0;

  const personLd = getIsaacPersonLd(locale);

  const credentials = locale === "en"
    ? ["Licensed Insurance Agent", "Certified Health Care Reform Specialist", `Licensed in ${stateCount} States`, "10+ Years Experience"]
    : ["Agente de Seguros Licenciado", "Especialista Certificado en Reforma de Salud", `Licenciado en ${stateCount} Estados`, "10+ Años de Experiencia"];

  const bio = locale === "en"
    ? "Isaac Orraiz is a licensed insurance agent specializing in ACA Marketplace, Final Expense, Dental & Vision, Hospital Indemnity, and IUL. His mission is to cut through the jargon and help families find plans that actually fit their lives and budgets — in English and Spanish."
    : "Isaac Orraiz es un agente de seguros licenciado especializado en ACA, Gastos Finales, Dental y Visión, Indemnización Hospitalaria e IUL. Su misión es eliminar el lenguaje técnico y ayudar a las familias a encontrar planes que realmente se adapten a sus vidas y presupuestos, en inglés y español.";

  return (
    <>
      <Script
        id="author-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />

      <main className="container mx-auto min-h-screen max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <div className="mb-8">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {locale === "en" ? "Back to Blog" : "Volver al Blog"}
          </Link>
        </div>

        {/* Author card */}
        <div className="mb-14 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start">
          <Image
            src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_128,h_128,c_fill,g_face,r_max/isaacpic_c8kca5_3_hz35qm"
            alt="Isaac Orraiz"
            width={128}
            height={128}
            className="rounded-full ring-4 ring-blue-100 dark:ring-blue-900 shrink-0"
            priority
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
              {locale === "en" ? "About the Author" : "Sobre el Autor"}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Isaac Orraiz
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed text-sm sm:text-base">
              {bio}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {credentials.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300"
                >
                  <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {c}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {locale === "en"
                ? `${totalPosts} articles published`
                : `${totalPosts} artículos publicados`}
            </p>
          </div>
        </div>

        {/* Posts grid */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          {locale === "en" ? "All Articles" : "Todos los Artículos"}
        </h2>
        {posts.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            {locale === "en" ? "No articles yet." : "Aún no hay artículos."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {posts.map((post) => (
              <BlogPostCard key={post._id} post={post} locale={locale} titleAs="h3" />
            ))}
          </div>
        )}

        {totalPosts > 24 && (
          <p className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {locale === "en"
              ? `Showing 24 of ${totalPosts} articles.`
              : `Mostrando 24 de ${totalPosts} artículos.`}
            {" "}
            <Link href={`/${locale}/blog`} className="text-blue-600 dark:text-blue-400 hover:underline">
              {locale === "en" ? "Browse all →" : "Ver todos →"}
            </Link>
          </p>
        )}
      </main>
    </>
  );
}
