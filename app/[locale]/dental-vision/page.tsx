import { getTranslations, getLocale } from "next-intl/server";
import HeroWithTestimonials from "@/components/hero-template";
import DentalButton from "@/components/DentalButton";
import AboutSection from "@/components/about-section-template";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import EligibilitySection from "@/components/eligibility-section";
import EnrollmentSection from "@/components/enrollment-section-template";
import FaqSection from "@/components/FaqSection";
import CTABanner from "@/components/CTABanner-template";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import type { Metadata } from "next";
import {
  getDentalVisionPageLd,
  getDentalVisionBreadcrumbLd,
} from "@/lib/seo/jsonld";

import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

/* ───────────────────────────────────────────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "dentalVisionPage.dentalVisionMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/dental-vision";
  const slug = localizedSlug(routeKey, locale); // "/dental-vision" (both locales)
  const canonical = withLocalePrefix(locale, slug); // "/en/dental-vision" or "/es/dental-vision"
  const languages = languageAlternatesPrefixed(routeKey); // { "en-US": "/en/dental-vision", "es-ES": "/es/dental-vision" }
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en")); // ✅ English page
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
      url: canonical, // resolved absolute via metadataBase in your root layout
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
    // robots omitted → defaults to index, follow
  };
}

/* Helper to pull an indexed testimonial as an object */
const testimonial = (t: (k: string) => string, idx: number) => ({
  name: t(`hero.testimonials.${idx}.name`),
  text: t(`hero.testimonials.${idx}.text`),
});

export default async function DentalVisionPage() {
  /* locale + translations */
  const locale = await getLocale(); // e.g. 'en', 'es'
  const trans = await getTranslations({
    locale,
    namespace: "dentalVisionPage",
  });

  /* Shortcuts */
  const t = trans;
  const tr = trans.rich;
  const strong = (chunks: React.ReactNode) => (
    <strong className="font-semibold text-blue-600 dark:text-blue-400">
      {chunks}
    </strong>
  );

  const pageLd = getDentalVisionPageLd(
    locale,
    t("hero.title"),
    t("hero.description")
  );

  const breadcrumbLd = getDentalVisionBreadcrumbLd(
    locale,
    t("dentalVisionMetadata.breadcrumbs.home"),
    t("dentalVisionMetadata.breadcrumbs.dentalVision")
  );

  return (
    <>
      <ServicePageTracker serviceName="Dental & Vision Plans" serviceCategory="dental-vision" />
      <div className="relative">
        <BackHome />
      </div>
      {/* HERO */}
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="tmp48ylol1v_1_ig0hto"
        imagePosition="left"
        cta={<DentalButton />}
        testimonials={[testimonial(t, 0)]}
        happyClient={{
          title: t("hero.happyClient.title"),
          subtitle: t("hero.happyClient.subtitle"),
        }}
      />

      {/* ABOUT */}
      <AboutSection
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<DentalButton />}
      />

      {/* WHAT IS AMERITAS */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="download_1_kgrurq"
        imagePosition="left"
        cta={<DentalButton />}
      />

      {/* SELF-ENROLL CARD */}
      <PlanEnrollCard
        title={t("selfEnroll.title")}
        subtitle={t("selfEnroll.subtitle")}
        cta={t("selfEnroll.cta")}
        link="https://myplan.ameritas.com/id/010A1380"
        imageUrl="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_96,dpr_auto/ameritas-transparent_1_bbjb2f.png"
        disclaimer={t("selfEnroll.disclaimer")}
        className="max-w-3xl mx-auto mt-24"
      />

      {/* ELIGIBILITY */}
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
        imagePublicId="pexels-shvetsa-3845653_v1r87k"
        imagePosition="left"
      />

      {/* ENROLLMENT STEPS */}
      <EnrollmentSection
        title={
          <>
            {t("enroll.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("enroll.headlineBold")}</span>
          </>
        }
        intro={t("enroll.intro")}
        steps={[t("enroll.intro"), t("enroll.intro")]}
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
        cta={t("selfEnroll.cta")}
        href="https://myplan.ameritas.com/id/010A1380"
      />

      {/* FAQ */}
      <FaqSection
        label={t("faqDental.label")}
        title={
          <>
            {t("faqDental.titleBeforeBold")}{" "}
            <span className="text-blue-800">{t("faqDental.titleBold")}</span>
          </>
        }
        faqs={Array.from({ length: 7 }).map((_, i) => ({
          question: t(`faqDental.items.${i}.q`),
          answer: t(`faqDental.items.${i}.a`),
        }))}
        imagePublicId="tmpft70mt0j_1_hppsqh"
      />

      {/* CTA BANNER */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<DentalButton />}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, breadcrumbLd]).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />
    </>
  );
}
