/* Terms & Conditions – server component (no "use client") */
import { getTranslations, getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import {
  ogLocaleOf,
  localizedPath,
  languageAlternates,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({ locale, namespace: "termsPage.metadata" });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image =
    (t("image", {
      default: "https://www.isaacplans.com/images/terms_og_placeholder_en.png",
    }) as string) ?? "";
  const alt = t("imageAlt", {
    default:
      locale === "es" ? "Portada de Términos y Condiciones" : "Terms cover",
  });

  const routeKey = "/terms-of-service";
  const path = localizedPath(routeKey, locale); // /en/terms-of-service or /es/terminos-y-condiciones
  const languages = languageAlternates(routeKey);
  const ogLocale = ogLocaleOf(locale);

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
      url: path,
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

/* ───────────────────────────────────────────── */
export default async function TermsOfServicePage() {
  const t = await getTranslations("termsPage");

  /* pull structured sections */
  const sections = t.raw("sections") as Record<
    string,
    {
      title: string;
      content: string;
      items?: string[];
      limitations?: string[];
      details?: string[];
    }
  >;

  const toc = Object.values(sections).map(({ title }) => ({
    id: slugify(title),
    label: title,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-gradient-to-r from-primary/90 to-secondary/90 text-white relative">
        <div className="absolute inset-0 mix-blend-overlay bg-[url('/grid.svg')] opacity-10" />
        <div className="container  mx-auto px-4  py-24 relative z-10">
          <Link
            href="/"
            className="inline-flex items-center mb-8 text-white/80 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {t("back")}
          </Link>

          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            {t("title")}
          </h1>
          <p className="mt-2 text-white/80">{t("lastUpdated")}</p>
        </div>
      </header>

      {/* Body */}
      <main className="container mx-auto  py-16 grid md:grid-cols-[250px_1fr] gap-10 overflow-x-hidden">
        {/* Sticky TOC */}
        <aside className="hidden md:block sticky top-28 self-start">
          <nav aria-label="Table of contents" className="text-sm space-y-2">
            {toc.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="block px-3 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Article */}
        <article className="space-y-12">
          {Object.values(sections).map(
            ({ title, content, items, limitations, details }) => {
              const id = slugify(title);
              return (
                <section
                  key={id}
                  id={id}
                  className="relative scroll-mt-28 group bg-card border-l-4 border-primary/70 rounded-r-xl shadow-sm p-6 md:p-8 transition hover:shadow-md"
                >
                  <h2 className="text-2xl font-semibold text-primary mb-4">
                    {title}
                  </h2>

                  <div className="prose prose-gray dark:prose-invert md:prose-lg max-w-none">
                    <p>{content}</p>

                    {items && (
                      <ul>
                        {items.map((li) => (
                          <li key={li}>{subPhone(li)}</li>
                        ))}
                      </ul>
                    )}

                    {limitations && (
                      <>
                        <p className="font-medium mt-4">
                          {t("limitationsLabel")}
                        </p>
                        <ul className="list-disc pl-5">
                          {limitations.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </>
                    )}

                    {details && (
                      <ul className="!list-none space-y-1 mt-4">
                        {details.map((d) => (
                          <li key={d} className="font-medium">
                            {subPhone(d)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* deep-link anchor visible on lg+ */}
                  <a
                    href={`#${id}`}
                    aria-label="Link to section"
                    className="hidden lg:block opacity-0 group-hover:opacity-100 transition absolute -left-6 top-2 text-muted-foreground"
                  >
                    #
                  </a>
                </section>
              );
            }
          )}

          {/* CTA */}
          <div
            role="region"
            aria-labelledby="tos-cta-heading"
            className="text-center px-2"
          >
            <Card
              className="
      border-0 shadow-xl overflow-hidden
      bg-white/95 backdrop-blur
      dark:bg-gray-900/95
    "
            >
              {/* Brand top bar for visual anchor */}
              <div className="h-2 w-full bg-[hsl(var(--custom))]" />

              <CardContent className="p-6 sm:p-10">
                <h3
                  id="tos-cta-heading"
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight
                   text-gray-900 dark:text-white mb-3"
                >
                  {t("cta.headline")}
                </h3>

                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-200 mb-8 max-w-2xl mx-auto">
                  {t("cta.body")}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-stretch">
                  {/* Primary: Call */}
                  <a
                    href={`tel:${PHONE}`}
                    aria-label={`Call ${PHONE}`}
                    className="
            inline-flex items-center justify-center gap-2
            px-6 py-3 rounded-lg font-semibold text-lg
            bg-white text-gray-900
            border border-[hsl(var(--custom))]
            hover:bg-gray-50
            focus:outline-none focus-visible:ring-4
            focus-visible:ring-[hsl(var(--custom)/0.35)]
            focus-visible:ring-offset-2
            focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
            transition shadow-sm
          "
                  >
                    <span className="tabular-nums">{PHONE}</span>
                  </a>

                  {/* Secondary: Email */}
                  <a
                    href="mailto:info@isaacplans.com"
                    aria-label="Email info@isaacplans.com"
                    className="
            inline-flex items-center justify-center gap-2
            px-6 py-3 rounded-lg font-semibold
            text-gray-900 dark:text-white
            bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-700
            focus:outline-none focus-visible:ring-4
            focus-visible:ring-[hsl(var(--custom)/0.35)]
            focus-visible:ring-offset-2
            focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
            transition shadow-sm w-full sm:w-auto
          "
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                    <span className="truncate">{t("cta.email")}</span>
                  </a>
                </div>

                <p className="mt-6 text-xs text-gray-600 dark:text-gray-300">
                  Response within business hours · Se habla Español
                </p>
              </CardContent>
            </Card>
          </div>
        </article>
      </main>
    </div>
  );
}

/* Helpers */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const subPhone = (txt: string) => txt.replace("{{PHONE_NUMBER}}", PHONE);
