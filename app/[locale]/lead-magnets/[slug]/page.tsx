import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import { CheckCircle, Star, Download } from "lucide-react";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { sanityFetch } from "@/sanity/lib/live";
import { LeadMagnetForm } from "@/components/lead-magnet-form";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string; locale: string }>;
};

const LEAD_MAGNET_QUERY = `*[_type == "leadMagnet" && slug.current == $slug && status == "published"][0] {
  _id,
  title,
  subtitle,
  description,
  coverImage { asset->{ url }, alt },
  keyBenefits,
  targetAudience,
  downloadCount,
  generatedPdfUrl,
  publishedAt,
  category,
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
  }
}`;

type LeadMagnet = {
  _id: string;
  title: string;
  subtitle: string;
  description: unknown[];
  coverImage: { asset: { url: string }; alt: string } | null;
  keyBenefits: string[];
  targetAudience: string;
  downloadCount: number;
  generatedPdfUrl: string;
  publishedAt: string;
  category: string;
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
  const { slug } = await params;
  const fetchOptions = { next: { revalidate: 3600, tags: [`lead-magnet-${slug}`] } };

  const result = await sanityFetch({
    query: LEAD_MAGNET_QUERY,
    params: { slug },
    ...fetchOptions,
  });

  const guide = result.data as LeadMagnet | null;
  if (!guide) return {};

  const title = guide.seo?.metaTitle ?? guide.title;
  const description = guide.seo?.metaDescription ?? guide.subtitle;
  const ogImage = guide.coverImage?.asset?.url ?? "";

  return {
    title,
    description,
    keywords: guide.seo?.keywords ?? [],
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
    },
  };
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";
const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "";

export default async function LeadMagnetPage({ params }: Props) {
  const { slug, locale } = await params;
  const fetchOptions = { next: { revalidate: 3600, tags: [`lead-magnet-${slug}`] } };

  const result = await sanityFetch({
    query: LEAD_MAGNET_QUERY,
    params: { slug },
    ...fetchOptions,
  });

  const guide = result.data as LeadMagnet | null;
  if (!guide) notFound();

  const coverImageUrl = guide.coverImage?.asset?.url ?? null;
  const coverImageAlt = guide.coverImage?.alt ?? guide.title;
  const downloadCount = guide.downloadCount ?? 0;

  const defaultLeadFormSettings = {
    ctaHeadline: "Get Your Free Guide",
    ctaSubtext: "Enter your info below to download instantly — no spam, ever.",
    ctaButtonText: "Download Free Guide",
    successMessage: "Your guide is downloading now!",
  };

  const leadFormSettings = guide.leadFormSettings ?? defaultLeadFormSettings;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${SITE_URL}/${locale}/lead-magnets/${slug}#guide`,
    name: guide.title,
    description: guide.subtitle,
    url: `${SITE_URL}/${locale}/lead-magnets/${slug}`,
    publisher: {
      "@type": "Organization",
      name: "Isaac Plans Insurance",
    },
    ...(coverImageUrl ? { image: coverImageUrl } : {}),
    datePublished: guide.publishedAt,
  };

  return (
    <>
      <Script
        id="lead-magnet-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* 1. Hero */}
      <div className="relative w-full h-[480px] sm:h-[560px] overflow-hidden bg-gray-900">
        {coverImageUrl && (
          <Image
            src={coverImageUrl}
            alt={coverImageAlt}
            fill
            className="object-cover object-center opacity-60"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12 max-w-4xl mx-auto w-full">
          <span className="inline-flex items-center gap-1.5 bg-blue-500 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full w-fit mb-4">
            <Download className="w-3 h-3" />
            FREE DOWNLOAD
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-3">
            {guide.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-200 max-w-2xl">{guide.subtitle}</p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
        {/* 2. What You'll Learn */}
        {guide.keyBenefits && guide.keyBenefits.length > 0 && (
          <section>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-8">
              What You&apos;ll Learn
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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About This Guide</h2>
            {guide.description && Array.isArray(guide.description) && guide.description.length > 0 && (
              <div className="prose prose-gray dark:prose-invert max-w-none">
                <PortableText value={guide.description as any} components={descriptionComponents} />
              </div>
            )}
            {guide.targetAudience && (
              <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-lg px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
                <span className="font-semibold">Written for:</span> {guide.targetAudience}
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
              {downloadCount === 1 ? "person has" : "people have"} downloaded this guide
            </p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400">By Isaac Plans Insurance — Licensed Insurance Agency</p>
          <div className="flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
        </section>

        {/* 6. Footer CTA */}
        <section className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center space-y-3 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-700 dark:text-gray-300 font-medium">Prefer to speak with someone?</p>
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
              href={`/${locale}/lead-magnets`}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
            >
              Browse all free guides →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
