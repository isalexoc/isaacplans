import Image from "next/image";
import type { Metadata } from "next";
import { Facebook, Instagram, Linkedin, Youtube, Phone, Mail, MessageCircle, UserPlus, Globe, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ContactForm from "@/components/contact-form"; // client island
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { WithContext, WebPage, BreadcrumbList } from "schema-dts";

import {
  ogLocaleOf,
  localizedSlug,
  withLocalePrefix,
  languageAlternatesPrefixed,
  type SupportedLocale,
} from "@/lib/seo/i18n";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";
const SITE_URL = "https://www.isaacplans.com"; // for absolute JSON-LD URLs
const abs = (p: string) => (p.startsWith("http") ? p : `${SITE_URL}${p}`);

/* ───────────────────────────────────────────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "contactPage.contactMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords");
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/contact";
  const slug = localizedSlug(routeKey, locale); // "/contact-me" or "/contacto"
  const canonical = withLocalePrefix(locale, slug); // "/en/contact-me" or "/es/contacto"
  const languages = languageAlternatesPrefixed(routeKey); // { "en-US": "/en/...", "es-ES": "/es/..." }
  const ogLocale = ogLocaleOf(locale);
  const xDefault = withLocalePrefix("en", localizedSlug(routeKey, "en")); // ✅ English page

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
      languages: { ...languages, "x-default": xDefault }, // x-default => "/en"
    },
    openGraph: {
      title,
      description,
      url: canonical, // resolved absolute via metadataBase in root layout
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
    // robots omitted → defaults to index, follow
  };
}

/* ───────────────────────────────────────────── */
export default async function ContactPage() {
  const t = await getTranslations("contactPage");
  const social = await getTranslations("social");
  const locale = (await getLocale()) as SupportedLocale;

  const sm = {
    facebook: social("facebook"),
    instagram: social("instagram"),
    youtube: social("youtube"),
    linkedin: social("linkedin"),
  };

  // Prefilled WhatsApp message (localized)
  const waMessage = encodeURIComponent(t("info.whatsappText"));
  const waLink = `https://wa.me/15406813507?text=${waMessage}`;

  const contactHref = withLocalePrefix(
    locale,
    localizedSlug("/contact", locale)
  ); // "/en/contact-me" or "/es/contacto"
  const homeHref = withLocalePrefix(locale, localizedSlug("/", locale)); // "/en" or "/es"

  // JSON‑LD (localized)
  const pageLd: WithContext<WebPage> = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${abs(contactHref)}#webpage`,
    url: abs(contactHref),
    name: t("info.title"),
    description: t("info.description"),
    inLanguage: locale,
    about: { "@id": `${SITE_URL}#organization` },
  };

  const breadcrumbLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("contactMetadata.breadcrumbs.home"),
        item: abs(homeHref),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("contactMetadata.breadcrumbs.contact"),
        item: abs(contactHref),
      },
    ],
  };

  return (
    <>
      <section
        className="relative py-16 lg:py-24 px-4 sm:px-6 lg:px-8 
                   bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-white to-[hsl(var(--custom)/0.04)] 
                   dark:bg-gray-950 overflow-hidden"
      >
        {/* Decorative background elements */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          {/* ▸ Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-4 leading-tight animate-fadeUp">
            {t("info.title")}
          </h2>
          <p
            className="text-lg lg:text-xl text-gray-700 dark:text-gray-300 mb-12 leading-relaxed animate-fadeUp"
            style={{ animationDelay: "0.1s" }}
          >
            {t("info.description")}
          </p>

          {/* ▸ Card */}
          <Card
            className="bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 rounded-2xl shadow-2xl border-2 border-gray-200/60 dark:border-gray-700/60 p-6 lg:p-8 space-y-6 animate-fadeUp"
            style={{ animationDelay: "0.2s" }}
          >
            <CardContent className="p-0 space-y-8">
              {/* Avatar & role */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent 
                               rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
                    aria-hidden="true"
                  />
                  <Image
                    src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_150,h_150,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                    alt="Isaac Orraiz"
                    width={140}
                    height={140}
                    className="rounded-full shadow-2xl border-4 border-white/50 group-hover:shadow-3xl transition-all duration-300"
                    priority
                    fetchPriority="high"
                  />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold mt-4 text-gray-900 dark:text-white">
                  Isaac Orraiz
                </h3>
                <p className="text-base lg:text-lg text-gray-600 dark:text-gray-400 mt-1">
                  {t("info.role")}
                </p>
              </div>

              {/* Action buttons */}
              <div
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                role="list"
                aria-label="Contact methods"
              >
                <a
                  href={`tel:${PHONE.replace(/[^0-9]/g, "")}`}
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={`Call ${PHONE}`}
                  role="listitem"
                >
                  <Phone className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.callLabel")}: {PHONE}</span>
                </a>

                <a
                  href="mailto:info@isaacplans.com"
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label="Send email to info@isaacplans.com"
                  role="listitem"
                >
                  <Mail className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.buttons.email")}</span>
                </a>

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={`${t("info.buttons.whatsapp")} (opens in new tab)`}
                  role="listitem"
                >
                  <MessageCircle className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.buttons.whatsapp")}</span>
                </a>

                <a
                  href="/isaac-orraiz.vcf"
                  download
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={t("info.addContact")}
                  role="listitem"
                >
                  <UserPlus className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.addContact")}</span>
                </a>

                {/* Locale-aware internal link */}
                <Link
                  href="/"
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={t("info.buttons.website")}
                  role="listitem"
                >
                  <Globe className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.buttons.website")}</span>
                </Link>

                <a
                  href="https://link.agent-crm.com/widget/bookings/facebookad-b140f360-1a9d-4b4b-9fb1-0359979187d4-4c57e0d9-1b03-4305-935e-1369bd466bc1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                             text-white font-semibold rounded-xl py-4 px-6 shadow-lg hover:shadow-xl
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={`${t("info.buttons.schedule")} (opens in new tab)`}
                  role="listitem"
                >
                  <Calendar className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm sm:text-base">{t("info.buttons.schedule")}</span>
                </a>
              </div>

              {/* Social row */}
              <div
                className="flex justify-center gap-6 pt-4 border-t border-gray-200/60 dark:border-gray-700/60"
                role="list"
                aria-label="Social media links"
              >
                <a
                  href={sm.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook (opens in new tab)"
                  className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                             text-[hsl(var(--custom))] hover:text-white
                             hover:bg-[hsl(var(--custom))] shadow-md hover:shadow-lg
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  role="listitem"
                >
                  <Facebook className="w-6 h-6" aria-hidden="true" />
                </a>
                <a
                  href={sm.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram (opens in new tab)"
                  className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                             text-[hsl(var(--custom))] hover:text-white
                             hover:bg-[hsl(var(--custom))] shadow-md hover:shadow-lg
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  role="listitem"
                >
                  <Instagram className="w-6 h-6" aria-hidden="true" />
                </a>
                <a
                  href={sm.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube (opens in new tab)"
                  className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                             text-[hsl(var(--custom))] hover:text-white
                             hover:bg-[hsl(var(--custom))] shadow-md hover:shadow-lg
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  role="listitem"
                >
                  <Youtube className="w-6 h-6" aria-hidden="true" />
                </a>
                <a
                  href={sm.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn (opens in new tab)"
                  className="p-3 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm
                             text-[hsl(var(--custom))] hover:text-white
                             hover:bg-[hsl(var(--custom))] shadow-md hover:shadow-lg
                             transition-all duration-300 hover:-translate-y-0.5
                             focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  role="listitem"
                >
                  <Linkedin className="w-6 h-6" aria-hidden="true" />
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* client island – form stays interactive */}
      <ContactForm />

      {/* JSON-LD (escaped) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, breadcrumbLd]).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />
    </>
  );
}
