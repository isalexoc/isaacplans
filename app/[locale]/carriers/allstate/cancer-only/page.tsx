import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import AllstateProductLanding from "@/components/allstate-product-landing";
import { allstateQuickQuoteUrl } from "@/lib/allstate-quick-quote";
import {
  getAllstateCancerOnlyHeroSrc,
  getAllstateProductOgImageSrc,
} from "@/lib/allstate-product-hero";
import {
  ALLSTATE_CANCER_ONLY_SLUG,
  natgenProductParamForSlug,
} from "@/lib/allstate-product-routes";
import {
  getAllstateProductBreadcrumbLd,
  getAllstateProductPageLd,
  getAllstateShortTermFaqLd,
} from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";

function hubHref(locale: SupportedLocale): string {
  return withLocalePrefix(locale, "/carriers/allstate");
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "allstate.productPages",
  });
  const prefix = "cancerOnly.";
  const title = t(`${prefix}metadata.title`);
  const description = t(`${prefix}metadata.description`);
  const keywords = t(`${prefix}metadata.keywords`, { default: "" });
  const ogImage = getAllstateProductOgImageSrc("cancer", ALLSTATE_CANCER_ONLY_SLUG);
  const ogAlt = t(`${prefix}hero.title`);

  const canonical = withLocalePrefix(locale, "/carriers/allstate/cancer-only");
  const enCanonical = withLocalePrefix("en", "/carriers/allstate/cancer-only");
  const esCanonical = withLocalePrefix("es", "/carriers/allstate/cancer-only");
  const ogLocale = ogLocaleOf(locale);

  return {
    title,
    description,
    keywords: keywords || undefined,
    alternates: {
      canonical,
      languages: {
        "en-US": enCanonical,
        "es-ES": esCanonical,
        "x-default": enCanonical,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImage, alt: ogAlt }],
    },
  };
}

export default async function AllstateCancerOnlyPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "allstate.productPages",
  });
  const prefix = "cancerOnly.";

  const homeLabel = locale.startsWith("es") ? "Inicio" : "Home";
  const quoteUrl = allstateQuickQuoteUrl(
    natgenProductParamForSlug(ALLSTATE_CANCER_ONLY_SLUG)
  );
  const heroSrc = getAllstateCancerOnlyHeroSrc();

  const pageLd = getAllstateProductPageLd(
    locale,
    "carriers/allstate/cancer-only",
    t(`${prefix}metadata.title`),
    t(`${prefix}metadata.description`)
  );
  const crumbLd = getAllstateProductBreadcrumbLd(locale, [
    { name: homeLabel, path: "" },
    { name: t("labels.breadcrumbHub"), path: "carriers/allstate" },
    {
      name: t(`${prefix}hero.title`),
      path: "carriers/allstate/cancer-only",
    },
  ]);
  const faqLd = getAllstateShortTermFaqLd(
    [0, 1, 2, 3].map((i) => ({
      question: t(`${prefix}faq.items.${i}.q`),
      answer: t(`${prefix}faq.items.${i}.a`),
    }))
  );

  return (
    <div className="relative min-h-screen">
      <BackHome href={hubHref(locale)} label={t(`${prefix}backNav.label`)} />
      <AllstateProductLanding
        t={t}
        quoteUrl={quoteUrl}
        translationKeyPrefix={prefix}
        heroSrc={heroSrc}
      />

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd, faqLd]).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}
