// components/Contact.tsx   (server – no "use client")
import Image from "next/image";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import ContactForm from "@/components/contact-form"; // client-island
import { Link } from "@/i18n/routing";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { WithContext, WebPage, BreadcrumbList } from "schema-dts";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";

export async function generateMetadata(): Promise<Metadata> {
  /* locale & i18n strings */
  const locale = await getLocale();
  const t = await getTranslations({
    locale,
    namespace: "contactPage.contactMetadata",
  });

  const title = t("title");
  const description = t("description");
  const image = t("image"); // 1200×630 URL
  const alt = t("imageAlt"); // alt-text for social previews

  return {
    title,
    description,
    keywords: t("keywords", { default: "" }), // optional; provide fallback

    alternates: {
      canonical: `https://isaacplans.com/${locale}/contact`,
      languages: {
        en: "https://isaacplans.com/en/contact",
        es: "https://isaacplans.com/es/contact",
      },
    },

    openGraph: {
      title,
      description,
      url: `https://isaacplans.com/${locale}/contact`,
      siteName: "Isaac Plans Insurance",
      locale,
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

export default async function Contact() {
  const t = await getTranslations("contactPage");

  /* ---- page-specific JSON-LD objects ---- */
  const locale = await getLocale();
  const pageLd: WithContext<WebPage> = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `https://isaacplans.com/${locale}/contact#webpage`,
    url: `https://isaacplans.com/${locale}/contact`,
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
        item: `https://isaacplans.com/${locale}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("contactMetadata.breadcrumbs.contact"),
        item: `https://isaacplans.com/${locale}/contact`,
      },
    ],
  };
  /* --------------------------------------- */

  return (
    <>
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          {/* ▸ Heading */}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 animate-fadeUp">
            {t("info.title")}
          </h2>
          <p
            className="text-gray-600 dark:text-gray-300 mb-8 animate-fadeUp"
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
                  📞 {t("info.callLabel")}: {PHONE}
                </a>

                <a
                  href="mailto:info@isaacplans.com"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  ✉️ {t("info.buttons.email")}
                </a>

                <a
                  href="https://wa.me/15406813507?text=Hola,%20quiero%20una%20cotización"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-whatsapp hover:bg-whatsapp/90 rounded-lg py-3"
                >
                  🟢 {t("info.buttons.whatsapp")}
                </a>

                <a
                  href="/isaac-orraiz.vcf"
                  download
                  className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 rounded-lg py-3"
                >
                  📲 {t("info.addContact")}
                </a>

                <Link
                  href="/"
                  className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 rounded-lg py-3"
                >
                  🌐 {t("info.buttons.website")}
                </Link>

                <a
                  href="https://link.agent-crm.com/widget/bookings/facebookad-b140f360-1a9d-4b4b-9fb1-0359979187d4-4c57e0d9-1b03-4305-935e-1369bd466bc1"
                  target="_blank"
                  className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
                >
                  📅 {t("info.buttons.schedule")}
                </a>
              </div>

              {/* Social row */}
              <div className="flex justify-center gap-6 mt-2 text-brand dark:text-accent">
                <a
                  href="https://www.facebook.com/@isaacagent"
                  target="_blank"
                  aria-label="Facebook"
                >
                  <Facebook className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href="https://www.instagram.com/isalexoc"
                  target="_blank"
                  aria-label="Instagram"
                >
                  <Instagram className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href="https://www.youtube.com/@isaacplans"
                  target="_blank"
                  aria-label="YouTube"
                >
                  <Youtube className="w-6 h-6 hover:scale-110 transition" />
                </a>
                <a
                  href="https://www.linkedin.com/in/isaacplans"
                  target="_blank"
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
