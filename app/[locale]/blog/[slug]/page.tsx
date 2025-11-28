import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { urlFor } from "@/sanity/lib/image";
import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/portable-text-components";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { getBlogPostArticleLd, getBlogPostBreadcrumbLd } from "@/lib/seo/jsonld";
import Image from "next/image";
import Script from "next/script";
import BlogCTA from "@/components/blog-cta";
import { BlogSocialActions } from "@/components/blog-social-actions";
import { BlogUserAuth } from "@/components/blog-user-auth";

const POST_QUERY = `*[_type == "post" && slug.current == $slug && locale == $locale][0]{
  _id,
  title,
  slug,
  publishedAt,
  updatedAt,
  image,
  ogImage,
  body,
  locale,
  category,
  excerpt,
  tags,
  author,
  readingTime,
  seo,
  leadCapture,
  relatedPost->{
    slug,
    locale,
    title
  },
  relatedPosts[]->{
    _id,
    title,
    slug,
    image,
    category,
    publishedAt
  }
}`;

// Query to find a post in target locale that references the source slug
const FIND_RELATED_QUERY = `*[
  _type == "post" 
  && locale == $targetLocale
  && relatedPost->slug.current == $slug
  && relatedPost->locale == $sourceLocale
][0]{
  _id,
  title,
  slug,
  publishedAt,
  updatedAt,
  image,
  ogImage,
  body,
  locale,
  category,
  excerpt,
  tags,
  author,
  readingTime,
  seo,
  leadCapture,
  relatedPost->{
    slug,
    locale,
    title
  },
  relatedPosts[]->{
    _id,
    title,
    slug,
    image,
    category,
    publishedAt
  }
}`;

// Query to get posts from the same category
const RELATED_CATEGORY_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == $category
  && slug.current != $currentSlug
]|order(publishedAt desc)[0...3]{
  _id,
  title,
  slug,
  image,
  category,
  publishedAt
}`;

const options = { next: { revalidate: 30 } };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  
  // First, try to find the post with the current slug and locale
  let post = await client.fetch<SanityDocument>(
    POST_QUERY,
    { slug, locale },
    options
  );

  // If not found, try to find the related post in the alternate locale
  if (!post) {
    const alternateLocale = locale === "en" ? "es" : "en";
    post = await client.fetch<SanityDocument>(
      FIND_RELATED_QUERY,
      { 
        slug, 
        sourceLocale: alternateLocale,
        targetLocale: locale 
      },
      options
    );
  }

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  // Use SEO fields if available, otherwise fallback to defaults
  const metaTitle = post.seo?.metaTitle || post.title;
  const metaDescription =
    post.seo?.metaDescription ||
    post.excerpt ||
    (() => {
      // Extract from body as fallback
      if (post.body && Array.isArray(post.body)) {
        const firstBlock = post.body.find(
          (block: any) => block._type === "block" && block.children
        );
        if (firstBlock?.children?.[0]?.text) {
          return firstBlock.children[0].text.substring(0, 160) + "...";
        }
      }
      return `Read ${post.title} on Isaac Plans Insurance blog`;
    })();

  // Use metaTitle directly if it's custom, otherwise add site name
  const title = post.seo?.metaTitle || `${post.title} | Isaac Plans Insurance`;
  const imageUrl = post.ogImage
    ? urlFor(post.ogImage).width(1200).height(630).url()
    : post.image
    ? urlFor(post.image).width(1200).height(630).url()
    : "https://www.isaacplans.com/images/blog.png";

  const canonical = post.seo?.canonicalUrl 
    ? (post.seo.canonicalUrl.startsWith("http") 
        ? post.seo.canonicalUrl 
        : `https://www.isaacplans.com${post.seo.canonicalUrl}`)
    : `https://www.isaacplans.com/${locale}/blog/${slug}`;
  const ogLocale = ogLocaleOf(locale as SupportedLocale);

  // Build keywords array
  const keywords = [
    post.seo?.focusKeyword,
    ...(post.seo?.keywords || []),
    ...(post.tags || []),
  ]
    .filter(Boolean)
    .join(", ");

  // Get alternate language URL if related post exists
  const alternateLocale = locale === "en" ? "es" : "en";
  const alternateUrl = post.relatedPost?.slug?.current
    ? `https://www.isaacplans.com/${alternateLocale}/blog/${post.relatedPost.slug.current}`
    : undefined;

  return {
    title,
    description: metaDescription,
    keywords: keywords || undefined,
    authors: [{ name: post.author || "Isaac Orraiz" }],
    alternates: {
      canonical,
      languages: alternateUrl
        ? {
            [locale]: canonical,
            [alternateLocale]: alternateUrl,
          }
        : undefined,
    },
    openGraph: {
      title,
      description: metaDescription,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: alternateUrl ? (locale === "en" ? "es_ES" : "en_US") : undefined,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      authors: [post.author || "Isaac Orraiz"],
      section: post.category,
      tags: post.tags || [],
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.image?.alt || post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [{ url: imageUrl, alt: post.image?.alt || post.title }],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  const t = await getTranslations({ locale, namespace: "blogPage" });
  
  // First, try to find the post with the current slug and locale
  let post = await client.fetch<SanityDocument>(
    POST_QUERY,
    { slug, locale },
    options
  );

  // If not found, try to find the related post in the alternate locale
  // This handles the case where user switched language and the slug is different
  if (!post) {
    const alternateLocale = locale === "en" ? "es" : "en";
    post = await client.fetch<SanityDocument>(
      FIND_RELATED_QUERY,
      { 
        slug, 
        sourceLocale: alternateLocale,
        targetLocale: locale 
      },
      options
    );
    
    // If we found the related post, redirect to it
    if (post && post.slug?.current) {
      const { redirect } = await import("next/navigation");
      redirect(`/${locale}/blog/${post.slug.current}`);
    }
  }

  // If still not found, show 404
  if (!post) {
    notFound();
  }

  const imageUrl = post.image
    ? urlFor(post.image).width(1200).height(630).fit('crop').crop('top').url()
    : null;

  const ogImageUrlForDisplay = post.ogImage
    ? urlFor(post.ogImage).width(1200).height(630).fit('crop').crop('top').url()
    : imageUrl;

  // Determine if there's a related post in another language
  const relatedPost = post.relatedPost;
  const alternateLocale = locale === "en" ? "es" : "en";
  const alternateText = locale === "en" ? "Leer en español" : "Read in English";

  // Category labels
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

  const categoryLabel =
    post.category &&
    (CATEGORY_LABELS[post.category as string]?.[locale as "en" | "es"] ||
      post.category);

  // Split body into sections for middle CTA placement
  const bodyArray = post.body || [];
  const middleIndex = Math.floor(bodyArray.length / 2);
  const firstHalf = bodyArray.slice(0, middleIndex);
  const secondHalf = bodyArray.slice(middleIndex);

  const showTopCTA =
    post.leadCapture?.enableCTA && post.leadCapture?.ctaPosition === "top";
  const showMiddleCTA =
    post.leadCapture?.enableCTA && post.leadCapture?.ctaPosition === "middle";
  const showBottomCTA =
    post.leadCapture?.enableCTA && post.leadCapture?.ctaPosition === "bottom";

  // Get related posts from same category if we don't have enough related posts
  let relatedPosts = post.relatedPosts || [];
  if (!Array.isArray(relatedPosts)) {
    relatedPosts = [];
  }

  // If we have less than 3 related posts, fetch from same category
  if (relatedPosts.length < 3 && post.category) {
    const categoryPosts = await client.fetch<SanityDocument[]>(
      RELATED_CATEGORY_POSTS_QUERY,
      {
        locale,
        category: post.category,
        currentSlug: post.slug.current,
      },
      options
    );

    // Merge and deduplicate
    const existingIds = new Set(relatedPosts.map((p: any) => p._id));
    const additionalPosts = categoryPosts
      .filter((p) => !existingIds.has(p._id))
      .slice(0, 3 - relatedPosts.length);
    
    relatedPosts = [...relatedPosts, ...additionalPosts];
  }

  // Prepare metadata for JSON-LD
  const metaDescription =
    post.seo?.metaDescription ||
    post.excerpt ||
    (() => {
      if (post.body && Array.isArray(post.body)) {
        const firstBlock = post.body.find(
          (block: any) => block._type === "block" && block.children
        );
        if (firstBlock?.children?.[0]?.text) {
          return firstBlock.children[0].text.substring(0, 160) + "...";
        }
      }
      return `Read ${post.title} on Isaac Plans Insurance blog`;
    })();

  const canonicalUrl = post.seo?.canonicalUrl 
    ? (post.seo.canonicalUrl.startsWith("http") 
        ? post.seo.canonicalUrl 
        : `https://www.isaacplans.com${post.seo.canonicalUrl}`)
    : `https://www.isaacplans.com/${locale}/blog/${post.slug.current}`;

  const ogImageUrlForJsonLd = post.ogImage
    ? urlFor(post.ogImage).width(1200).height(630).fit('crop').crop('top').url()
    : imageUrl;

  // Prepare JSON-LD structured data
  const articleLd = getBlogPostArticleLd({
    title: post.title,
    description: metaDescription,
    slug: post.slug.current,
    locale,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    author: post.author || "Isaac Orraiz",
    image: ogImageUrlForJsonLd || undefined,
    category: post.category,
    tags: post.tags,
    canonicalUrl: canonicalUrl,
  });

  const breadcrumbLd = getBlogPostBreadcrumbLd(
    locale,
    post.slug.current,
    post.title,
    post.category,
    categoryLabel
  );

  return (
    <>
      {/* JSON-LD Structured Data */}
      <Script
        id="article-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleLd),
        }}
      />
      <Script
        id="breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbLd),
        }}
      />

      <article className="container mx-auto min-h-screen max-w-4xl p-4 sm:p-8">
      {/* Language switcher and User Auth */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        {relatedPost && relatedPost.slug ? (
          <Link
            href={`/${alternateLocale}/blog/${relatedPost.slug.current}`}
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
        ) : (
          <div></div>
        )}
        <BlogUserAuth />
      </div>

      {/* Back to Blog Button - Top */}
      <div className="mb-6">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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

      {/* Top CTA */}
      {showTopCTA && post.leadCapture && (
        <BlogCTA
          ctaType={post.leadCapture.ctaType}
          ctaText={post.leadCapture.ctaText}
          ctaLink={post.leadCapture.ctaLink}
          position="top"
          leadMagnet={post.leadCapture.leadMagnet}
          postTitle={post.title}
          postSlug={post.slug.current}
          postCategory={post.category}
        />
      )}

      <header className="mb-8">
        {/* Category Badge */}
        {categoryLabel && (
          <Link
            href={`/${locale}/blog/category/${post.category}`}
            className="inline-block mb-4 px-3 py-1 text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            {categoryLabel}
          </Link>
        )}

        <h1 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900 dark:text-white">
          {post.title}
        </h1>

        {/* Meta information */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
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
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.readingTime && (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {post.readingTime} {locale === "en" ? "min read" : "min lectura"}
            </span>
          )}
        </div>

        {/* Author Section */}
        {post.author && (
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_40,h_40,c_fill,g_face,r_max/isaacpic_c8kca5_3_hz35qm"
                alt={post.author}
                width={40}
                height={40}
                className="rounded-full"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                {locale === "en" ? "Author" : "Autor"}
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {post.author}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {locale === "en" ? "Insurance Specialist" : "Especialista en Seguros"}
              </p>
            </div>
          </div>
        )}

      {/* Social Actions */}
      <BlogSocialActions
        postId={post._id}
        postTitle={post.title}
        postSlug={post.slug.current}
        postUrl={`https://www.isaacplans.com/${locale}/blog/${post.slug.current}`}
      />
      </header>

      {/* Featured Image */}
      {ogImageUrlForDisplay && (
        <div className="mb-8 relative w-full h-[200px] sm:h-[300px] lg:h-[400px] overflow-hidden rounded-lg shadow-lg">
          <Image
            src={ogImageUrlForDisplay}
            alt={post.image?.alt || post.title}
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
            priority
          />
        </div>
      )}

      {/* Content - First Half */}
      <div className="max-w-none">
        {firstHalf.length > 0 && (
          <PortableText
            value={firstHalf}
            components={portableTextComponents}
          />
        )}
      </div>

      {/* Middle CTA */}
      {showMiddleCTA && post.leadCapture && (
        <BlogCTA
          ctaType={post.leadCapture.ctaType}
          ctaText={post.leadCapture.ctaText}
          ctaLink={post.leadCapture.ctaLink}
          position="middle"
          leadMagnet={post.leadCapture.leadMagnet}
          postTitle={post.title}
          postSlug={post.slug.current}
          postCategory={post.category}
        />
      )}

      {/* Content - Second Half */}
      <div className="max-w-none">
        {secondHalf.length > 0 && (
          <PortableText
            value={secondHalf}
            components={portableTextComponents}
          />
        )}
      </div>

      {/* Bottom CTA */}
      {showBottomCTA && post.leadCapture && (
        <BlogCTA
          ctaType={post.leadCapture.ctaType}
          ctaText={post.leadCapture.ctaText}
          ctaLink={post.leadCapture.ctaLink}
          position="bottom"
          leadMagnet={post.leadCapture.leadMagnet}
          postTitle={post.title}
          postSlug={post.slug.current}
          postCategory={post.category}
        />
      )}

      {/* Social Actions - End of Post */}
      <BlogSocialActions
        postId={post._id}
        postTitle={post.title}
        postSlug={post.slug.current}
        postUrl={`https://www.isaacplans.com/${locale}/blog/${post.slug.current}`}
      />

      {/* Related Posts */}
      {relatedPosts && relatedPosts.length > 0 && (
        <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            {locale === "en" ? "Related Posts" : "Publicaciones Relacionadas"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPosts.slice(0, 3).map((related: any) => {
                const relatedImageUrl = related.image
                  ? urlFor(related.image).width(600).height(400).fit('crop').crop('top').url()
                  : null;
                return (
                  <Link
                    key={related._id}
                    href={`/${locale}/blog/${related.slug.current}`}
                    className="group"
                  >
                    <article className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                      {relatedImageUrl && (
                        <div className="relative w-full h-48 overflow-hidden">
                          <Image
                            src={relatedImageUrl}
                            alt={related.title}
                            fill
                            className="object-cover object-top group-hover:scale-110 transition-transform duration-300"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        </div>
                      )}
                      <div className="flex-1 flex flex-col p-6">
                        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                          {related.title}
                        </h3>
                        <time
                          dateTime={related.publishedAt}
                          className="text-sm text-gray-500 dark:text-gray-400 mt-auto"
                        >
                          {new Date(related.publishedAt).toLocaleDateString(
                            locale,
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </time>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

      {/* Back to Blog Button - Bottom */}
      <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
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
    </article>
    </>
  );
}

