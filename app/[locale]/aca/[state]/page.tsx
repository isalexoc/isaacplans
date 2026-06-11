import HeroWithTestimonials from "@/components/hero-template";
import ACAButton from "@/components/ACAButton";
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
import { sanityFetch } from "@/sanity/lib/live";
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

const ACA_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "aca"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE = "https://isaacplans.com/images/aca.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `ACA Health Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Compare ACA marketplace health plans in ${n}. Licensed agent Isaac Orraiz helps ${n} residents find subsidized coverage and enroll in the right plan.`,
    metaKeywords: `ACA health insurance ${n}, Obamacare ${n}, marketplace plans ${n}, health insurance subsidies ${n}`,
    h1: `ACA Health Insurance in ${n}`,
    heroDescription: `Compare ACA marketplace plans in ${n} and find out if you qualify for subsidies. I am licensed in ${n} and ready to help you enroll in the right plan at no extra cost.`,
    stateSpecificFaqs: [
      {
        q: `Is ACA marketplace coverage available in ${n}?`,
        a: `Yes. ${n} residents can enroll in ACA marketplace plans during Open Enrollment (Nov 1 - Jan 15) or through a Special Enrollment Period if you qualify. I am licensed in ${n} and can help you compare plans and apply for premium tax credits.`,
      },
      {
        q: `Can I get a subsidy for health insurance in ${n}?`,
        a: `Most ${n} residents who earn between 100% and 400% of the federal poverty level qualify for premium tax credits that lower their monthly premium. Some may qualify for zero-premium plans. I will calculate your exact subsidy amount at no charge.`,
      },
      {
        q: `How do I enroll in an ACA plan in ${n}?`,
        a: `Enrollment is simple. We review your income and household size, compare plans on the ${n} marketplace, apply your subsidies, and complete your application — all in one call. Coverage can start as soon as the first of the following month.`,
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
  const canonical = `https://www.isaacplans.com/${locale}/aca/${state}`;
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `ACA health insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `ACA health insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function AcaStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) notFound();

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "acaPage" });
  const content = buildStateContent(stateInfo);

  const postsResult = await sanityFetch({ query: ACA_POSTS_QUERY, params: { locale } });
  const posts: SanityDocument[] = postsResult.data || [];

  const pageLd = getLobStatePageLd("aca", locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getLobStateBreadcrumbLd("aca", locale, state, "Home", "ACA Health Insurance", stateInfo.name);

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
      <ServicePageTracker serviceName={`ACA Health Insurance - ${stateInfo.name}`} serviceCategory="aca" />
      <div className="relative"><BackHome /></div>

      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="tmpfs1tzoqj_1_qqzvsx"
        imagePosition="left"
        cta={<ACAButton />}
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
        cta={<ACAButton />}
      />

      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="pexels-emma-bauso-1183828-2253879_1_zd87oq"
        imagePosition="left"
        cta={<ACAButton />}
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
        bullets={[t("eligibility.bullets.0"), t("eligibility.bullets.1"), t("eligibility.bullets.2")]}
        note={t("eligibility.note")}
        imagePublicId="tmp8ukl9fl1_m7udej"
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
                ACA Health Insurance Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/aca`}
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
        cta={<ACAButton />}
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
