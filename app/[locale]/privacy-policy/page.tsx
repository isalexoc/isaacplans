import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import {
  ogLocaleOf,
  localizedPath,
  languageAlternates,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "privacyPolicy.metadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/privacy-policy";
  const path = localizedPath(routeKey, locale); // /en/privacy-policy or /es/politica-de-privacidad
  const languages = languageAlternates(routeKey); // {"en-US": "/en/privacy-policy", "es-ES": "/es/politica-de-privacidad"}
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
      url: path, // resolved absolute via metadataBase in layout
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

/* ────────────────────────────────────────────── */
export default async function PrivacyPolicyPage() {
  const t = await getTranslations("privacyPolicy");
  const sections = t.raw("sections") as Record<
    string,
    { title: string; content: string; items?: string[]; details?: string[] }
  >;

  const toc = Object.values(sections).map(({ title }) => ({
    id: slug(title),
    label: title,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* ▸ Hero */}
      <header className="bg-gradient-to-r from-primary/90 to-secondary/90 text-white relative">
        <div className="absolute inset-0 mix-blend-overlay bg-[url('/grid.svg')] opacity-10" />
        <div className="container mx-auto px-4 py-24 relative z-10">
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

      {/* ▸ Body */}
      <main className="container mx-auto py-16 grid md:grid-cols-[250px_1fr] gap-10 overflow-x-hidden">
        {/* TOC (desktop only) */}
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
          {Object.values(sections).map(({ title, content, items, details }) => {
            const id = slug(title);
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
                        <li key={li}>{replacePhone(li)}</li>
                      ))}
                    </ul>
                  )}
                  {details && (
                    <ul className="!list-none space-y-1">
                      {details.map((d) => (
                        <li key={d} className="font-medium">
                          {replacePhone(d)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* deep-link anchor – only on lg+ */}
                <a
                  href={`#${id}`}
                  aria-label="Link to section"
                  className="hidden lg:block opacity-0 group-hover:opacity-100 transition absolute -left-6 top-2 text-muted-foreground"
                >
                  #
                </a>
              </section>
            );
          })}

          {/* CTA */}
          <aside className="mt-8 rounded-xl bg-primary/5 border border-primary/20 py-8 px-4 w-72 md:w-full text-center mx-auto">
            <h3 className="text-xl font-semibold mb-2">{t("cta.headline")}</h3>
            <p className="mb-6 text-muted-foreground">{t("cta.body")}</p>

            <div className="flex flex-col sm:inline-flex sm:flex-row gap-3 justify-center">
              <a href={`tel:${PHONE}`} className="btn btn-primary">
                {t("cta.call")}
              </a>
              <a
                href="mailto:info@isaacplans.com"
                className="btn btn-outline sm:ml-2"
              >
                {t("cta.email")}
              </a>
            </div>
          </aside>
        </article>
      </main>
    </div>
  );
}

/* ───────── helpers ───────── */
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const replacePhone = (text: string) => text.replace("{{PHONE_NUMBER}}", PHONE);
