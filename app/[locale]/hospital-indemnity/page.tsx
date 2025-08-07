/* app/[locale]/hospital-indemnity/page.tsx – client component */
"use client";

import { useTranslations } from "next-intl";
import HeroWithTestimonials from "@/components/hero-template";
import HIButton from "@/components/HIButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import AboutSectionGeneric from "@/components/about-section-template";

export default function HospitalIndemnityPage() {
  const t = useTranslations("HIpage"); // namespace path

  return (
    <>
      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={t("hero.title")}
        description={t("hero.description")}
        imagePublicId="pexels-rdne-6129237_vbgahf_1_gfwx1z"
        imagePosition="left"
        cta={<HIButton />}
        testimonials={[
          {
            name: t("hero.testimonials.0.name"),
            text: t("hero.testimonials.0.text"),
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
        cta={<HIButton />}
      />

      {/* WHAT IS HOSPITAL INDEMNITY? ----------------------------------- */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="moneyback_frolim"
        imagePosition="left"
        cta={<HIButton />}
      />

      {/* SELF-ENROLL / PLAN CARDS -------------------------------------- */}
      <PlanEnrollCard
        title={t("selfEnroll.allstate.title")}
        subtitle={t("selfEnroll.allstate.subtitle")}
        cta={t("selfEnroll.cta")}
        link="https://customer.enroll.natgenhealth.com/quick-quote/?agent=CfDJ8JkkUhL7-q1LjFdip3ceampdxm7xpscBkQtjIAz_HchUER8Pocs95dR73rAoRokouSmOgpIQZluR9A-Iz9qO2uNUPQ&product=all-products"
        imageUrl="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_96/download_psjob8.png"
        disclaimer={t("selfEnroll.disclaimer")}
        className="max-w-3xl mx-auto mt-24"
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
        imagePublicId="tmph9wnbhil_wts4sf"
        imagePosition="right"
        cta={t("selfEnroll.cta")}
        href="https://customer.enroll.natgenhealth.com/quick-quote/?agent=CfDJ8JkkUhL7-q1LjFdip3ceampdxm7xpscBkQtjIAz_HchUER8Pocs95dR73rAoRokouSmOgpIQZluR9A-Iz9qO2uNUPQ&product=all-products" /* optional: direct link */
      />

      {/* FAQ ------------------------------------------------------------ */}
      <FaqSection
        label={t("faq.label")}
        title={
          <>
            {t("faq.titleBeforeBold")}{" "}
            <span className="text-custom">{t("faq.titleBold")}</span>
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
        cta={<HIButton />}
      />
    </>
  );
}
