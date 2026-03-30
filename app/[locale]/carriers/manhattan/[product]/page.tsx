import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import ManhattanProductLanding from "@/components/manhattan-product-landing";
import {
  MANHATTAN_PRODUCT_SLUGS,
  isManhattanProductSlug,
  manhattanQuoteUrlForSlug,
  type ManhattanProductSlug,
} from "@/lib/manhattan-product-routes";
import { getManhattanProductHeroSrc, getManhattanProductOgImageSrc } from "@/lib/manhattan-product-hero";
import {
  getAllstateProductBreadcrumbLd,
  getAllstateProductPageLd,
  getAllstateShortTermFaqLd,
} from "@/lib/seo/jsonld";
import { ogLocaleOf, withLocalePrefix, type SupportedLocale } from "@/lib/seo/i18n";

export function generateStaticParams() {
  return MANHATTAN_PRODUCT_SLUGS.map((product) => ({ product }));
}

function hubHref(locale: SupportedLocale): string {
  return withLocalePrefix(locale, "/carriers/manhattan");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale, product } = await params;
  if (!isManhattanProductSlug(product)) {
    return { title: "Not found" };
  }

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "manhattan.productPages",
  });
  const prefix = `products.${product}.`;
  const title = t(`${prefix}metadata.title`);
  const description = t(`${prefix}metadata.description`);
  const keywords = t(`${prefix}metadata.keywords`, { default: "" });
  const slug = product as ManhattanProductSlug;
  const ogImage = getManhattanProductOgImageSrc(slug);
  const ogAlt = t(`${prefix}hero.title`);

  const canonical = withLocalePrefix(
    supportedLocale,
    `/carriers/manhattan/${product}`
  );
  const enCanonical = withLocalePrefix("en", `/carriers/manhattan/${product}`);
  const esCanonical = withLocalePrefix("es", `/carriers/manhattan/${product}`);
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

export default async function ManhattanProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale, product } = await params;
  if (!isManhattanProductSlug(product)) {
    notFound();
  }

  const slug = product as ManhattanProductSlug;
  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "manhattan.productPages",
  });
  const prefix = `products.${slug}.`;

  const homeLabel = supportedLocale.startsWith("es") ? "Inicio" : "Home";
  const quoteUrl = manhattanQuoteUrlForSlug(slug);
  const heroSrc = getManhattanProductHeroSrc(slug);

  const pageLd = getAllstateProductPageLd(
    locale,
    `carriers/manhattan/${slug}`,
    t(`${prefix}metadata.title`),
    t(`${prefix}metadata.description`)
  );
  const crumbLd = getAllstateProductBreadcrumbLd(locale, [
    { name: homeLabel, path: "" },
    { name: t("labels.breadcrumbHub"), path: "carriers/manhattan" },
    {
      name: t(`${prefix}hero.title`),
      path: `carriers/manhattan/${slug}`,
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
      <ManhattanProductLanding
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
