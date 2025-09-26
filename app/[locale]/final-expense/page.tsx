import HeroWithTestimonials from "@/components/hero-template";
import FEButton from "@/components/FEButton"; // simple wrapper like HIButton (or reuse your generic CTA)
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getFePageLd, getFeBreadcrumbLd } from "@/lib/seo/jsonld";

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
  const t = await getTranslations({ locale, namespace: "FEpage.feMetadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image =
    (t("image", {
      default:
        "https://www.isaacplans.com/images/final_expense_og_placeholder_en.png",
    }) as string) ||
    "https://www.isaacplans.com/images/final_expense_og_placeholder_en.png";
  const alt = t("imageAlt", { default: "Final Expense plans preview" });

  const routeKey = "/final-expense"; // es mapping expected → "/gastos-finales"
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

export default async function FinalExpensePage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "FEpage" });

  const pageLd = getFePageLd(locale, t("hero.title"), t("hero.description"));
  const crumbLd = getFeBreadcrumbLd(
    locale,
    t("feMetadata.breadcrumbs.home"),
    t("feMetadata.breadcrumbs.fe")
  );

  // Build FAQPage JSON-LD from current locale strings
  const faqItems = Array.from({ length: 7 }).map((_, i) => ({
    "@type": "Question",
    name: t(`faq.items.${i}.q`),
    acceptedAnswer: { "@type": "Answer", text: t(`faq.items.${i}.a`) },
  }));
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems,
  };

  return (
    <>
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="final_expense_hero_fbimsc"
        imagePosition="left"
        cta={<FEButton />}
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
        cta={<FEButton />}
      />

      {/* WHAT IS FINAL EXPENSE? ---------------------------------------- */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="feh2_orkuxu"
        imagePosition="left"
        cta={<FEButton />}
        testimonials={[]}
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
        imagePublicId="feh3_cy7giu"
        imagePosition="left"
      />

      {/* ENROLLMENT STEPS ---------------------------------------------- */}
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
        imagePublicId="feh4_rfwdsw"
        imagePosition="right"
        cta={t("selfEnroll.cta")}
        href="/contact"
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
        faqs={Array.from({ length: 7 }).map((_, i) => ({
          question: t(`faq.items.${i}.q`),
          answer: t(`faq.items.${i}.a`),
        }))}
        imagePublicId="tmpft70mt0j_1_hppsqh"
      />

      {/* CTA BANNER ----------------------------------------------------- */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<FEButton />}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd, faqLd]).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />
    </>
  );
}
