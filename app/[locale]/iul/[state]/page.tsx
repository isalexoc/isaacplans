import HeroWithTestimonials from "@/components/hero-template";
import IULButton from "@/components/IULButton";
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

const IUL_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "iul"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE = "https://www.isaacplans.com/images/iul.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `Indexed Universal Life Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Build tax-free retirement income with IUL insurance in ${n}. Permanent life insurance with cash value growth linked to a market index — licensed agent serving ${n} residents.`,
    metaKeywords: `IUL insurance ${n}, indexed universal life ${n}, tax-free retirement ${n}, permanent life insurance ${n}`,
    h1: `Indexed Universal Life Insurance in ${n}`,
    heroDescription: `Grow tax-free wealth and leave a legacy with IUL in ${n}. Permanent life coverage with cash value linked to a market index — no market risk, flexible premiums, and tax-advantaged distributions for retirement.`,
    stateSpecificFaqs: [
      {
        q: `Is IUL insurance available in ${n}?`,
        a: `Yes. I am licensed in ${n} and work with multiple top-rated carriers that offer indexed universal life policies to ${n} residents of all income levels and ages.`,
      },
      {
        q: `How does IUL cash value work in ${n}?`,
        a: `Your IUL policy in ${n} builds cash value linked to a stock index (such as the S&P 500) with a floor that protects against market losses. The cash value grows tax-deferred and can be accessed tax-free through policy loans for retirement income.`,
      },
      {
        q: `Who is a good candidate for IUL insurance in ${n}?`,
        a: `${n} residents who have maxed out 401(k) and Roth IRA contributions and want additional tax-advantaged growth are ideal candidates. IUL is also popular for business owners, high-income earners, and anyone looking to leave a tax-free legacy.`,
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
  const canonical = `https://www.isaacplans.com/${locale}/iul/${state}`;
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `IUL insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `IUL insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function IulStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) notFound();

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "iulPage" });
  const content = buildStateContent(stateInfo);

  const posts: SanityDocument[] = await client.fetch(IUL_POSTS_QUERY, { locale }) ?? [];

  const pageLd = getLobStatePageLd("iul", locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getLobStateBreadcrumbLd("iul", locale, state, "Home", "IUL (Indexed Universal Life)", stateInfo.name);

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
      <ServicePageTracker serviceName={`IUL Insurance - ${stateInfo.name}`} serviceCategory="iul" />
      <div className="relative"><BackHome /></div>

      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="pexels-victor-l-19338-2790434_1_pr9bng"
        imagePosition="left"
        cta={<IULButton />}
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
        cta={<IULButton />}
      />

      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="moneyback_frolim"
        imagePosition="left"
        cta={<IULButton />}
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
                IUL Insurance Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/iul`}
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
        cta={<IULButton />}
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
