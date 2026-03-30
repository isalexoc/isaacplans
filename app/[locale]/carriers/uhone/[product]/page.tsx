import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import UhoneProductLanding from "@/components/uhone-product-landing";
import {
  getUhoneProductBreadcrumbLd,
  getUhoneProductPageLd,
  getUhoneShortTermFaqLd,
} from "@/lib/seo/jsonld";
import {
  getUhoneProductOgImageSrc,
  isUhoneProductPageSlug,
  UHONE_PRODUCT_PAGE_SLUGS,
} from "@/lib/uhone-product-slugs";
import {
  ogLocaleOf,
  withLocalePrefix,
  type SupportedLocale,
} from "@/lib/seo/i18n";

export function generateStaticParams() {
  return UHONE_PRODUCT_PAGE_SLUGS.map((product) => ({ product }));
}

function hubHref(locale: SupportedLocale): string {
  return withLocalePrefix(locale, "/carriers/uhone");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}): Promise<Metadata> {
  const { locale, product } = await params;
  if (!isUhoneProductPageSlug(product)) {
    return { title: "Not found" };
  }

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "uhone.productPages",
  });
  const prefix = `${product}.`;
  const title = t(`${prefix}metadata.title`);
  const description = t(`${prefix}metadata.description`);
  const keywords = t(`${prefix}metadata.keywords`, { default: "" });
  const ogImage = getUhoneProductOgImageSrc(product);
  const ogAlt = t(`${prefix}hero.title`);

  const canonical = withLocalePrefix(
    supportedLocale,
    `/carriers/uhone/${product}`
  );
  const enCanonical = withLocalePrefix("en", `/carriers/uhone/${product}`);
  const esCanonical = withLocalePrefix("es", `/carriers/uhone/${product}`);
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

export default async function UhoneProductPage({
  params,
}: {
  params: Promise<{ locale: string; product: string }>;
}) {
  const { locale, product } = await params;
  if (!isUhoneProductPageSlug(product)) {
    notFound();
  }

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({
    locale: supportedLocale,
    namespace: "uhone.productPages",
  });
  const prefix = `${product}.`;

  const homeLabel = supportedLocale.startsWith("es") ? "Inicio" : "Home";
  const hubLabel = t("labels.breadcrumbHub");

  const pageLd = getUhoneProductPageLd(
    locale,
    product,
    t(`${prefix}metadata.title`),
    t(`${prefix}metadata.description`)
  );
  const crumbLd = getUhoneProductBreadcrumbLd(
    locale,
    homeLabel,
    hubLabel,
    t(`${prefix}metadata.title`),
    product
  );
  const faqLd = getUhoneShortTermFaqLd(
    [0, 1, 2, 3, 4].map((i) => ({
      question: t(`${prefix}faq.items.${i}.q`),
      answer: t(`${prefix}faq.items.${i}.a`),
    }))
  );

  return (
    <div className="relative min-h-screen">
      <BackHome
        href={hubHref(supportedLocale)}
        label={t(`${prefix}backNav.label`)}
      />
      <UhoneProductLanding slug={product} t={t} />

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
