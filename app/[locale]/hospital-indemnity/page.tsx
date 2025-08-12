/* app/[locale]/hospital-indemnity/page.tsx – client component */

import HeroWithTestimonials from "@/components/hero-template";
import HIButton from "@/components/HIButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import AboutSectionGeneric from "@/components/about-section-template";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getHiPageLd, getHiBreadcrumbLd } from "@/lib/seo/jsonld"; // new
import { routing } from "@/i18n/routing";

/* helpers */
const ogLocaleOf = (l: string) => (l === "es" ? "es_ES" : "en_US");
const routeKey = "/hospital-indemnity" as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as "en" | "es";
  const t = await getTranslations({ locale, namespace: "HIpage.hiMetadata" });

  const title = t("title");
  const description = t("description");
  const image =
    (t("image", {
      default:
        "https://www.isaacplans.com/images/hospital_indemnity_og_placeholder_en.png",
    }) as string) ?? "";
  const alt = t("imageAlt", { default: "Hospital Indemnity plans preview" });

  // build localized paths from your routing map
  const entry = routing.pathnames[routeKey] as { en: string; es: string };
  const path = `/${locale}${entry[locale]}`; // /en/hospital-indemnity or /es/indemnizacion-hospitalaria
  const languages = {
    "en-US": `/en${entry.en}`,
    "es-ES": `/es${entry.es}`,
  };

  const ogLocale = ogLocaleOf(locale);

  return {
    title,
    description,
    keywords: t("keywords", { default: "" }),
    alternates: {
      canonical: path,
      languages,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
    robots: { index: true, follow: true },
  };
}

export default async function HospitalIndemnityPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "HIpage" });
  const pageLd = getHiPageLd(locale, t("hero.title"), t("hero.description"));
  const crumbLd = getHiBreadcrumbLd(
    locale,
    t("hiMetadata.breadcrumbs.home"),
    t("hiMetadata.breadcrumbs.hi")
  );

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
        cta={<HIButton />}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
