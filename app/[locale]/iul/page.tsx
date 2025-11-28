import HeroWithTestimonials from "@/components/hero-template";
import IULButton from "@/components/IULButton";
import IULPresentationButton from "@/components/IULPresentationButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import { BackHome } from "@/components/back-home";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getIulPageLd, getIulBreadcrumbLd } from "@/lib/seo/jsonld";

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
  const t = await getTranslations({ locale, namespace: "iulPage.iulMetadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/iul_en.png",
  }) as string;
  const alt = t("imageAlt", { default: "Indexed Universal Life overview" });

  // Add this route key to your `routing.pathnames` map:
  // "/indexed-universal-life": { en: "/indexed-universal-life", es: "/indexed-universal-life" }
  const routeKey = "/iul";
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

export default async function IndexedUniversalLifePage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "iulPage" });

  const pageLd = getIulPageLd(locale, t("hero.title"), t("hero.description"));
  const crumbLd = getIulBreadcrumbLd(
    locale,
    t("iulMetadata.breadcrumbs.home"),
    t("iulMetadata.breadcrumbs.iul")
  );

  return (
    <>
      <div className="relative">
        <BackHome />
      </div>
      {/* HERO ----------------------------------------------------------- */}
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="pexels-victor-l-19338-2790434_1_pr9bng"
        imagePosition="left"
        cta={<IULButton />}
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

       {/* PRESENTATION MODE BUTTON ----------------------------------------- */}
       <div className="container mx-auto px-4 pt-8 pb-4">
        <IULPresentationButton />
      </div>

      {/* ABOUT ISAAC ---------------------------------------------------- */}
      <AboutSectionGeneric
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<IULButton />}
      />

      {/* WHAT IS IUL? --------------------------------------------------- */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="moneyback_frolim"
        imagePosition="left"
        cta={<IULButton />}
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

      {/* HOW WE DESIGN YOUR IUL ---------------------------------------- */}
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
        imagePublicId="tmph9wnbhil_wts4sf"
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
        cta={<IULButton />}
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
