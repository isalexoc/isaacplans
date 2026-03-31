import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import GetCoveredFastFunnel from "@/components/get-covered-fast/get-covered-fast-funnel";
import ServicePageTracker from "@/components/service-page-tracker";
import { GET_COVERED_FAST_OG_IMAGE } from "@/lib/get-covered-fast/constants";
import { getLicensedStateCount } from "@/lib/licensed-states";
import {
  getGetCoveredFastBreadcrumbLd,
  getGetCoveredFastPageLd,
} from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "getCoveredFastPage.metadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const imageAlt = t("imageAlt");
  const routeKey = "/get-covered-fast";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
  const ogLocale = ogLocaleOf(locale);

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [
        {
          url: GET_COVERED_FAST_OG_IMAGE,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: GET_COVERED_FAST_OG_IMAGE, alt: imageAlt }],
    },
  };
}

export default async function GetCoveredFastPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const licensedStateCount = await getLicensedStateCount();
  const tMeta = await getTranslations({ locale, namespace: "getCoveredFastPage.metadata" });

  const pageLd = getGetCoveredFastPageLd(
    locale,
    tMeta("title"),
    tMeta("description")
  );
  const crumbLd = getGetCoveredFastBreadcrumbLd(
    locale,
    locale.startsWith("es") ? "Inicio" : "Home",
    tMeta("breadcrumbPage")
  );

  return (
    <div className="relative min-h-screen">
      <ServicePageTracker
        serviceName="Get covered fast"
        serviceCategory="get-covered-fast"
      />
      <GetCoveredFastFunnel licensedStateCount={licensedStateCount} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
