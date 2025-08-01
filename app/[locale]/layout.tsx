import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import CrispChat from "@/components/crisp-chat";
import Header from "@/components/header";
import Footer from "@/components/footer";
import { getTranslations } from "next-intl/server";
import {
  agencyLd,
  siteLd,
  rootBreadcrumbLd,
  isaacPersonLd,
} from "@/lib/seo/jsonld";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();

  /* i18n */
  const t = await getTranslations({ locale, namespace: "layoutMetadata" });
  const title = t("title");
  const description = t("description");
  const image = t("image"); // 1200×630 URL
  const alt = t("imageAlt", {
    // new key (fallback provided)
    default: "Isaac Plans Insurance logo on a blue gradient background",
  });

  return {
    /* --- basic --- */
    title,
    description,
    keywords: t("keywords"),

    /* --- Open Graph --- */
    openGraph: {
      url: "https://isaacplans.com/",
      siteName: "Isaac Plans Insurance",
      locale,
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt, // -> og:image:alt
        },
      ],
    },

    /* --- Twitter --- */
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: image,
          alt, // -> twitter:image:alt
        },
      ],
    },
  };
}

const inter = Inter({ subsets: ["latin"] });

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className="scroll-smooth">
      <body
        className={`${inter.className} flex min-h-screen flex-col bg-white text-gray-900 overflow-x-hidden`}
      >
        <NextIntlClientProvider>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Toaster />
          <CrispChat />
          <Footer />
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              agencyLd,
              siteLd,
              rootBreadcrumbLd,
              isaacPersonLd, // ← moved here
            ]).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
