import HeroWithTestimonials from "@/components/hero-template";
import LifeInsuranceButton from "@/components/LifeInsuranceButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getLifeInsurancePageLd, getLifeInsuranceBreadcrumbLd } from "@/lib/seo/jsonld";
import { LIFE_INSURANCE_ENROLL_URL } from "@/lib/get-covered-fast/constants";

import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "lifeInsurancePage.lifeInsuranceMetadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/life-insurance.png",
  }) as string;
  const alt = t("imageAlt", { default: "Life insurance overview" });

  const routeKey = "/life-insurance";
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
      images: [{ url: cloudinaryOgImageUrl(image), width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: cloudinaryOgImageUrl(image), alt }],
    },
  };
}

export default async function LifeInsurancePage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "lifeInsurancePage" });

  const pageLd = getLifeInsurancePageLd(locale, t("hero.title"), t("hero.description"));
  const crumbLd = getLifeInsuranceBreadcrumbLd(
    locale,
    t("lifeInsuranceMetadata.breadcrumbs.home"),
    t("lifeInsuranceMetadata.breadcrumbs.lifeInsurance")
  );

  return (
    <>
      <ServicePageTracker serviceName="Life Insurance" serviceCategory="life-insurance" />
      <div className="relative">
        <BackHome />
      </div>
      {/* HERO ----------------------------------------------------------- */}
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="pexels-emma-bauso-1183828-2253879_1_zd87oq"
        imagePosition="left"
        cta={<LifeInsuranceButton />}
        testimonials={[
          {
            name: t("hero.testimonials.0.name"),
            text: t("hero.testimonials.0.text"),
          },
          {
            name: t("hero.testimonials.1.name"),
            text: t("hero.testimonials.1.text"),
          },
        ]}
        happyClient={{
          title: t("hero.happyClient.title"),
          subtitle: t("hero.happyClient.subtitle"),
        }}
      />

      {/* ABOUT ISAAC ---------------------------------------------------- */}
      <AboutSectionGeneric
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<LifeInsuranceButton />}
      />

      {/* SELF-ENROLL CARD ------------------------------------------------ */}
      <PlanEnrollCard
        title={t("selfEnroll.title")}
        subtitle={t("selfEnroll.subtitle")}
        cta={t("selfEnroll.cta")}
        link={LIFE_INSURANCE_ENROLL_URL}
        disclaimer={t("selfEnroll.disclaimer")}
        className="max-w-3xl mx-auto mt-24"
      />

      {/* WHAT IS TERM LIFE INSURANCE? ------------------------------------ */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="tmpfs1tzoqj_1_qqzvsx"
        imagePosition="left"
        cta={<LifeInsuranceButton />}
      />

      {/* ELIGIBILITY ---------------------------------------------------- */}
      <EligibilitySection
        title={
          <>
            {t("eligibility.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("eligibility.headlineBold")}</span>
          </>
        }
        intro={t("eligibility.intro")}
        bullets={[
          t("eligibility.bullets.0"),
          t("eligibility.bullets.1"),
          t("eligibility.bullets.2"),
          t("eligibility.bullets.3"),
        ]}
        note={t("eligibility.note")}
        imagePublicId="pexels-jibarofoto-2014773_wxjikn"
        imagePosition="left"
      />

      {/* HOW WE FIND YOUR RATE ------------------------------------------ */}
      <EnrollmentSectionGeneric
        title={
          <>
            {t("enroll.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("enroll.headlineBold")}</span>
          </>
        }
        intro={t("enroll.intro")}
        steps={[t("enroll.steps.0"), t("enroll.steps.1")]}
        subHeading={t("enroll.subHeading")}
        bullets={[
          t("enroll.bullets.0"),
          t("enroll.bullets.1"),
          t("enroll.bullets.2"),
          t("enroll.bullets.3"),
        ]}
        note={t("enroll.note")}
        imagePublicId="tmp8ukl9fl1_m7udej"
        imagePosition="right"
        cta={t("ctaButton.title")}
        href="/contact#contact-form"
      />

      {/* FAQ ------------------------------------------------------------ */}
      <FaqSection
        label={t("faq.label")}
        title={
          <>
            {t("faq.titleBeforeBold")}{" "}
            <span className="text-blue-800">{t("faq.titleBold")}</span>
          </>
        }
        faqs={Array.from({ length: 6 }).map((_, i) => ({
          question: t(`faq.items.${i}.q`),
          answer: t(`faq.items.${i}.a`),
        }))}
        imagePublicId="tmpft70mt0j_1_hppsqh"
      />

      {/* CTA BANNER ----------------------------------------------------- */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<LifeInsuranceButton />}
      />

      {/* JSON-LD -------------------------------------------------------- */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
