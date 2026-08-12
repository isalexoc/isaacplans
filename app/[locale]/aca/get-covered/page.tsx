import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import AcaGetCoveredFunnel from "@/components/aca/aca-get-covered-funnel";
import ServicePageTracker from "@/components/service-page-tracker";
import { getEffectivePageMedia, getEffectiveOgImageUrl } from "@/lib/page-media/settings";
import {
  getAcaGetCoveredAdsBreadcrumbLd,
  getAcaGetCoveredAdsPageLd,
} from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

/** Paid-ads landing: ACA lead funnel with minimal site header/footer (middleware + ads-landing). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "acaGetCoveredPage.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const imageAlt = t("imageAlt");
  const routeKey = "/aca/get-covered";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
  const ogLocale = ogLocaleOf(locale);
  const ogImageUrl = await getEffectiveOgImageUrl("aca", "ads", locale);

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
          url: ogImageUrl,
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
      images: [{ url: ogImageUrl, alt: imageAlt }],
    },
  };
}

export default async function AcaGetCoveredAdsPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const tMeta = await getTranslations({
    locale,
    namespace: "acaGetCoveredPage.metadata",
  });

  const pageLd = getAcaGetCoveredAdsPageLd(
    locale,
    tMeta("title"),
    tMeta("description")
  );
  const crumbLd = getAcaGetCoveredAdsBreadcrumbLd(
    locale,
    locale.startsWith("es") ? "Inicio" : "Home",
    tMeta("breadcrumbPage")
  );

  const heroMedia = await getEffectivePageMedia("aca", "ads", "hero", locale);

  return (
    <div className="relative min-h-screen">
      <ServicePageTracker
        serviceName="ACA get covered"
        serviceCategory="aca-get-covered-ads"
      />
      <AcaGetCoveredFunnel heroMedia={heroMedia} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
