import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import HIButton from "@/components/HIButton";
import ShortTermCarriersSection from "@/components/shortterm-carriers-section";

import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import HeroWithTestimonialsGeneric from "@/components/hero-template";
import AboutSectionGeneric from "@/components/about-section-template";
import EligibilitySection from "@/components/eligibility-section";
import FaqSection from "@/components/FaqSection";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace:
      "uhone.shortterm.templateContent.uhone.shortterm.shorttermMain.stmMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/stmain.png",
  }) as string;
  const alt = t("imageAlt", {
    default: "Short Term Medical overview preview",
  });

  const routeKey = "/short-term-medical";
  const slug = localizedSlug(routeKey as any, locale);
  const canonical = withLocalePrefix(locale, slug);
  const languages = languageAlternatesPrefixed(routeKey as any);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey as any, "en"));
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

export default async function ShortTermMedicalPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const tem = await getTranslations({
    locale,
    namespace: "uhone.shortterm.templateContent.uhone.shortterm",
  });

  return (
    <div className="min-h-screen">
      {/* HERO ----------------------------------------------------------- */}
      <HeroWithTestimonialsGeneric
        badge={tem("hero.badge")}
        name={tem("hero.name")}
        title={tem("hero.title")}
        description={tem("hero.description")}
        imagePublicId="pexels-chokniti-khongchum-1197604-3938022_bujifm" /* your Cloudinary ID */
        imagePosition="left"
        /* CTA area: keep your CTA button AND the exact UHOne snippet with an accessible name */
        cta={<HIButton />}
        testimonials={[
          {
            name: tem("hero.testimonials.0.name"),
            text: tem("hero.testimonials.0.text"),
          },
        ]}
        happyClient={{
          title: tem("hero.happyClient.title"),
          subtitle: tem("hero.happyClient.subtitle"),
        }}
      />

      {/* ABOUT ISAAC --------------------------------------------------- */}
      <AboutSectionGeneric
        badge={tem("about.badge")}
        headline={tem("about.headline")}
        description={tem("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={tem("about.name")}
        role={tem("about.role")}
        credential={tem("about.credential")}
        cta={<HIButton />}
      />

      {/* WHAT IS STM (general) ---------------------------------------- */}
      <HeroWithTestimonialsGeneric
        badge=""
        name=""
        title={tem("definition.title")}
        description={tem("definition.description")}
        imagePublicId="pexels-thirdman-5327584_cfiman" /* your Cloudinary ID */
        imagePosition="right"
        cta={<HIButton />}
      />

      {/* ELIGIBILITY --------------------------------------------------- */}
      <EligibilitySection
        title={
          <>
            {tem("eligibility.headlineBeforeBold")}{" "}
            <span className="font-bold">{tem("eligibility.headlineBold")}</span>
          </>
        }
        intro={tem("eligibility.intro")}
        bullets={[
          tem("eligibility.bullets.0"),
          tem("eligibility.bullets.1"),
          tem("eligibility.bullets.2"),
          tem("eligibility.bullets.3"),
        ]}
        note={tem("eligibility.note")}
        imagePublicId="pexels-emma-bauso-1183828-2253879_1_1_udmuz2"
        imagePosition="left"
      />

      {/* CARRIERS ------------------------------------------------------ */}
      <ShortTermCarriersSection
        label={tem("carriersSection.label")}
        title={tem("carriersSection.title")}
        subtitle={tem("carriersSection.subtitle")}
        ctaLabel={tem("carriersSection.cta")}
        carriers={[
          {
            id: "uhone",
            name: tem("carriersSection.cards.uhone.name"),
            blurb: tem("carriersSection.cards.uhone.blurb"),
            href: tem("carriersSection.cards.uhone.href"),
          },
          {
            id: "pivot",
            name: tem("carriersSection.cards.pivot.name"),
            blurb: tem("carriersSection.cards.pivot.blurb"),
            href: tem("carriersSection.cards.pivot.href"),
          },
          {
            id: "manhattan",
            name: tem("carriersSection.cards.manhattan.name"),
            blurb: tem("carriersSection.cards.manhattan.blurb"),
            href: tem("carriersSection.cards.manhattan.href"),
          },
          {
            id: "allstate",
            name: tem("carriersSection.cards.allstate.name"),
            blurb: tem("carriersSection.cards.allstate.blurb"),
            href: tem("carriersSection.cards.allstate.href"),
          },
        ]}
      />

      {/* FAQ ----------------------------------------------------------- */}
      <FaqSection
        label={tem("faq.label")}
        title={
          <>
            {tem("faq.titleBeforeBold")}{" "}
            <span className="text-blue-800 dark:text-blue-400">
              {tem("faq.titleBold")}
            </span>
          </>
        }
        faqs={Array.from({ length: 7 }).map((_, i) => ({
          question: tem(`faq.items.${i}.q`),
          answer: tem(`faq.items.${i}.a`),
        }))}
        imagePublicId="tmph9wnbhil_wts4sf"
      />
    </div>
  );
}
