import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Shield, Clock, Info, ExternalLink } from "lucide-react";
import HIButton from "@/components/HIButton";

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
    namespace: "uhone.shortterm.stmMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image", {
    default: "https://www.isaacplans.com/images/stm.png",
  }) as string;
  const alt = t("imageAlt", {
    default: "Short Term Medical overview preview",
  });

  const routeKey = "/carriers/uhone/shortterm";
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
  const t = await getTranslations({ locale, namespace: "uhone.shortterm" });

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
              aria-label={t("hero.badge")}
            >
              {/* a11y: hide decorative icon from AT */}
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              {t("hero.badge")}
            </span>

            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {t("hero.title")}
            </h1>

            <p className="max-w-3xl text-muted-foreground">
              {t("hero.description.before")}{" "}
              <strong>{t("hero.description.bold")}</strong>{" "}
              {t("hero.description.after")}
            </p>

            {/* CTA: exact UHOne snippet + accessible name via aria-labelledby */}
            <div className="mt-4">
              {/* a11y: give the link a programmatic name without changing the image or URL */}
              <p
                id="uhone-apply-label"
                className="mb-2 text-sm text-muted-foreground"
              >
                <strong>{t("cta.label")}</strong>
              </p>

              {/* Do not alter the snippet below (URL/img). We only add aria-labelledby on <a>. */}
              <a
                href="https://shop.uhone.com/en/quote/census/shortterm?brokerid=AA5607941"
                aria-labelledby="uhone-apply-label"
              >
                <img
                  src="https://www.uhone.com/ContentManagement/FileAttachment.ashx?FilePath=/Short_Term_Banner_Btn.jpg"
                  alt="" /* decorative; name comes from aria-labelledby */
                />
              </a>
            </div>

            {/* Key points */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-card-foreground">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <p className="font-semibold">{t("cards.temp.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("cards.temp.body")}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-card-foreground">
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <p className="font-semibold">{t("cards.notAca.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("cards.notAca.body")}
                </p>
              </div>

              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-card-foreground">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <p className="font-semibold">{t("cards.quote.title")}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("cards.quote.body")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Federal STLDI notice (high-contrast, neutral) */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* a11y: increase contrast; avoid muted foreground here */}
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-50">
          <p className="text-sm leading-relaxed">
            <strong>{t("notice.title")}</strong> {t("notice.body.part1")}{" "}
            <strong>{t("notice.body.bold1")}</strong> {t("notice.body.part2")}{" "}
            <strong>{t("notice.body.bold2")}</strong> {t("notice.body.part3")}
          </p>
        </div>

        {/* General consumer guidance (non-carrier) */}
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-card-foreground">
              {t("guidance.useCases.title")}
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>{t("guidance.useCases.items.0")}</li>
              <li>{t("guidance.useCases.items.1")}</li>
              <li>{t("guidance.useCases.items.2")}</li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-card-foreground">
              {t("guidance.notInclude.title")}
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>{t("guidance.notInclude.items.0")}</li>
              <li>{t("guidance.notInclude.items.1")}</li>
              <li>{t("guidance.notInclude.items.2")}</li>
            </ul>
          </div>

          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-card-foreground">
              {t("guidance.beforeApply.title")}
            </h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>{t("guidance.beforeApply.items.0")}</li>
              <li>{t("guidance.beforeApply.items.1")}</li>
              <li>{t("guidance.beforeApply.items.2")}</li>
            </ul>
          </div>
        </div>

        <HIButton />

        {/* Disclosures */}
        <div className="mt-12 space-y-4 text-xs leading-relaxed text-muted-foreground">
          <p>
            <strong>{t("disclosures.underwriter.label")}</strong>{" "}
            {t("disclosures.underwriter.text")}
          </p>
          <p>
            <strong>{t("disclosures.notMEC.label")}</strong>{" "}
            {t("disclosures.notMEC.text")}
          </p>
          <p>
            <strong>{t("disclosures.linkUse.label")}</strong>{" "}
            {t("disclosures.linkUse.text")}
          </p>
          <p>{t("disclosures.footer")}</p>
        </div>
      </section>

      {/* a11y patch for 3rd-party chat close button (labels the button if present) */}
      <script
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              function labelChatClose(){
                var el = document.querySelector('button.lc_text-widget_prompt--prompt-close');
                if (el && !el.getAttribute('aria-label')) {
                  var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
                  var label = lang.startsWith('es') ? 'Cerrar' : 'Close';
                  el.setAttribute('aria-label', label);
                  el.setAttribute('title', label);
                }
              }
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', labelChatClose);
              } else {
                labelChatClose();
              }
            })();
          `,
        }}
      />
    </main>
  );
}
