import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import LifeInsuranceGetCoveredFunnel from "@/components/life-insurance/life-insurance-get-covered-funnel";
import ServicePageTracker from "@/components/service-page-tracker";
import { getEffectiveAdsImageUrl } from "@/lib/ads-images/settings";
import {
  getLifeInsuranceGetCoveredAdsBreadcrumbLd,
  getLifeInsuranceGetCoveredAdsPageLd,
} from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

/** Paid-ads landing: Life Insurance lead funnel with minimal site header/footer (middleware + ads-landing). */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "lifeInsuranceGetCoveredPage.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const imageAlt = t("imageAlt");
  const routeKey = "/life-insurance/get-covered";
  const slug = localizedSlug(routeKey, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en"));
  const ogLocale = ogLocaleOf(locale);
  const ogImageUrl = await getEffectiveAdsImageUrl("life-insurance", "og", locale);

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

export default async function LifeInsuranceGetCoveredAdsPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const tMeta = await getTranslations({
    locale,
    namespace: "lifeInsuranceGetCoveredPage.metadata",
  });

  const pageLd = getLifeInsuranceGetCoveredAdsPageLd(
    locale,
    tMeta("title"),
    tMeta("description")
  );
  const crumbLd = getLifeInsuranceGetCoveredAdsBreadcrumbLd(
    locale,
    locale.startsWith("es") ? "Inicio" : "Home",
    tMeta("breadcrumbPage")
  );

  const heroImageUrl = await getEffectiveAdsImageUrl("life-insurance", "hero", locale);

  return (
    <div className="relative min-h-screen">
      <ServicePageTracker
        serviceName="Life Insurance get covered"
        serviceCategory="life-insurance-get-covered-ads"
      />
      <LifeInsuranceGetCoveredFunnel heroImageUrl={heroImageUrl} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
