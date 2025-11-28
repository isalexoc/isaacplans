// app/sitemap.ts
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";
import { client } from "@/sanity/lib/client";
import type { SanityDocument } from "next-sanity";

/**
 * Keep this in one place so it's easy to change for staging, etc.
 * If you prefer env vars, use process.env.NEXT_PUBLIC_SITE_URL.
 */
const HOST = "https://www.isaacplans.com";

/** Helper types based on your next-intl navigation setup */
type Href = Parameters<typeof getPathname>[0]["href"];

type Page = {
  href: Href;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
  // Optional override; otherwise we'll use "now"
  lastModified?: Date;
};

/** Your canonical pages (no locale here; we expand to all locales below) */
const PAGES: Page[] = [
  // Home
  { href: "/", changeFrequency: "monthly", priority: 1 },

  // Top-level
  { href: "/about", changeFrequency: "monthly", priority: 0.8 },
  { href: "/contact", changeFrequency: "monthly", priority: 0.8 },
  { href: "/privacy-policy", changeFrequency: "yearly", priority: 0.6 },
  { href: "/terms-of-service", changeFrequency: "yearly", priority: 0.6 },
  { href: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { href: "/testimonials", changeFrequency: "monthly", priority: 0.7 },
  { href: "/glossary", changeFrequency: "monthly", priority: 0.7 },

  // ACA
  { href: "/aca", changeFrequency: "monthly", priority: 0.8 },
  { href: "/aca/calendar", changeFrequency: "monthly", priority: 0.6 },

  // Dental & Vision
  { href: "/dental-vision", changeFrequency: "monthly", priority: 0.8 },
  {
    href: "/dental-vision/calendar",
    changeFrequency: "monthly",
    priority: 0.6,
  },

  // Hospital Indemnity
  { href: "/hospital-indemnity", changeFrequency: "monthly", priority: 0.8 },
  {
    href: "/hospital-indemnity/calendar",
    changeFrequency: "monthly",
    priority: 0.6,
  },

  // Final Expense
  { href: "/final-expense", changeFrequency: "monthly", priority: 0.8 },
  { href: "/final-expense/calendar", changeFrequency: "monthly", priority: 0.6 },

  // IUL
  { href: "/iul", changeFrequency: "monthly", priority: 0.8 },
  { href: "/iul/calendar", changeFrequency: "monthly", priority: 0.6 },
  { href: "/iul/presentation", changeFrequency: "monthly", priority: 0.7 },
  { href: "/iul/application", changeFrequency: "monthly", priority: 0.7 },
  { href: "/iul/referrals", changeFrequency: "monthly", priority: 0.7 },

  // Short Term Medical
  { href: "/short-term-medical", changeFrequency: "monthly", priority: 0.8 },
  { href: "/carriers/uhone/shortterm", changeFrequency: "monthly", priority: 0.7 },

  // Resources
  { href: "/subsidy-calculator", changeFrequency: "monthly", priority: 0.7 },
  { href: "/plan-comparison", changeFrequency: "monthly", priority: 0.7 },
  { href: "/renewal-support", changeFrequency: "monthly", priority: 0.7 },
  { href: "/consumer-guides", changeFrequency: "weekly", priority: 0.8 },

  // Blog
  { href: "/blog", changeFrequency: "daily", priority: 0.9 },
  { href: "/blog/categories", changeFrequency: "weekly", priority: 0.8 },
];

/** Build a fully-qualified URL for a given locale+href using next-intl’s routing */
function urlFor(href: Href, locale: Locale): string {
  const pathname = getPathname({ locale, href });
  return HOST + pathname;
}

/** Build the <xhtml:link rel="alternate"> block (Next will serialize from this `alternates.languages`) */
function alternatesFor(
  href: Href
): NonNullable<MetadataRoute.Sitemap[number]["alternates"]> {
  const languages = Object.fromEntries(
    routing.locales.map((loc) => [loc, urlFor(href, loc)])
  );
  return { languages };
}

// Query to get all published blog posts
const BLOG_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && status == "published"
]|order(publishedAt desc){
  slug,
  locale,
  publishedAt,
  updatedAt
}`;

// Query to get all blog categories that have posts
const BLOG_CATEGORIES_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && status == "published"
  && defined(category)
]{
  category
}`;

const options = { next: { revalidate: 3600 } }; // Revalidate every hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // Fetch blog posts and categories from Sanity
  const [blogPosts, categoryData] = await Promise.all([
    client.fetch<SanityDocument[]>(BLOG_POSTS_QUERY, {}, options).catch(() => []),
    client.fetch<SanityDocument[]>(BLOG_CATEGORIES_QUERY, {}, options).catch(() => []),
  ]);

  // Get unique categories
  const categories = Array.from(
    new Set(categoryData.map((post) => post.category).filter(Boolean))
  );

  // For each logical page, output one entry per locale, each with a full languages-alternate map.
  const staticEntries: MetadataRoute.Sitemap = PAGES.flatMap((page) =>
    routing.locales.map((locale) => ({
      url: urlFor(page.href, locale),
      lastModified: page.lastModified ?? now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: alternatesFor(page.href),
    }))
  );

  // Add blog posts
  const blogEntries: MetadataRoute.Sitemap = blogPosts.flatMap((post) => {
    if (!post.slug?.current || !post.locale) return [];
    
    const href = `/blog/${post.slug.current}` as Href;
    const publishedDate = post.publishedAt ? new Date(post.publishedAt) : now;
    const updatedDate = post.updatedAt ? new Date(post.updatedAt) : publishedDate;

    return {
      url: urlFor(href, post.locale as Locale),
      lastModified: updatedDate,
      changeFrequency: "weekly" as const,
      priority: 0.8,
      alternates: alternatesFor(href),
    };
  });

  // Add blog category pages
  const categoryEntries: MetadataRoute.Sitemap = categories.flatMap((category) => {
    const href = `/blog/category/${category}` as Href;
    return routing.locales.map((locale) => ({
      url: urlFor(href, locale),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: alternatesFor(href),
    }));
  });

  return [...staticEntries, ...blogEntries, ...categoryEntries];
}
