import HeroWithTestimonials from "@/components/hero-template";
import HIButton from "@/components/HIButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLobStatePageLd, getLobStateBreadcrumbLd } from "@/lib/seo/jsonld";
import Link from "next/link";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";

export const dynamic = 'force-dynamic';
import { BlogPostCard } from "@/components/blog-post-card";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { type SupportedLocale } from "@/lib/seo/i18n";
import {
  getStatesWithPagesForBuild,
  getLicensedStates,
  stateNameToSlug,
  type FeStateInfo,
} from "@/lib/licensed-states";
import { notFound } from "next/navigation";

const HI_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "hospital-indemnity"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE = "https://isaacplans.com/images/hi.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `Hospital Indemnity Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Find hospital indemnity plans in ${n}. Get fixed cash benefits paid directly to you for hospital stays, doctor visits, and surgeries — licensed agent serving ${n} residents.`,
    metaKeywords: `hospital indemnity insurance ${n}, supplemental health insurance ${n}, fixed benefit insurance ${n}, cash benefit plans ${n}`,
    h1: `Hospital Indemnity Insurance in ${n}`,
    heroDescription: `Fixed cash benefits paid directly to you for hospitalizations in ${n}. No network restrictions, no deductibles on the benefit — I am licensed in ${n} and can find the right plan for your budget.`,
    stateSpecificFaqs: [
      {
        q: `Is hospital indemnity insurance available in ${n}?`,
        a: `Yes. I am licensed in ${n} and work with multiple carriers that offer hospital indemnity plans to ${n} residents. Most plans are available year-round with no open enrollment restriction.`,
      },
      {
        q: `How do hospital indemnity benefits work in ${n}?`,
        a: `When you are hospitalized in ${n}, the plan pays a fixed daily or per-event cash benefit directly to you — regardless of what your primary insurance pays. You can use the money for medical bills, lost income, or any other expense.`,
      },
      {
        q: `Who should consider hospital indemnity insurance in ${n}?`,
        a: `${n} residents with high-deductible health plans, Medicare Advantage enrollees, or anyone who wants extra cash protection against unexpected hospital stays can benefit from a hospital indemnity policy.`,
      },
    ],
  };
}

async function getStateInfo(slug: string): Promise<FeStateInfo | null> {
  const states = await getLicensedStates();
  return states.find((s) => stateNameToSlug(s.name) === slug) ?? null;
}

/* ───────── Static Params ───────── */
export async function generateStaticParams() {
  const states = await getStatesWithPagesForBuild();
  return states.map(({ slug }) => ({ state: slug }));
}

/* ───────── SEO ───────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}): Promise<Metadata> {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) return { title: "Not found" };

  const content = buildStateContent(stateInfo);
  const canonical = `https://www.isaacplans.com/${locale}/hospital-indemnity/${state}`;
  const ogImageUrl = cloudinaryOgImageUrl(OG_IMAGE);

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords,
    alternates: {
      canonical,
      languages: { "en-US": canonical, "x-default": canonical },
    },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: "en_US",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Hospital indemnity insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `Hospital indemnity insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function HospitalIndemnityStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) notFound();

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "HIpage" });
  const content = buildStateContent(stateInfo);

  const posts: SanityDocument[] = await client.fetch(HI_POSTS_QUERY, { locale }) ?? [];

  const pageLd = getLobStatePageLd("hospital-indemnity", locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getLobStateBreadcrumbLd("hospital-indemnity", locale, state, "Home", "Hospital Indemnity Insurance", stateInfo.name);

  const allFaqs = [
    ...content.stateSpecificFaqs,
    { q: t("faq.items.0.q"), a: t("faq.items.0.a") },
    { q: t("faq.items.1.q"), a: t("faq.items.1.a") },
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <ServicePageTracker serviceName={`Hospital Indemnity Insurance - ${stateInfo.name}`} serviceCategory="hospital-indemnity" />
      <div className="relative"><BackHome /></div>

      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="pexels-rdne-6129237_vbgahf_1_gfwx1z"
        imagePosition="left"
        cta={<HIButton />}
        testimonials={[
          { name: t("hero.testimonials.0.name"), text: t("hero.testimonials.0.text") },
          { name: t("hero.testimonials.1.name"), text: t("hero.testimonials.1.text") },
        ]}
        happyClient={{ title: t("hero.happyClient.title"), subtitle: t("hero.happyClient.subtitle") }}
      />

      <AboutSectionGeneric
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<HIButton />}
      />

      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="moneyback_frolim"
        imagePosition="left"
        cta={<HIButton />}
        testimonials={[]}
      />

      <EligibilitySection
        title={
          <>
            {t("eligibility.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("eligibility.headlineBold")}</span>
          </>
        }
        intro={t("eligibility.intro")}
        bullets={[
          t("eligibility.bullets.0"),
          t("eligibility.bullets.1"),
          t("eligibility.bullets.2"),
          t("eligibility.bullets.3"),
        ]}
        note={t("eligibility.note")}
        imagePublicId="pexels-jibarofoto-2014773_wxjikn"
        imagePosition="left"
      />

      <FaqSection
        label={t("faq.label")}
        title={
          <>
            {t("faq.titleBeforeBold")}{" "}
            <span className="text-blue-800">{stateInfo.name}</span>
          </>
        }
        faqs={allFaqs.map((f) => ({ question: f.q, answer: f.a }))}
        imagePublicId="tmpft70mt0j_1_hppsqh"
      />

      {posts.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                Learn More
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Hospital Indemnity Insurance Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/hospital-indemnity`}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              View all articles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <BlogPostCard key={post._id} post={post} locale={locale} titleAs="h3" />
            ))}
          </div>
        </section>
      )}

      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<HIButton />}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([pageLd, crumbLd, faqLd]).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
