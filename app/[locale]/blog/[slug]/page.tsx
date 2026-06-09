import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { urlFor, sanityOgImageUrl } from "@/sanity/lib/image";
import { PortableText } from "@portabletext/react";
import { portableTextComponents } from "@/components/portable-text-components";
import {
  ogLocaleOf,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { getBlogPostArticleLd, getBlogPostBreadcrumbLd, getBlogPostFaqLd } from "@/lib/seo/jsonld";
import Image from "next/image";
import Script from "next/script";
import BlogCTA from "@/components/blog-cta";
import { BlogSocialActions } from "@/components/blog-social-actions";
import { BlogComments } from "@/components/blog-comments";
import { BlogUserAuth } from "@/components/blog-user-auth";
import BlogCategoryCTA from "@/components/blog-category-cta";
import { BlogSocialLinks } from "@/components/blog-social-links";
import { BlogNewsletter } from "@/components/blog-newsletter";
import BlogPostTracker from "@/components/blog-post-tracker";
import { BlogModalOverride } from "@/components/blog-modal-override";
import { cloudinaryFetchedFeaturedHeroUrl, cloudinaryOgImageUrl, cloudinaryFetchedImageUrl } from "@/lib/blog-featured-image";
import { getLicensedStateCount } from "@/lib/licensed-states";
import { BlogScrollFloatingCTA } from "@/components/blog-scroll-floating-cta";
import { client } from "@/sanity/lib/client";

const ALL_POST_SLUGS_QUERY = `*[_type == "post" && status == "published" && defined(slug.current) && defined(locale)]{
  "slug": slug.current,
  locale
}`;

export async function generateStaticParams() {
  const posts = await client.fetch<{ slug: string; locale: string }[]>(
    ALL_POST_SLUGS_QUERY,
    {},
    { next: { revalidate: false } }
  );
  return posts.map(({ slug, locale }) => ({ slug, locale }));
}

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
  faqs,
  relatedPost->{ slug, locale, title },
  relatedPosts[]->{ _id, title, slug, image, category, publishedAt },
  "autoRelatedPosts": *[
    _type == "post"
    && defined(slug.current)
    && locale == ^.locale
    && status == "published"
    && category == ^.category
    && slug.current != ^.slug.current
  ]|order(publishedAt desc)[0...3]{
    _id, title, slug, image, category, publishedAt
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
  faqs,
  relatedPost->{ slug, locale, title },
  relatedPosts[]->{ _id, title, slug, image, category, publishedAt },
  "autoRelatedPosts": *[
    _type == "post"
    && defined(slug.current)
    && locale == ^.locale
    && status == "published"
    && category == ^.category
    && slug.current != ^.slug.current
  ]|order(publishedAt desc)[0...3]{
    _id, title, slug, image, category, publishedAt
  }
}`;


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  
  // Use post-specific tags for granular revalidation
  const postOptions = { 
    next: { 
      revalidate: 3600, // 1 hour fallback
      tags: [`blog-post-${slug}`, `blog-post-${slug}-${locale}`, 'blog-listing']
    } 
  };
  
  // First, try to find the post with the current slug and locale
  let postResult = await sanityFetch({
    query: POST_QUERY,
    params: { slug, locale },
    ...postOptions
  });
  let post: SanityDocument | null = postResult.data || null;

  // If not found, try to find the related post in the alternate locale
  if (!post) {
    const alternateLocale = locale === "en" ? "es" : "en";
    const relatedResult = await sanityFetch({
      query: FIND_RELATED_QUERY,
      params: { 
        slug, 
        sourceLocale: alternateLocale,
        targetLocale: locale 
      },
      ...postOptions
    });
    post = relatedResult.data || null;
  }

  if (!post) {
    return {
      title: "Post Not Found",
    };
  }

  // Use SEO fields if available, otherwise fallback to defaults
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
    ? sanityOgImageUrl(post.ogImage)
    : post.image
    ? sanityOgImageUrl(post.image)
    : cloudinaryOgImageUrl("https://www.isaacplans.com/images/blog.png");

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
  
  // Use post-specific tags for granular revalidation
  const postOptions = { 
    next: { 
      revalidate: 3600, // 1 hour fallback
      tags: [`blog-post-${slug}`, `blog-post-${slug}-${locale}`, 'blog-listing']
    } 
  };
  
  // First, try to find the post with the current slug and locale
  let postResult = await sanityFetch({
    query: POST_QUERY,
    params: { slug, locale },
    ...postOptions
  });
  let post: SanityDocument | null = postResult.data || null;

  // If not found, try to find the related post in the alternate locale
  // This handles the case where user switched language and the slug is different
  if (!post) {
    const alternateLocale = locale === "en" ? "es" : "en";
    const relatedResult = await sanityFetch({
      query: FIND_RELATED_QUERY,
      params: { 
        slug, 
        sourceLocale: alternateLocale,
        targetLocale: locale 
      },
      ...postOptions
    });
    post = relatedResult.data || null;
    
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

  const stateCount = await getLicensedStateCount();

  // Auto-calculate reading time if not set manually (~200 wpm)
  const calcReadingTime = (body: any[]): number => {
    if (!Array.isArray(body)) return 1;
    const words = body
      .filter((b) => b._type === "block" && Array.isArray(b.children))
      .flatMap((b) => b.children)
      .filter((c: any) => c._type === "span" && c.text)
      .map((c: any) => c.text as string)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  };
  const readingTime: number = post.readingTime || calcReadingTime(post.body);

  /** Sanity source URL (high ceiling), then Cloudinary fetch → 16:9 + auto gradient gutters */
  const featuredImageSource = post.ogImage || post.image;
  const sanityFeaturedSrc = featuredImageSource
    ? urlFor(featuredImageSource).width(2000).fit("max").url()
    : null;
  const featuredImageUrl = sanityFeaturedSrc
    ? cloudinaryFetchedFeaturedHeroUrl(sanityFeaturedSrc) ?? sanityFeaturedSrc
    : null;

  // Determine if there's a related post in another language
  const relatedPost = post.relatedPost;
  const alternateLocale = locale === "en" ? "es" : "en";
  const alternateText = locale === "en" ? "Leer en español" : "Read in English";

  // Category labels
  const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
    aca: { en: "ACA / Obamacare", es: "ACA / Obamacare" },
    "temporary-health-insurance": {
      en: "Temporary health insurance",
      es: "Seguro médico temporal",
    },
    "short-term-medical": {
      en: "Temporary health insurance",
      es: "Seguro médico temporal",
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

  // Merge explicit relatedPosts with auto-filled category posts, deduplicated
  const explicitRelated: SanityDocument[] = Array.isArray(post.relatedPosts) ? post.relatedPosts : [];
  const autoRelated: SanityDocument[] = Array.isArray(post.autoRelatedPosts) ? post.autoRelatedPosts : [];
  const seenIds = new Set(explicitRelated.map((p: any) => p._id));
  const relatedPosts = [
    ...explicitRelated,
    ...autoRelated.filter((p) => !seenIds.has(p._id)),
  ].slice(0, 3);

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

  // Generate multiple image sizes for structured data (Google recommends 16x9, 4x3, 1x1)
  // Minimum 50K pixels: 1200x675 (16x9) = 810K, 1200x900 (4x3) = 1.08M, 1200x1200 (1x1) = 1.44M
  const imageSource = post.ogImage || post.image;
  let imageUrls: string[] | undefined = undefined;
  
  if (imageSource) {
    imageUrls = [
      // 16x9 aspect ratio (recommended for social sharing)
      urlFor(imageSource).width(1200).height(675).fit('crop').crop('center').url(),
      // 4x3 aspect ratio (standard blog image)
      urlFor(imageSource).width(1200).height(900).fit('crop').crop('center').url(),
      // 1x1 aspect ratio (square, good for mobile)
      urlFor(imageSource).width(1200).height(1200).fit('crop').crop('center').url(),
    ];
  }

  // Prepare JSON-LD structured data with multiple image sizes
  const articleLd = getBlogPostArticleLd({
    title: post.title,
    description: metaDescription,
    slug: post.slug.current,
    locale,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    author: post.author || "Isaac Orraiz",
    image: imageUrls, // Array of multiple image sizes
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
      <BlogPostTracker
        postTitle={post.title || "Blog Post"}
        postSlug={slug}
        postCategory={post.category}
      />
      <BlogModalOverride category={post.category ?? "general"} />
      <BlogScrollFloatingCTA category={post.category ?? "general"} />
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
      {Array.isArray(post.faqs) && post.faqs.length > 0 && (
        <Script
          id="faq-jsonld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getBlogPostFaqLd(post.faqs)),
          }}
        />
      )}

      <article className="container mx-auto min-h-screen max-w-4xl p-4 sm:p-8">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <li>
            <Link href={`/${locale}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              {locale === "en" ? "Home" : "Inicio"}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href={`/${locale}/blog`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Blog
            </Link>
          </li>
          {post.category && categoryLabel && (
            <>
              <li aria-hidden>/</li>
              <li>
                <Link href={`/${locale}/blog/category/${post.category}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  {categoryLabel}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden>/</li>
          <li className="text-gray-700 dark:text-gray-300 line-clamp-1 max-w-[200px] sm:max-w-xs" aria-current="page">
            {post.title}
          </li>
        </ol>
      </nav>

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
          {readingTime && (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {readingTime} {locale === "en" ? "min read" : "min lectura"}
            </span>
          )}
        </div>

        {/* Author Section — E-E-A-T */}
        {post.author && (
          <div className="mb-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex items-start gap-4">
            <Link href={`/${locale}/blog/author`} className="shrink-0">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_64,h_64,c_fill,g_face,r_max/isaacpic_c8kca5_3_hz35qm"
                alt={post.author}
                width={64}
                height={64}
                className="rounded-full ring-2 ring-blue-100 dark:ring-blue-900"
              />
            </Link>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-0.5">
                {locale === "en" ? "Written by" : "Escrito por"}
              </p>
              <Link href={`/${locale}/blog/author`} className="text-sm font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                {post.author}
              </Link>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {locale === "en"
                  ? "Licensed Insurance Agent · Certified Health Care Reform Specialist"
                  : "Agente de Seguros Licenciado · Especialista Certificado en Reforma de Salud"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  {locale === "en" ? `Licensed in ${stateCount} states` : `Licenciado en ${stateCount} estados`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  {locale === "en" ? "10+ years experience" : "10+ años de experiencia"}
                </span>
              </div>
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

      {/* Featured image: Cloudinary fetch crop-fills 16:9 (`c_fill,g_auto`; no padded gutters) */}
      {featuredImageUrl && (
        <figure className="mb-8 w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <div className="relative aspect-video w-full">
            <Image
              src={featuredImageUrl}
              alt={
                post.ogImage?.alt ||
                post.image?.alt ||
                post.title
              }
              fill
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) min(90vw, 896px), 896px"
              priority
            />
          </div>
        </figure>
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

     

      {/* FAQ Section */}
      {Array.isArray(post.faqs) && post.faqs.length > 0 && (
        <section className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {locale === "en" ? "Frequently Asked Questions" : "Preguntas Frecuentes"}
          </h2>
          <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
            {post.faqs.map((faq: { question: string; answer: string }, idx: number) => (
              <details key={idx} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-gray-900 dark:text-white list-none">
                  <span>{faq.question}</span>
                  <svg
                    className="h-5 w-5 flex-shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Category CTA - Before Comments */}
      <BlogCategoryCTA category={post.category} />

       {/* Social Links */}
       <BlogSocialLinks />

      {/* Newsletter */}
      <BlogNewsletter />

      {/* Comments */}
      <BlogComments
        postId={post._id}
        postSlug={post.slug.current}
      />

      {/* Related Posts */}
      {relatedPosts && relatedPosts.length > 0 && (
        <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {locale === "en" ? "Related Posts" : "Publicaciones Relacionadas"}
            </h2>
            {post.category && (
              <Link
                href={`/${locale}/blog/category/${post.category}`}
                className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {locale === "en"
                  ? `All ${categoryLabel || "category"} posts`
                  : `Todos los artículos de ${categoryLabel || "categoría"}`}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedPosts.slice(0, 3).map((related: any) => {
                const relatedImageUrl = related.image
                  ? cloudinaryFetchedImageUrl(urlFor(related.image).width(800).url(), 600, 400)
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

      {/* Category hub link — shown when there are no related posts to host it */}
      {(!relatedPosts || relatedPosts.length === 0) && post.category && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
          <Link
            href={`/${locale}/blog/category/${post.category}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.03 0-1.42L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z" />
            </svg>
            {locale === "en"
              ? `More ${categoryLabel || ""} articles`
              : `Más artículos de ${categoryLabel || ""}`}
          </Link>
        </div>
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

