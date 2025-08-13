/* app/[locale]/about/page.tsx – server component */
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import CTAButton from "@/components/cta-button";
import ContactForm from "@/components/contact-form"; // optional isle
import type { Metadata } from "next";
import { getAboutPageLd, getAboutBreadcrumbLd } from "@/lib/seo/jsonld";
import {
  ogLocaleOf,
  localizedPath,
  languageAlternates,
  type SupportedLocale,
} from "@/lib/seo/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "aboutPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://isaacplans.com/images/about.png",
  }) as string;
  const alt = t("imageAlt", { default: "Isaac Plans Insurance team photo" });

  const routeKey = "/about";
  const path = localizedPath(routeKey, locale); // e.g. /en/about or /es/sobre-mi
  const languages = languageAlternates(routeKey); // e.g. {"en-US": "/en/about","es-ES":"/es/sobre-mi"}
  const ogLocale = ogLocaleOf(locale); // en_US / es_ES

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: path,
      languages,
    },
    openGraph: {
      title,
      description,
      url: path, // resolved absolute via metadataBase in root layout
      siteName: "Isaac Plans Insurance",
      locale: ogLocale,
      alternateLocale: ogLocale === "en_US" ? ["es_ES"] : ["en_US"],
      type: "article",
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

export default async function AboutPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "aboutPage" });

  // If your JSON-LD helpers want a slug, keep your current convention:
  const aboutSlug = locale === "es" ? "sobre-mi" : "about";

  const pageLd = getAboutPageLd(
    locale,
    t("hero.heading"),
    t("meta.description"),
    aboutSlug
  );

  const crumbLd = getAboutBreadcrumbLd(
    locale,
    t("meta.breadcrumbs.home"),
    t("about.links.missionVision.title"),
    aboutSlug
  );

  return (
    <>
      {/* —————————————————— HERO —————————————————— */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.heading")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            {t("hero.subheading")}
          </p>
        </div>
      </section>

      {/* —————————————————— LINKS GRID —————————————————— */}
      <section className="px-4 py-16" aria-labelledby="about-links">
        {/* Add an H2 BEFORE the cards */}
        <h2 id="about-links" className="section-heading sr-only">
          {t("about.links.heading")} {/* e.g., "Explore this page" */}
        </h2>

        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-2">
          {[
            "missionVision",
            "whyChooseUs",
            "meetFounder",
            "contactSupport",
          ].map((key) => (
            <a
              key={key}
              href={`#${key}`}
              className="group rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md hover:border-brand transition relative overflow-hidden"
              aria-labelledby={`card-${key}-title`}
            >
              <span className="absolute inset-x-0 h-1 bg-brand scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
              {/* Now these H3s are valid because an H2 precedes them */}
              <h3
                id={`card-${key}-title`}
                className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
              >
                {t(`about.links.${key}.title`)}
              </h3>
              <p className="text-gray-700 dark:text-gray-400">
                {t(`about.links.${key}.description`)}
              </p>
              <ArrowRight className="mt-4 w-5 h-5 text-brand opacity-0 group-hover:opacity-100 transition" />
            </a>
          ))}
        </div>
      </section>

      {/* —————————————————— MISSION & VISION —————————————————— */}
      <section
        id="missionVision"
        className="bg-gray-50 dark:bg-gray-900 px-4 py-20"
      >
        <div className="mx-auto max-w-5xl grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="section-heading">{t("mission.heading")}</h2>
            <p className="section-paragraph">{t("mission.body")}</p>
            <h3 className="mt-8 font-bold text-gray-900 dark:text-white">
              {t("vision.heading")}
            </h3>
            <p className="section-paragraph">{t("vision.body")}</p>
          </div>

          <Image
            src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,h_400,c_fill,g_auto/v1754584948/og_isaacplans_1_zthxlb.png"
            alt="Mission & Vision"
            width={600}
            height={400}
            className="rounded-xl shadow-lg object-cover"
          />
        </div>
      </section>

      {/* —————————————————— WHY CHOOSE US —————————————————— */}
      <section id="whyChooseUs" className="px-4 py-20">
        <div className="mx-auto max-w-5xl grid lg:grid-cols-2 gap-10 items-center">
          <Image
            src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,h_400,c_fill,g_auto/v1753717733/image_1_rbtjmb.png"
            alt="Why choose us"
            width={600}
            height={400}
            className="rounded-xl shadow-lg object-cover"
          />

          <div>
            <h2 className="section-heading">{t("why.heading")}</h2>
            <ul className="space-y-4 leading-relaxed text-gray-700 dark:text-gray-300">
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="mt-1 inline-block size-2 rounded-full bg-brand" />
                  <span>{t(`why.points.${i}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* —————————————————— MEET THE FOUNDER —————————————————— */}
      <section
        id="meetFounder"
        className="bg-gray-50 dark:bg-gray-900 px-4 py-24"
      >
        <div className="mx-auto max-w-4xl text-center">
          <Image
            src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_200,h_200,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
            alt="Isaac Orraiz"
            width={180}
            height={180}
            className="mx-auto rounded-full shadow-lg ring-2 ring-brand mb-6"
          />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t("founder.heading")}
          </h2>
          <p className="mx-auto max-w-2xl text-gray-700 dark:text-gray-300 leading-relaxed">
            {t("founder.bio")}
          </p>
        </div>
      </section>

      {/* —————————————————— CONTACT & SUPPORT —————————————————— */}
      <section id="contactSupport" className="py-24">
        <div className="flex flex-col justify-center items-center px-4 mb-20">
          <h2 className="section-heading">{t("support.heading")}</h2>
          <p className="section-paragraph mb-8">{t("support.body")}</p>
          <CTAButton />
        </div>

        {/* Form island */}
        <ContactForm />
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd]).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
