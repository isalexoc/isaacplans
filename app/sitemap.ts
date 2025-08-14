// app/sitemap.ts
import type { MetadataRoute } from "next";
import { Locale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Use env in all environments; keep a safe default for local/dev
const HOST = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com"
).replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  // List your static pages once (no locale prefixes here!)
  const staticPages: Href[] = [
    "/", // home
    "/about",
    "/contact",
    "/privacy-policy",
    "/aca",
    "/aca/calendar",
    "/dental-vision",
    "/dental-vision/calendar",
    "/hospital-indemnity",
    "/hospital-indemnity/calendar",
  ];

  // If you have dynamic collections (e.g. blog posts), build them and concat here
  // const posts = getEntriesForCollection(
  //   postSlugs, { pathname: '/blog/[slug]', paramsFromSlug: (slug) => ({slug}) }
  // );

  const entries = staticPages.flatMap((href) => getEntries(href));

  return entries;
}

/** Types from your navigation helper so this stays in sync with next-intl routing */
type Href = Parameters<typeof getPathname>[0]["href"];

/** Build one <url> entry per locale, including <xhtml:link rel="alternate"> equivalents */
function getEntries(href: Href): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const priority = getPriority(href);

  return routing.locales.map((locale: Locale) => {
    const url = getUrl(href, locale);
    return {
      url,
      lastModified,
      changeFrequency: "monthly" as const,
      priority,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((cur) => [cur, getUrl(href, cur as Locale)])
        ),
      },
    };
  });
}

function getUrl(href: Href, locale: Locale) {
  const pathname = getPathname({ locale, href });
  return HOST + pathname;
}

/** Optional: give key pages a bit more weight */
function getPriority(href: Href): number {
  if (href === "/") return 1.0;
  if (
    href === "/about" ||
    href === "/contact" ||
    href === "/aca" ||
    href === "/dental-vision" ||
    href === "/hospital-indemnity"
  ) {
    return 0.8;
  }
  return 0.6;
}

/* ---------- (Optional) helpers for dynamic collections ----------

type PatternArgs<TParams extends Record<string, string>> = {
  pathname: `/blog/[slug]` | string; // any pattern you have
  paramsFromSlug: (slug: string) => TParams;
};

function getEntriesForCollection<TParams extends Record<string, string>>(
  slugs: string[],
  pattern: PatternArgs<TParams>
): MetadataRoute.Sitemap {
  return slugs.flatMap((slug) =>
    getEntries({
      pathname: pattern.pathname as any,
      params: pattern.paramsFromSlug(slug)
    } as Href)
  );
}

------------------------------------------------------------------ */
