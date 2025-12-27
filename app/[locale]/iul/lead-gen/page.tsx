import type { Metadata } from "next";
import IULLeadGenForm from "@/components/iul-lead-gen-form";
import IULLeadGenTracker from "@/components/iul-lead-gen-tracker";
import { getLocale, getTranslations } from "next-intl/server";
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
  const t = await getTranslations({ locale, namespace: "iulLeadGen.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });

  const routeKey = "/iul/lead-gen";
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
    },
  };
}

export default async function IULLeadGenPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "iulLeadGen" });

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <IULLeadGenTracker />
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-6 md:py-12 lg:py-16">
        <div className="max-w-4xl mx-auto text-center mb-6 md:mb-12">
          <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 bg-gradient-to-r from-[#0ea5e9] to-[#2563eb] bg-clip-text text-transparent">
            <span className="md:hidden">{t("hero.titleMobile")}</span>
            <span className="hidden md:inline">{t("hero.title")}</span>
          </h1>
          <p className="text-sm md:text-xl text-muted-foreground mb-4 md:mb-8">
            <span className="md:hidden">{t("hero.descriptionMobile")}</span>
            <span className="hidden md:inline">{t("hero.description")}</span>
          </p>
        </div>

        {/* Form Section */}
        <div className="max-w-3xl mx-auto">
          <IULLeadGenForm />
        </div>

        {/* Trust Indicators */}
        <div className="max-w-4xl mx-auto mt-6 md:mt-12 text-center">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">
                {t("trustIndicators.freeConsultation.value")}
              </div>
              <p className="text-muted-foreground">
                {t("trustIndicators.freeConsultation.label")}
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">
                {t("trustIndicators.quickProcess.value")}
              </div>
              <p className="text-muted-foreground">
                {t("trustIndicators.quickProcess.label")}
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-[#0ea5e9] mb-2">
                {t("trustIndicators.expertGuidance.value")}
              </div>
              <p className="text-muted-foreground">
                {t("trustIndicators.expertGuidance.label")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
