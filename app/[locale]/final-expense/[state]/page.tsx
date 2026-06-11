import HeroWithTestimonials from "@/components/hero-template";
import FEButton from "@/components/FEButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EnrollmentSectionGeneric from "@/components/enrollment-section-template";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getFeStatePageLd, getFeStateBreadcrumbLd } from "@/lib/seo/jsonld";
import Link from "next/link";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { BlogPostCard } from "@/components/blog-post-card";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import { type SupportedLocale } from "@/lib/seo/i18n";
import {
  getFinalExpenseStatesForBuild,
  getFeStateInfo,
  type FeStateInfo,
} from "@/lib/final-expense-states";
import { notFound } from "next/navigation";

const FE_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "final-expense"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE =
  "https://www.isaacplans.com/images/final_expense_og_placeholder_en.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `Final Expense Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Compare final expense insurance plans in ${n}. Licensed agent Isaac Orraiz helps ${n} seniors find affordable coverage with no medical exam required.`,
    metaKeywords: `final expense insurance ${n}, burial insurance ${n}, whole life insurance ${n}, senior life insurance ${n}`,
    h1: `Final Expense Insurance in ${n}`,
    heroDescription: `Affordable whole-life burial insurance for ${n} residents ages 45–85. No medical exam, level premiums, and same-day decisions — I'm licensed in ${n} and ready to help.`,
    stateSpecificFaqs: [
      {
        q: `Is final expense insurance available throughout ${n}?`,
        a: `Yes. I am licensed in ${n} and work with multiple carriers that issue final expense policies statewide, including rural and urban areas.`,
      },
      {
        q: `What does final expense insurance cost in ${n}?`,
        a: `Monthly premiums in ${n} typically range from $30–$150 depending on your age, health, and chosen benefit amount. Most carriers offer instant decisions with no waiting period for healthy applicants.`,
      },
      {
        q: `Can ${n} residents apply online?`,
        a: `Absolutely. Most ${n} applications are completed in under 10 minutes with just a few health questions — no exam or blood work required.`,
      },
    ],
  };
}

/* ───────── Static Params ───────── */
export async function generateStaticParams() {
  const states = await getFinalExpenseStatesForBuild();
  return states.map(({ slug }) => ({ state: slug }));
}

/* ───────── SEO ───────── */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}): Promise<Metadata> {
  const { locale, state } = await params;
  const stateInfo = await getFeStateInfo(state);
  if (!stateInfo) return { title: "Not found" };

  const content = buildStateContent(stateInfo);
  const canonical = `https://www.isaacplans.com/${locale}/final-expense/${state}`;
  const ogImageUrl = cloudinaryOgImageUrl(OG_IMAGE);

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    keywords: content.metaKeywords,
    alternates: {
      canonical,
      languages: {
        "en-US": canonical,
        "x-default": canonical,
      },
    },
    openGraph: {
      title: content.metaTitle,
      description: content.metaDescription,
      url: canonical,
      siteName: "Isaac Plans Insurance",
      locale: "en_US",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Final expense insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `Final expense insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function FinalExpenseStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getFeStateInfo(state);
  if (!stateInfo) notFound();

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "FEpage" });
  const content = buildStateContent(stateInfo);

  const fePosts: SanityDocument[] = await client.fetch(FE_POSTS_QUERY, { locale }) ?? [];

  const pageLd = getFeStatePageLd(locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getFeStateBreadcrumbLd(
    locale,
    state,
    "Home",
    "Final Expense Insurance",
    stateInfo.name
  );

  const allFaqs = [
    ...content.stateSpecificFaqs,
    { q: t("faq.items.0.q"), a: t("faq.items.0.a") },
    { q: t("faq.items.1.q"), a: t("faq.items.1.a") },
    { q: t("faq.items.4.q"), a: t("faq.items.4.a") },
    { q: t("faq.items.5.q"), a: t("faq.items.5.a") },
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
      <ServicePageTracker
        serviceName={`Final Expense Insurance - ${stateInfo.name}`}
        serviceCategory="final-expense"
      />
      <div className="relative">
        <BackHome />
      </div>

      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="final_expense_hero_fbimsc"
        imagePosition="left"
        cta={<FEButton />}
        testimonials={[
          {
            name: t("hero.testimonials.0.name"),
            text: t("hero.testimonials.0.text"),
          },
          {
            name: t("hero.testimonials.1.name"),
            text: t("hero.testimonials.1.text"),
          },
        ]}
        happyClient={{
          title: t("hero.happyClient.title"),
          subtitle: t("hero.happyClient.subtitle"),
        }}
      />

      {/* ABOUT ISAAC */}
      <AboutSectionGeneric
        badge={t("about.badge")}
        headline={t("about.headline")}
        description={t("about.description")}
        imagePublicId="isaacpic_c8kca5"
        name={t("about.name")}
        role={t("about.role")}
        credential={t("about.credential")}
        cta={<FEButton />}
      />

      {/* WHAT IS FINAL EXPENSE? */}
      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="feh2_orkuxu"
        imagePosition="left"
        cta={<FEButton />}
        testimonials={[]}
      />

      {/* ELIGIBILITY */}
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
        imagePublicId="feh3_cy7giu"
        imagePosition="left"
      />

      {/* ENROLLMENT STEPS */}
      <EnrollmentSectionGeneric
        title={
          <>
            {t("enroll.headlineBeforeBold")}{" "}
            <span className="font-bold">{t("enroll.headlineBold")}</span>
          </>
        }
        intro={t("enroll.intro")}
        steps={[t("enroll.steps.0"), t("enroll.steps.1")]}
        subHeading={t("enroll.subHeading")}
        bullets={[
          t("enroll.bullets.0"),
          t("enroll.bullets.1"),
          t("enroll.bullets.2"),
          t("enroll.bullets.3"),
        ]}
        note={t("enroll.note")}
        imagePublicId="feh4_rfwdsw"
        imagePosition="right"
        cta={t("selfEnroll.cta")}
        href="/contact"
      />

      {/* FAQ */}
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

      {/* RELATED BLOG ARTICLES */}
      {fePosts.length > 0 && (
        <section className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1">
                Learn More
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                Final Expense Insurance Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/final-expense`}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              View all articles
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fePosts.map((post) => (
              <BlogPostCard key={post._id} post={post} locale={locale} titleAs="h3" />
            ))}
          </div>
        </section>
      )}

      {/* CTA BANNER */}
      <CTABanner
        message={t("ctaBanner.message")}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<FEButton />}
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
