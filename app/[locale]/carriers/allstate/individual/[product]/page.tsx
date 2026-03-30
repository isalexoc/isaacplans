import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import AllstateProductLanding from "@/components/allstate-product-landing";
import { allstateQuickQuoteUrl } from "@/lib/allstate-quick-quote";
import {
  getAllstateIndividualHeroSrc,
  getAllstateProductOgImageSrc,
} from "@/lib/allstate-product-hero";
import {
  ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS,
  isAllstateIndividualSlug,
  natgenProductParamForSlug,
  type AllstateIndividualProductSlug,
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

export function generateStaticParams() {
  return ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS.map((product) => ({ product }));
}

function hubHref(locale: SupportedLocale): string {
  return withLocalePrefix(locale, "/carriers/allstate");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale, product } = await params;
  if (!isAllstateIndividualSlug(product)) {
    return { title: "Not found" };
  }

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "allstate.productPages",
  });
  const prefix = `individual.${product}.`;
  const title = t(`${prefix}metadata.title`);
  const description = t(`${prefix}metadata.description`);
  const keywords = t(`${prefix}metadata.keywords`, { default: "" });
  const ogImage = getAllstateProductOgImageSrc("individual", product);
  const ogAlt = t(`${prefix}hero.title`);

  const canonical = withLocalePrefix(
    supportedLocale,
    `/carriers/allstate/individual/${product}`
  );
  const enCanonical = withLocalePrefix(
    "en",
    `/carriers/allstate/individual/${product}`
  );
  const esCanonical = withLocalePrefix(
    "es",
    `/carriers/allstate/individual/${product}`
  );
  const ogLocale = ogLocaleOf(supportedLocale);

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

export default async function AllstateIndividualProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale, product } = await params;
  if (!isAllstateIndividualSlug(product)) {
    notFound();
  }

  const slug = product as AllstateIndividualProductSlug;
  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "allstate.productPages",
  });
  const prefix = `individual.${slug}.`;

  const homeLabel = supportedLocale.startsWith("es") ? "Inicio" : "Home";
  const quoteUrl = allstateQuickQuoteUrl(natgenProductParamForSlug(slug));
  const heroSrc = getAllstateIndividualHeroSrc(slug);

  const pageLd = getAllstateProductPageLd(
    locale,
    `carriers/allstate/individual/${slug}`,
    t(`${prefix}metadata.title`),
    t(`${prefix}metadata.description`)
  );
  const crumbLd = getAllstateProductBreadcrumbLd(locale, [
    { name: homeLabel, path: "" },
    { name: t("labels.breadcrumbHub"), path: "carriers/allstate" },
    {
      name: t(`${prefix}hero.title`),
      path: `carriers/allstate/individual/${slug}`,
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
      <BackHome href={hubHref(supportedLocale)} label={t(`${prefix}backNav.label`)} />
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
