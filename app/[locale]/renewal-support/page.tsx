import { getLocale, getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackHome } from "@/components/back-home";
import { AlertTriangle, CheckCircle2, XCircle, ArrowRight, Calendar, DollarSign, Shield, Users, FileCheck, Phone, Mail } from "lucide-react";
import ACAButton from "@/components/ACAButton";
import CTABanner from "@/components/CTABanner-template";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { routing } from "@/i18n/routing";

/* ───────── SEO ───────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "renewalSupportPage.meta" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/renewal-support.png",
  }) as string;
  const alt = t("imageAlt", { default: "ACA Plan Renewal Support" });

  const routeKey = "/renewal-support" as keyof typeof routing.pathnames;
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
export default async function RenewalSupportPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "renewalSupportPage" });

  return (
    <main className="w-full flex flex-col overflow-x-hidden relative">
      <BackHome />
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {t("hero.title")}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-700 dark:text-gray-300 mb-6">
            {t("hero.description")}
          </p>
          <div className="flex justify-center">
            <ACAButton />
          </div>
        </div>
      </section>

      {/* Warning Section - Auto-Renewal Dangers */}
      <section className="py-16 bg-red-50 dark:bg-red-900/10 border-y-4 border-red-200 dark:border-red-800">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 md:p-12 border-4 border-red-300 dark:border-red-700">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0">
                <XCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                  {t("warning.title")}
                </h2>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-6">
                  {t("warning.description")}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {[
                { key: "0", icon: DollarSign },
                { key: "1", icon: Shield },
                { key: "2", icon: Users },
                { key: "3", icon: FileCheck },
              ].map(({ key, icon: Icon }) => (
                <div
                  key={key}
                  className="flex gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <Icon className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {t(`warning.risks.${key}.title`)}
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {t(`warning.risks.${key}.description`)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Process Diagram Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("process.title")}
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
              {t("process.description")}
            </p>
          </div>

          {/* Process Steps */}
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-blue-200 via-blue-400 to-blue-200 dark:from-blue-800 dark:via-blue-600 dark:to-blue-800 transform -translate-y-1/2 z-0" />

            <div className="grid md:grid-cols-5 gap-6 relative z-10">
              {[0, 1, 2, 3, 4].map((stepIndex) => {
                const step = t.raw(`process.steps.${stepIndex}`);
                return (
                  <div key={stepIndex} className="flex flex-col items-center">
                    {/* Step Number Circle */}
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white flex items-center justify-center text-2xl font-bold shadow-lg mb-4 relative z-10 border-4 border-white dark:border-gray-800">
                      {stepIndex + 1}
                    </div>
                    {/* Step Card */}
                    <Card className="w-full border-2 border-blue-200 dark:border-blue-800 shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-center text-gray-900 dark:text-white">
                          {step.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
                          {step.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-12 text-center">
            <ACAButton />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("benefits.title")}
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
              {t("benefits.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[0, 1, 2, 3, 4, 5].map((benefitIndex) => {
              const benefit = t.raw(`benefits.items.${benefitIndex}`);
              const icons: Record<string, typeof CheckCircle2> = {
                savings: DollarSign,
                protection: Shield,
                support: Users,
                expertise: FileCheck,
                updates: Calendar,
                default: CheckCircle2,
              };
              const Icon = icons[benefit.icon] || icons.default;

              return (
                <Card key={benefitIndex} className="border-2 border-blue-200 dark:border-blue-800 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                        {benefit.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 dark:text-gray-300">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t("comparison.title")}
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
              {t("comparison.description")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Auto-Renew Column */}
            <Card className="border-4 border-red-300 dark:border-red-700 shadow-xl">
              <CardHeader className="bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t("comparison.autoRenew.title")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {[0, 1, 2, 3, 4].map((itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {t(`comparison.autoRenew.items.${itemIndex}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Professional Help Column */}
            <Card className="border-4 border-green-300 dark:border-green-700 shadow-xl">
              <CardHeader className="bg-green-50 dark:bg-green-900/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t("comparison.professional.title")}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {[0, 1, 2, 3, 4].map((itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700 dark:text-gray-300">
                        {t(`comparison.professional.items.${itemIndex}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <ACAButton />
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<ACAButton />}
      />

      {/* Contact Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card className="shadow-xl border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {t("contact.title")}
              </CardTitle>
              <CardDescription className="text-lg text-gray-700 dark:text-gray-300">
                {t("contact.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40">
                    <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t("contact.phone.label")}
                    </p>
                    <a
                      href={`tel:${t("contact.phone.number")}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("contact.phone.number")}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/40">
                    <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {t("contact.email.label")}
                    </p>
                    <a
                      href={`mailto:${t("contact.email.address")}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {t("contact.email.address")}
                    </a>
                  </div>
                </div>
              </div>
              <div className="text-center pt-4">
                <ACAButton />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

