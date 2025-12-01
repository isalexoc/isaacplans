import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import Hero from "@/components/hero";
import Services from "@/components/services";
import About from "@/components/about";
import Coverage from "@/components/states";
import HomeBlogPosts from "@/components/home-blog-posts";
import {
  ogLocaleOf,
  type SupportedLocale,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  xDefaultHref,
} from "@/lib/seo/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  // keep using your existing namespace if that's where your strings live
  const t = await getTranslations({ locale, namespace: "layoutMetadata" });

  const title = t("title", { default: "Isaac Plans Insurance" });
  const description = t("description", {
    default:
      "Get affordable health insurance guidance in English and Spanish. Free quotes and expert help.",
  });
  const keywords = t("keywords", {
    default:
      "health insurance, ACA, Obamacare, dental, vision, Virginia, Spanish, English",
  });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/og-home.jpg",
  });
  const alt = t("imageAlt", { default: "Isaac Plans Insurance hero image" });

  const routeKey = "/";
  const slug = localizedSlug(routeKey, locale); // always "/" (slug only)
  const canonical = withLocalePrefix(locale, slug); // "/en" or "/es"
  const languages = languageAlternatesPrefixed(routeKey); // { "en-US": "/en", "es-ES": "/es" }
  const ogLocale = ogLocaleOf(locale); // en_US / es_ES

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefaultHref }, // x-default => "/en"
    },
    openGraph: {
      title,
      description,
      url: canonical, // resolved absolute via metadataBase in your layout
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
    // No robots block — defaults to index, follow
  };
}

export default async function HomePage() {
  return (
    <main className="w-full flex flex-col overflow-x-hidden">
      {/* @ts-expect-error Async Server Component */}
      <Hero />
      {/* @ts-expect-error Async Server Component */}
      <Services />
      {/* @ts-expect-error Async Server Component */}
      <About />
      {/* @ts-expect-error Async Server Component */}
      <HomeBlogPosts />
      {/* @ts-expect-error Async Server Component */}
      <Coverage />
    </main>
  );
}
