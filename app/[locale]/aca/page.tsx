/* app/[locale]/aca/page.tsx – server component */
import { getLocale, getTranslations } from "next-intl/server";

import HeroWithTestimonials from "@/components/hero-template";
import AboutSection from "@/components/about-section-template";
import EligibilitySection from "@/components/eligibility-section";
import EnrollmentSection from "@/components/enrollment-section";
import PlanTiersSection from "@/components/plan-tiers-section";
import PlanOptionsSection from "@/components/plan-options-section";
import FaqSection from "@/components/FaqSection";
import CTABanner from "@/components/CTABanner-template";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import ACAButton from "@/components/ACAButton";
import { getAcaPageLd, getAcaBreadcrumbLd } from "@/lib/seo/jsonld";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: "acaPage.acaMetadata",
  });

  /* ― dynamic copy */
  const title = t("title");
  const description = t("description");
  const image = t("image", {
    // fallback while you pick the final OG cover
    default:
      "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1200,h_630,c_fill,g_auto/og_isaacplans.png",
  }) as string;
  const alt = t("imageAlt", { default: "ACA illustration" });

  return {
    title,
    description,
    keywords: t("keywords", { default: "" }),

    alternates: {
      canonical: `https://isaacplans.com/${locale}/aca`,
      languages: {
        en: "https://isaacplans.com/en/aca",
        es: "https://isaacplans.com/es/aca",
      },
    },

    openGraph: {
      title,
      description,
      url: `https://isaacplans.com/${locale}/aca`,
      siteName: "Isaac Plans Insurance",
      locale,
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

export default async function AcaPage() {
  /* locale-aware messages */
  const locale = await getLocale();
  const trans = await getTranslations({ locale, namespace: "acaPage" });
  const t = trans; // plain strings
  const tm = trans.markup; // returns string with HTML markup

  /* ---------- helpers to build arrays/objects ----------------------- */

  // first testimonial (index 0)
  const testimonial0 = {
    name: t("hero.testimonials.0.name"),
    text: t("hero.testimonials.0.text"),
  };

  // ACA metal tiers
  const tiers = ["0", "1", "2", "3"].map((i) => ({
    name: t(`tiers.plans.${i}.name`),
    color: t(`tiers.plans.${i}.color`),
    bullets: [
      t(`tiers.plans.${i}.bullets.0`),
      t(`tiers.plans.${i}.bullets.1`),
      t(`tiers.plans.${i}.bullets.2`),
    ],
  }));

  // Other plan options
  const planOptions = ["0", "1", "2", "3"].map((i) => ({
    name: t(`otherPlans.options.${i}.name`),
    description: t(`otherPlans.options.${i}.description`),
  }));

  // FAQ list (five items)
  const faqs = ["0", "1", "2", "3", "4"].map((i) => ({
    question: t(`faq.items.${i}.q`),
    answer: t(`faq.items.${i}.a`),
  }));

  /* ---------- JSON-LD objects ------------------------------------- */
  const pageLd = getAcaPageLd(locale, t("hero.title"), t("hero.description"));

  const breadcrumbLd = getAcaBreadcrumbLd(
    locale,
    t("acaMetadata.breadcrumbs.home"),
    t("acaMetadata.breadcrumbs.aca")
  );

  return (
    <>
      {/* HERO ---------------------------------------------------------- */}
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="tmpfs1tzoqj_1_qqzvsx"
        imagePosition="left"
        cta={<ACAButton />}
        testimonials={[testimonial0]}
        happyClient={{
          title: t("hero.happyClient.title"),
          subtitle: t("hero.happyClient.subtitle"),
        }}
      />

      {/* ABOUT --------------------------------------------------------- */}
      <AboutSection
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        imagePosition="left"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<ACAButton />}
      />

      {/* SELF-ENROLL CARD --------------------------------------------- */}
      <PlanEnrollCard
        title={t("selfEnroll.title")}
        subtitle={t("selfEnroll.subtitle")}
        cta={t("selfEnroll.cta")}
        link="https://www.healthsherpa.com/?_agent_id=isaacplans"
        imageUrl="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_96,dpr_auto/self_sherpa_yaamv0.png"
        disclaimer={t("selfEnroll.disclaimer")}
        className="max-w-3xl mx-auto mt-24"
      />

      {/* WHAT IS ACA --------------------------------------------------- */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="pexels-emma-bauso-1183828-2253879_1_zd87oq"
        imagePosition="left"
        cta={<ACAButton />}
      />

      {/* ELIGIBILITY --------------------------------------------------- */}
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
        ]}
        note={t("eligibility.note")}
        imagePublicId="tmp8ukl9fl1_m7udej"
        imagePosition="left"
      />

      {/* ENROLLMENT ---------------------------------------------------- */}
      <EnrollmentSection
        title={
          <>
            {t("enroll.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("enroll.headlineBold")}</span>
          </>
        }
        intro={t("enroll.intro")}
        steps={[
          tm("enroll.step1", { strong: (c) => `<strong>${c}</strong>` }),
          tm("enroll.step2", { strong: (c) => `<strong>${c}</strong>` }),
        ]}
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
        cta={<ACAButton />}
      />

      {/* PLAN TIERS ---------------------------------------------------- */}
      <PlanTiersSection
        title={
          <>
            {t("tiers.titleBeforeBold")}{" "}
            <span className="font-bold">{t("tiers.titleBold")}</span>
          </>
        }
        intro={t("tiers.intro")}
        tiers={tiers}
      />

      {/* OTHER PLAN OPTIONS ------------------------------------------- */}
      <PlanOptionsSection title={t("otherPlans.title")} options={planOptions} />

      {/* FAQ ----------------------------------------------------------- */}
      <FaqSection
        label={t("faq.label")}
        title={
          <>
            {t("faq.titleBeforeBold")}{" "}
            <span className="font-bold">{t("faq.titleBold")}</span>
          </>
        }
        faqs={faqs}
        imagePublicId="tmpft70mt0j_1_hppsqh"
        imagePosition="left"
      />

      {/* CTA BANNER ---------------------------------------------------- */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<ACAButton />}
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
