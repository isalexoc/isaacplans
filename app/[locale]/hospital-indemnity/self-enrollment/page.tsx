import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import ShortTermCarriersSection from "@/components/shortterm-carriers-section";
import { buildHospitalIndemnityEnrollmentCarriers } from "@/lib/hospital-indemnity-enrollment-carriers";
import { getHospitalIndemnitySelfEnrollmentPageLd } from "@/lib/seo/jsonld";
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
    namespace: "HIpage.selfEnrollmentPage.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/hospital-indemnity/self-enrollment";
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

export default async function HospitalIndemnitySelfEnrollmentPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "HIpage" });

  const carriers = buildHospitalIndemnityEnrollmentCarriers((key) => t(key));

  const routeKey = "/hospital-indemnity/self-enrollment";
  const slug = localizedSlug(routeKey, locale);
  const canonical = `https://www.isaacplans.com${withLocalePrefix(locale, slug)}`;

  const pageLd = getHospitalIndemnitySelfEnrollmentPageLd(
    canonical,
    t("selfEnrollmentPage.metadata.title"),
    t("selfEnrollmentPage.metadata.description"),
    locale
  );

  return (
    <>
      <ServicePageTracker
        serviceName="Hospital indemnity self-enrollment"
        serviceCategory="hospital-indemnity"
      />
      <div className="relative min-h-screen">
        <BackHome />
        <ShortTermCarriersSection
          sectionId="hi-carriers"
          label={t("carriersSection.label")}
          title={t("carriersSection.title")}
          titleHeading="h1"
          subtitle={t("selfEnrollmentPage.sectionSubtitle")}
          ctaLabel={t("carriersSection.cta")}
          ctaLabelMobile={t("carriersSection.ctaMobile")}
          carriers={carriers}
        />
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd]).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
