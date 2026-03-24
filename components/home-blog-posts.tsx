import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { type SanityDocument } from "next-sanity";
import { sanityFetch } from "@/sanity/lib/live";
import { type SupportedLocale } from "@/lib/seo/i18n";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogPostCard } from "@/components/blog-post-card";

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

export default async function HomeBlogPosts() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "HomePage" });

  // Try to get featured posts first, fallback to latest posts
  const featuredResult = await sanityFetch({
    query: FEATURED_POSTS_QUERY,
    params: { locale },
    ...options
  });
  const featuredPosts: SanityDocument[] = featuredResult.data || [];

  const posts: SanityDocument[] = featuredPosts.length >= 3
    ? featuredPosts.slice(0, 3)
    : await sanityFetch({
        query: LATEST_POSTS_QUERY,
        params: { locale },
        ...options
      }).then((latestResult) => {
        const latest: SanityDocument[] = latestResult.data || [];
        // If we have some featured posts but less than 3, combine with latest
        if (featuredPosts.length > 0 && featuredPosts.length < 3) {
          const featuredIds = new Set(featuredPosts.map((p: SanityDocument) => p._id));
          const additional = latest
            .filter((p: SanityDocument) => !featuredIds.has(p._id))
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
            <BlogPostCard
              key={post._id}
              post={post}
              locale={locale}
              titleAs="h3"
            />
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
