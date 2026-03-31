import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BackHome } from "@/components/back-home";
import ShortTermCarriersSection, {
  stmCarrierHeroUrl,
} from "@/components/shortterm-carriers-section";
import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "carriersIndex.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const routeKey = "/carriers";
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
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CarriersIndexPage() {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "carriersIndex" });

  const hub = (
    routeKey:
      | "/carriers/uhone"
      | "/carriers/pivot/shortterm"
      | "/carriers/manhattan"
      | "/carriers/manhattan/shortterm"
      | "/carriers/allstate"
  ) => withLocalePrefix(locale, localizedSlug(routeKey as any, locale));

  return (
    <div className="relative min-h-screen">
      <BackHome />
      <div className="mx-auto max-w-3xl px-4 pt-20 pb-6 text-center sm:px-6 md:pt-24 md:pb-8">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          {t("intro.title")}
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          {t("intro.subtitle")}
        </p>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
          <h2 className="text-center text-lg font-bold text-slate-900 dark:text-white">
            {t("guided.title")}
          </h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {t("guided.body")}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/get-covered-fast"
              className="inline-flex rounded-full bg-[hsl(var(--custom))] px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
            >
              {t("guided.linkMatch")}
            </Link>
            <Link
              href="/short-term-medical"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {t("guided.linkStm")}
            </Link>
            <Link
              href="/aca"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {t("guided.linkAca")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {t("guided.linkContact")}
            </Link>
          </div>
        </div>
      </div>

      <ShortTermCarriersSection
        label={t("section.label")}
        title={t("section.title")}
        ctaLabel={t("section.cta")}
        ctaLabelMobile={t("section.ctaMobile")}
        carriers={[
          {
            id: "uhone",
            name: t("cards.uhone.name"),
            blurb: t("cards.uhone.blurb"),
            bestFor: t("cards.uhone.bestFor"),
            notIdeal: t("cards.uhone.notIdeal"),
            timeNote: t("cards.uhone.timeNote"),
            href: hub("/carriers/uhone"),
            heroSrc: stmCarrierHeroUrl("pexels-august-de-richelieu-4260639_qgzqnk"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397412/uhone_logo_xbmein.jpg",
          },
          {
            id: "pivot",
            name: t("cards.pivot.name"),
            blurb: t("cards.pivot.blurb"),
            bestFor: t("cards.pivot.bestFor"),
            notIdeal: t("cards.pivot.notIdeal"),
            timeNote: t("cards.pivot.timeNote"),
            href: hub("/carriers/pivot/shortterm"),
            heroSrc: stmCarrierHeroUrl("pexels-pixabay-356040_kzryk7"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/pivothealth_logo_sabqbm.jpg",
          },
          {
            id: "manhattan",
            name: t("cards.manhattan.name"),
            blurb: t("cards.manhattan.blurb"),
            bestFor: t("cards.manhattan.bestFor"),
            notIdeal: t("cards.manhattan.notIdeal"),
            timeNote: t("cards.manhattan.timeNote"),
            href: hub("/carriers/manhattan"),
            heroSrc: stmCarrierHeroUrl("pexels-gabby-k-7114420_ev9ryf"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397411/manhatan_logo_g6cswk.jpg",
          },
          {
            id: "allstate",
            name: t("cards.allstate.name"),
            blurb: t("cards.allstate.blurb"),
            bestFor: t("cards.allstate.bestFor"),
            notIdeal: t("cards.allstate.notIdeal"),
            timeNote: t("cards.allstate.timeNote"),
            href: hub("/carriers/allstate"),
            heroSrc: stmCarrierHeroUrl("pexels-shvetsa-4421496_ex5gi4"),
            logoSrc:
              "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_400/v1774397414/allstate_logo_ungrkt.png",
          },
        ]}
      />
    </div>
  );
}
