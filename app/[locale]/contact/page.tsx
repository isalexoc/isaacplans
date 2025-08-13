// app/[locale]/contact/page.tsx  (server – no "use client")
import Image from "next/image";
import type { Metadata } from "next";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ContactForm from "@/components/contact-form"; // client island
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ogLocaleOf,
  localizedPath,
  languageAlternates,
  type SupportedLocale,
} from "@/lib/seo/i18n";
import type { WithContext, WebPage, BreadcrumbList } from "schema-dts";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";

/* ───────────────────────────────────────────── */
export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as SupportedLocale;
  const t = await getTranslations({
    locale,
    namespace: "contactPage.contactMetadata",
  });

  const title = t("title");
  const description = t("description");
  const keywords = t("keywords", { default: "" });
  const image = t("image");
  const alt = t("imageAlt");

  const routeKey = "/contact";
  const path = localizedPath(routeKey, locale); // /en/contact or /es/contacto (if you map it)
  const languages = languageAlternates(routeKey); // {"en-US": "/en/contact", "es-ES": "/es/contacto"}
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
      url: path, // resolved absolute via metadataBase in root layout
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
    robots: { index: true, follow: true },
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

  // JSON‑LD (localized)
  const pageLd: WithContext<WebPage> = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${localizedPath("/contact", locale)}#webpage`,
    url: localizedPath("/contact", locale),
    name: t("info.title"),
    description: t("info.description"),
    inLanguage: locale,
    about: { "@id": "https://isaacplans.com/#organization" },
  };

  const breadcrumbLd: WithContext<BreadcrumbList> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: t("contactMetadata.breadcrumbs.home"),
        item: localizedPath("/", locale),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("contactMetadata.breadcrumbs.contact"),
        item: localizedPath("/contact", locale),
      },
    ],
  };

  return (
    <>
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          {/* ▸ Heading */}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 animate-fadeUp">
            {t("info.title")}
          </h2>
          <p
            className="text-gray-700 dark:text-gray-300 mb-8 animate-fadeUp"
            style={{ animationDelay: "0.1s" }}
          >
            {t("info.description")}
          </p>

          {/* ▸ Card */}
          <Card
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 space-y-6 animate-fadeUp"
            style={{ animationDelay: "0.2s" }}
          >
            <CardContent className="p-0 space-y-6">
              {/* Avatar & role */}
              <div className="flex flex-col items-center">
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_150,h_150,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                  alt="Isaac Orraiz"
                  width={120}
                  height={120}
                  className="rounded-full shadow-md"
                  priority
                />
                <h3 className="text-xl font-semibold mt-3 text-gray-800 dark:text-white">
                  Isaac Orraiz
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("info.role")}
                </p>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-white font-medium">
                <a
                  href={`tel:${PHONE.replace(/[^0-9]/g, "")}`}
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.callLabel")}: {PHONE}
                </a>

                <a
                  href="mailto:info@isaacplans.com"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.buttons.email")}
                </a>

                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.buttons.whatsapp")}
                </a>

                <a
                  href="/isaac-orraiz.vcf"
                  download
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.addContact")}
                </a>

                {/* Locale-aware internal link */}
                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.buttons.website")}
                </Link>

                <a
                  href="https://link.agent-crm.com/widget/bookings/facebookad-b140f360-1a9d-4b4b-9fb1-0359979187d4-4c57e0d9-1b03-4305-935e-1369bd466bc1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  {t("info.buttons.schedule")}
                </a>
              </div>

              {/* Social row */}
              <div className="flex justify-center gap-6 mt-2 text-brand dark:text-accent">
                <a
                  href={sm.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                >
                  <Facebook className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href={sm.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                >
                  <Instagram className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href={sm.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                >
                  <Youtube className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href={sm.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-6 h-6 hover:scale-110 transition" />
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
