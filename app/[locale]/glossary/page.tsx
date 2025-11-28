import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import GlossarySection from "@/components/GlossarySection";
import { BackHome } from "@/components/back-home";
import ACAButton from "@/components/ACAButton";
import HIButton from "@/components/HIButton";
import DentalButton from "@/components/DentalButton";
import IULButton from "@/components/IULButton";
import FEButton from "@/components/FEButton";
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
  const t = await getTranslations({ locale, namespace: "glossaryPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/glossary.png",
  }) as string;
  const alt = t("imageAlt", { default: "Insurance Glossary" });

  const routeKey = "/glossary";
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

/* ───────── Page ───────── */
export default async function GlossaryPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "glossaryPage" });

  // Category configuration with their respective CTA buttons
  // Order: IUL, ACA, Dental, Final Expense, Hospital Indemnity, Short Term Medical
  const categories = [
    {
      key: "iul",
      title: t("categories.iul.title"),
      description: t("categories.iul.description"),
      cta: <IULButton />,
      imagePublicId: "pexels-victor-l-19338-2790434_1_pr9bng",
    },
    {
      key: "aca",
      title: t("categories.aca.title"),
      description: t("categories.aca.description"),
      cta: <ACAButton />,
      imagePublicId: "tmpfs1tzoqj_1_qqzvsx",
    },
    {
      key: "dentalVision",
      title: t("categories.dentalVision.title"),
      description: t("categories.dentalVision.description"),
      cta: <DentalButton />,
      imagePublicId: "tmp48ylol1v_1_ig0hto",
    },
    {
      key: "finalExpense",
      title: t("categories.finalExpense.title"),
      description: t("categories.finalExpense.description"),
      cta: <FEButton />,
      imagePublicId: "feh2_orkuxu",
    },
    {
      key: "hospitalIndemnity",
      title: t("categories.hospitalIndemnity.title"),
      description: t("categories.hospitalIndemnity.description"),
      cta: <HIButton />,
      imagePublicId: "pexels-rdne-6129237_vbgahf_1_gfwx1z",
    },
    {
      key: "shortTermMedical",
      title: t("categories.shortTermMedical.title"),
      description: t("categories.shortTermMedical.description"),
      cta: <HIButton />,
      imagePublicId: "pexels-chokniti-khongchum-1197604-3938022_bujifm",
    },
  ];

  return (
    <main className="w-full flex flex-col overflow-x-hidden relative">
      <BackHome />
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            {t("hero.description")}
          </p>
        </div>
      </section>

      {/* Glossary Categories */}
      {categories.map((category, index) => {
        const terms = Array.from({ length: 12 }, (_, i) => ({
          term: t(`categories.${category.key}.terms.${i}.term`),
          definition: t(`categories.${category.key}.terms.${i}.definition`),
        }));

        return (
          <div key={category.key}>
            <GlossarySection
              label={category.title}
              title={
                <>
                  {t("glossarySection.titlePrefix")}{" "}
                  <span className="font-bold">{category.title}</span>
                </>
              }
              terms={terms}
              imagePublicId={category.imagePublicId}
              imagePosition={index % 2 === 0 ? "left" : "right"}
            />
            {/* CTA Section for each category */}
            <section className="py-12 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
              <div className="container mx-auto px-4 text-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {t("cta.title", { category: category.title })}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
                  {category.description}
                </p>
                <div className="flex justify-center">{category.cta}</div>
              </div>
            </section>
          </div>
        );
      })}
    </main>
  );
}

