import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import ShortTermCarriersSection from "@/components/shortterm-carriers-section";
import ServicePageTracker from "@/components/service-page-tracker";
import { buildDentalEnrollmentCarriers } from "@/lib/dental-enrollment-carriers";
import { isGcfHealthCoverageFastAdsCarrierPage } from "@/lib/get-covered-fast/gcf-attribution";
import { getDentalVisionSelfEnrollmentPageLd } from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "dentalVisionPage",
  });

  const title = t("selfEnrollmentPage.metadata.title");
  const description = t("selfEnrollmentPage.metadata.description");
  const keywords = t("selfEnrollmentPage.metadata.keywords", { default: "" });
  const image = t("selfEnrollmentPage.metadata.image");
  const alt = t("selfEnrollmentPage.metadata.imageAlt");

  const routeKey = "/dental-vision/self-enrollment";
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
    openGraph: {
      title,
      description,
      url: canonical,
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
  };
}

function firstQueryString(
  v: string | string[] | undefined
): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

type SelfEnrollmentPageProps = {
  searchParams: Promise<{
    from?: string;
    path?: string;
    gcf_channel?: string;
  }>;
};

export default async function DentalVisionSelfEnrollmentPage({
  searchParams,
}: SelfEnrollmentPageProps) {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "dentalVisionPage" });

  const sp = await searchParams;
  const gcfAdsCarrierConversionEnabled = isGcfHealthCoverageFastAdsCarrierPage(
    {
      from: firstQueryString(sp.from),
      path: firstQueryString(sp.path),
      gcf_channel: firstQueryString(sp.gcf_channel),
    },
    "dentalVision"
  );

  const dentalCarriers = buildDentalEnrollmentCarriers((key) => t(key));

  const routeKey = "/dental-vision/self-enrollment";
  const slug = localizedSlug(routeKey, locale);
  const canonical = `https://www.isaacplans.com${withLocalePrefix(locale, slug)}`;

  const pageLd = getDentalVisionSelfEnrollmentPageLd(
    canonical,
    t("selfEnrollmentPage.metadata.title"),
    t("selfEnrollmentPage.metadata.description"),
    locale
  );

  return (
    <>
      <ServicePageTracker
        serviceName="Dental & vision self-enrollment"
        serviceCategory="dental-vision"
      />
      <div className="relative min-h-screen">
        <BackHome />
        <ShortTermCarriersSection
          label={t("carriersSection.label")}
          title={t("carriersSection.title")}
          titleHeading="h1"
          subtitle={t("selfEnrollmentPage.sectionSubtitle")}
          ctaLabel={t("carriersSection.cta")}
          ctaLabelMobile={t("carriersSection.ctaMobile")}
          gcfAdsCarrierConversionEnabled={gcfAdsCarrierConversionEnabled}
          carrierHubContext="dental_self_enrollment"
          carriers={dentalCarriers}
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(pageLd).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
