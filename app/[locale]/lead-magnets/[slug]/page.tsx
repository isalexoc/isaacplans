import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { CheckCircle, Star, Download } from "lucide-react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { sanityFetch } from "@/sanity/lib/live";
import { LeadMagnetForm } from "@/components/lead-magnet-form";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { ogLocaleOf } from "@/lib/seo/i18n";
import { getLeadMagnetBreadcrumbLd } from "@/lib/seo/jsonld";
import { ShareButton } from "@/components/share-button";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

const LEAD_MAGNET_QUERY = `*[_type == "leadMagnet" && slug.current == $slug && locale == $locale && status == "published"][0] {
  _id,
  title,
  subtitle,
  locale,
  description,
  coverImage { asset->{ url }, alt },
  keyBenefits,
  targetAudience,
  downloadCount,
  generatedPdfUrl,
  publishedAt,
  category,
  relatedGuide->{ slug, locale },
  seo {
    metaTitle,
    metaDescription,
    focusKeyword,
    keywords
  },
  leadFormSettings {
    ctaHeadline,
    ctaSubtext,
    ctaButtonText,
    successMessage,
    agentCrmWorkflowId
  },
  promoImages {
    square,
    landscape
  }
}`;

const FIND_RELATED_QUERY = `*[
  _type == "leadMagnet"
  && locale == $targetLocale
  && status == "published"
  && relatedGuide->slug.current == $slug
  && relatedGuide->locale == $sourceLocale
][0]{ slug }`;

type LeadMagnet = {
  _id: string;
  title: string;
  subtitle: string;
  locale: string;
  description: unknown[];
  coverImage: { asset: { url: string }; alt: string } | null;
  keyBenefits: string[];
  targetAudience: string;
  downloadCount: number;
  generatedPdfUrl: string;
  publishedAt: string;
  category: string;
  relatedGuide: { slug: { current: string }; locale: string } | null;
  seo: {
    metaTitle?: string;
    metaDescription?: string;
    focusKeyword?: string;
    keywords?: string[];
  } | null;
  leadFormSettings: {
    ctaHeadline: string;
    ctaSubtext: string;
    ctaButtonText: string;
    successMessage: string;
    agentCrmWorkflowId?: string;
  } | null;
  promoImages?: { square?: string; landscape?: string } | null;
};

const descriptionComponents: PortableTextComponents = {
  block: {
    normal: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">{children}</p>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">{children}</h3>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300 mb-4">{children}</ul>
    ),
  },
  listItem: {
    bullet: ({ children }) => <li>{children}</li>,
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const fetchOptions = { next: { revalidate: 3600, tags: [`lead-magnet-${slug}`] } };

  const result = await sanityFetch({
    query: LEAD_MAGNET_QUERY,
    params: { slug, locale },
    ...fetchOptions,
  });

  const guide = result.data as LeadMagnet | null;
  if (!guide) return {};

  const title = guide.seo?.metaTitle ?? guide.title;
  const description = guide.seo?.metaDescription ?? guide.subtitle;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";
  const pathPrefix = locale === "es" ? "imanes-de-leads" : "lead-magnets";
  const canonical = `${siteUrl}/${locale}/${pathPrefix}/${slug}`;

  const relatedGuide = guide.relatedGuide;
  const alternateLocale = locale === "en" ? "es" : "en";
  const alternatePathPrefix = alternateLocale === "es" ? "imanes-de-leads" : "lead-magnets";
  const alternateUrl = relatedGuide?.slug?.current
    ? `${siteUrl}/${alternateLocale}/${alternatePathPrefix}/${relatedGuide.slug.current}`
    : undefined;

  // OG image: prefer pre-generated landscape promo (1200×630) → Cloudinary crop → empty
  const rawOgImage =
    guide.promoImages?.landscape ||
    (guide.coverImage?.asset?.url ? cloudinaryOgImageUrl(guide.coverImage.asset.url) : "");
  const ogImageAlt = `${title} — Isaac Plans Insurance`;

  return {
    title,
    description,
    keywords: guide.seo?.keywords ?? [],
    alternates: {
      canonical,
      ...(alternateUrl
        ? { languages: { [locale]: canonical, [alternateLocale]: alternateUrl } }
        : {}),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      type: "website",
      locale: ogLocaleOf(locale),
      alternateLocale: ogLocaleOf(alternateLocale),
      images: rawOgImage
        ? [{ url: rawOgImage, width: 1200, height: 630, alt: ogImageAlt }]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: rawOgImage ? [rawOgImage] : [],
    },
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";
const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "";

const UI_TEXT = {
  en: {
    freeDownload: "FREE DOWNLOAD",
    whatYoullLearn: "What You'll Learn",
    aboutThisGuide: "About This Guide",
    writtenFor: "Written for:",
    downloadedSingular: "person has downloaded this guide",
    downloadedPlural: "people have downloaded this guide",
    byAgency: "By Isaac Plans Insurance — Licensed Insurance Agency",
    preferToSpeak: "Prefer to speak with someone?",
    browseAll: "Browse all free guides →",
    guidesPath: "lead-magnets",
    defaultCta: {
      ctaHeadline: "Get Your Free Guide",
      ctaSubtext: "Enter your info below to download instantly — no spam, ever.",
      ctaButtonText: "Download Free Guide",
      successMessage: "Your guide is downloading now!",
    },
  },
  es: {
    freeDownload: "DESCARGA GRATIS",
    whatYoullLearn: "Lo Que Aprenderás",
    aboutThisGuide: "Sobre Esta Guía",
    writtenFor: "Escrito para:",
    downloadedSingular: "persona ha descargado esta guía",
    downloadedPlural: "personas han descargado esta guía",
    byAgency: "Por Isaac Plans Insurance — Agencia de Seguros con Licencia",
    preferToSpeak: "¿Prefiere hablar con alguien?",
    browseAll: "Ver todas las guías gratuitas →",
    guidesPath: "imanes-de-leads",
    defaultCta: {
      ctaHeadline: "Obtén Tu Guía Gratis",
      ctaSubtext: "Ingresa tus datos para descargar al instante — sin spam, nunca.",
      ctaButtonText: "Descargar Guía Gratis",
      successMessage: "¡Tu guía se está descargando ahora!",
    },
  },
} as const;

export default async function LeadMagnetPage({ params }: Props) {
  const { slug, locale } = await params;
  const fetchOptions = { next: { revalidate: 3600, tags: [`lead-magnet-${slug}`] } };

  let guide = (
    await sanityFetch({ query: LEAD_MAGNET_QUERY, params: { slug, locale }, ...fetchOptions })
  ).data as LeadMagnet | null;

  // Fallback: the header LocaleSwitcher may land on the same slug in the new locale.
  // If no direct match, find the paired guide via relatedGuide and redirect to its slug.
  if (!guide) {
    const alternateLocale = locale === "en" ? "es" : "en";
    const related = (
      await sanityFetch({
        query: FIND_RELATED_QUERY,
        params: { slug, sourceLocale: alternateLocale, targetLocale: locale },
        ...fetchOptions,
      })
    ).data as { slug: { current: string } } | null;

    if (related?.slug?.current) {
      const { redirect } = await import("next/navigation");
      const pathPrefix = locale === "es" ? "imanes-de-leads" : "lead-magnets";
      redirect(`/${locale}/${pathPrefix}/${related.slug.current}`);
    }
  }

  if (!guide) notFound();

  const relatedGuide = guide.relatedGuide;
  const alternateLocale = locale === "en" ? "es" : "en";
  const alternatePathPrefix = alternateLocale === "es" ? "imanes-de-leads" : "lead-magnets";

  const t = UI_TEXT[locale === "es" ? "es" : "en"];

  const coverImageUrl = guide.coverImage?.asset?.url ?? null;
  const coverImageAlt = guide.coverImage?.alt ?? guide.title;
  const downloadCount = guide.downloadCount ?? 0;

  const leadFormSettings = guide.leadFormSettings ?? t.defaultCta;

  const pathPrefix = locale === "es" ? "imanes-de-leads" : "lead-magnets";
  const canonicalUrl = `${SITE_URL}/${locale}/${pathPrefix}/${slug}`;
  const ogImageUrl =
    guide.promoImages?.landscape ||
    (coverImageUrl ? cloudinaryOgImageUrl(coverImageUrl) : "");

  const bookLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${canonicalUrl}#guide`,
    name: guide.title,
    description: guide.subtitle,
    url: canonicalUrl,
    inLanguage: locale === "es" ? "es-ES" : "en-US",
    ...(ogImageUrl ? { image: ogImageUrl } : {}),
    datePublished: guide.publishedAt,
    author: {
      "@type": "Person",
      name: "Isaac Orraiz",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Isaac Plans Insurance",
      url: SITE_URL,
    },
  };

  const breadcrumbLd = getLeadMagnetBreadcrumbLd({
    locale,
    slug,
    guideTitle: guide.title,
  });

  return (
    <>
      <Script
        id="lead-magnet-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookLd) }}
      />
      <Script
        id="lead-magnet-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      {/* 1. Hero */}
      <div className="relative w-full h-[480px] sm:h-[560px] overflow-hidden bg-gray-900">
        {coverImageUrl && (
          <Image
            src={coverImageUrl}
            alt={coverImageAlt}
            fill
            className="object-cover object-center opacity-70"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-gray-900/20" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 max-w-4xl mx-auto w-full">
          <span className="inline-flex items-center gap-1.5 bg-blue-500 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit mb-4">
            <Download className="w-3 h-3" />
            {t.freeDownload}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            {guide.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-200 max-w-2xl mb-4">{guide.subtitle}</p>
          <ShareButton title={guide.title} url={canonicalUrl} locale={locale} />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* 2. What You'll Learn */}
        {guide.keyBenefits && guide.keyBenefits.length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">
              {t.whatYoullLearn}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guide.keyBenefits.map((benefit, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">{benefit}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. About This Guide + Lead Form side-by-side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* About */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t.aboutThisGuide}</h2>
            {guide.description && Array.isArray(guide.description) && guide.description.length > 0 && (
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <PortableText value={(guide.description as any[]).slice(0, 2)} components={descriptionComponents} />
              </div>
            )}
            {guide.targetAudience && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
                <span className="font-semibold">{t.writtenFor}</span> {guide.targetAudience}
              </div>
            )}
          </section>

          {/* 4. Lead Capture Form */}
          <section>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-6 sm:p-8 sticky top-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {leadFormSettings.ctaHeadline}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{leadFormSettings.ctaSubtext}</p>
              <LeadMagnetForm
                slug={slug}
                category={guide.category}
                leadFormSettings={leadFormSettings}
              />
            </div>
          </section>
        </div>

        {/* 5. Trust section */}
        <section className="border-t border-gray-200 dark:border-gray-700 pt-10 text-center space-y-3">
          {downloadCount > 0 && (
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">{downloadCount.toLocaleString()}</span>{" "}
              {downloadCount === 1 ? t.downloadedSingular : t.downloadedPlural}
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.byAgency}</p>
          <div className="flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
        </section>

        {/* 6. Footer CTA */}
        <section className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center space-y-3 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 font-medium">{t.preferToSpeak}</p>
          {PHONE && (
            <a
              href={`tel:${PHONE}`}
              className="inline-block text-blue-600 dark:text-blue-400 hover:underline font-semibold text-lg"
            >
              {PHONE}
            </a>
          )}
          <div className="pt-2">
            <Link
              href={`/${locale}/${t.guidesPath}`}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              {t.browseAll}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
