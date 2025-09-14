// app/[locale]/indexed-universal-life/calendar/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
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
  const t = await getTranslations({
    locale,
    namespace: "iulPage.calendar.meta",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/iul_en.png",
  }) as string;
  const alt = t("imageAlt", { default: "IUL appointment calendar" });

  // Add to routing.pathnames:
  // "/indexed-universal-life/calendar": {
  //   en: "/indexed-universal-life/calendar",
  //   es: "/indexed-universal-life/calendar"
  // }
  const routeKey = "/iul/calendar";
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

/* ───────── Page ───────── */
export default async function IulCalendarPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "iulPage.calendar" });

  // Back href to the main IUL page
  const iulRouteKey = "/iul";
  const iulSlug = localizedSlug(iulRouteKey as any, locale);
  const backHref = withLocalePrefix(locale, iulSlug);

  // AgentCRM calendar per locale
  const calendarSrc =
    locale === "es"
      ? "https://link.agent-crm.com/widget/booking/lilkHWZAPk2Xx41VMhfB"
      : "https://link.agent-crm.com/widget/booking/xy5oO9qhTMh3A2AGCM9v";

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-sm underline hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          aria-label={`${t("backButton")} – IUL`}
        >
          ← {t("backButton")}
        </Link>
      </nav>

      <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {t("title")}
      </h1>

      <section
        role="region"
        aria-label={t("title")}
        className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-sm"
      >
        <iframe
          src={calendarSrc}
          title={t("title")}
          loading="lazy"
          className="h-[900px] w-full"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </section>
    </main>
  );
}
