// app/sitemap.ts
import type { MetadataRoute } from "next";
import type { Locale } from "next-intl";
import { routing } from "@/i18n/routing";
import { getPathname } from "@/i18n/navigation";

/**
 * Keep this in one place so it’s easy to change for staging, etc.
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

  // Resources
  { href: "/subsidy-calculator", changeFrequency: "monthly", priority: 0.7 },
  { href: "/plan-comparison", changeFrequency: "monthly", priority: 0.7 },
  { href: "/renewal-support", changeFrequency: "monthly", priority: 0.7 },
  { href: "/consumer-guides", changeFrequency: "weekly", priority: 0.8 },
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

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // For each logical page, output one entry per locale, each with a full languages-alternate map.
  const entries: MetadataRoute.Sitemap = PAGES.flatMap((page) =>
    routing.locales.map((locale) => ({
      url: urlFor(page.href, locale),
      lastModified: page.lastModified ?? now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: alternatesFor(page.href),
    }))
  );

  return entries;
}
