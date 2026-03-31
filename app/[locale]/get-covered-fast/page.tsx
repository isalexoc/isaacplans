import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BackHome } from "@/components/back-home";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import { ArrowRight } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "getCoveredFastPage.metadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const routeKey = "/get-covered-fast";
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
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function GetCoveredFastPage() {
  const t = await getTranslations("getCoveredFastPage");

  const cards = ["aca", "stm", "carriers", "contact"] as const;

  return (
    <div className="relative min-h-screen">
      <BackHome />
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-8 text-center sm:px-6 md:pt-24">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t("hero.title")}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {t("hero.subtitle")}
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 px-4 pb-20 sm:px-6 md:grid-cols-2">
        {cards.map((key) => {
          const href =
            key === "aca"
              ? "/aca"
              : key === "stm"
                ? "/short-term-medical"
                : key === "carriers"
                  ? "/carriers"
                  : "/contact";
          return (
            <Link
              key={key}
              href={href}
              className="group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 text-left shadow-sm transition hover:border-[hsl(var(--custom)/0.35)] hover:shadow-md dark:border-slate-700 dark:bg-slate-900/70"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t(`cards.${key}.title`)}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t(`cards.${key}.body`)}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[hsl(var(--custom))]">
                {t(`cards.${key}.cta`)}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
