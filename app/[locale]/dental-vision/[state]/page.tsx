import HeroWithTestimonials from "@/components/hero-template";
import DentalButton from "@/components/DentalButton";
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

const DV_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "dental-vision"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE = "https://isaacplans.com/images/dental.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `Dental & Vision Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Compare affordable dental and vision insurance plans in ${n}. Find individual and family coverage with no waiting period for preventive care — licensed agent serving ${n} residents.`,
    metaKeywords: `dental insurance ${n}, vision insurance ${n}, dental and vision plans ${n}, affordable dental ${n}`,
    h1: `Dental & Vision Insurance in ${n}`,
    heroDescription: `Find affordable dental and vision coverage for ${n} residents. Individual and family plans with no waiting period for preventive care, immediate coverage for major procedures, and same-day decisions.`,
    stateSpecificFaqs: [
      {
        q: `Is dental and vision insurance available in ${n}?`,
        a: `Yes. I am licensed in ${n} and work with multiple carriers that offer standalone dental and vision plans to individuals and families. Plans are available year-round with no employer required.`,
      },
      {
        q: `Is there a waiting period for dental coverage in ${n}?`,
        a: `Many plans available to ${n} residents have no waiting period for preventive care such as cleanings and exams. Some plans also offer immediate or short waiting periods for basic and major restorative work — I will compare options to match your needs.`,
      },
      {
        q: `How do I find the best dental plan in ${n}?`,
        a: `I will compare ${n} network coverage, annual maximum benefits, premium costs, and waiting periods across multiple carriers at no cost to you. Most ${n} applications are completed in under 10 minutes and coverage starts the following month.`,
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
  const canonical = `https://www.isaacplans.com/${locale}/dental-vision/${state}`;
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Dental and vision insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `Dental and vision insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function DentalVisionStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) notFound();

  const supportedLocale = locale as SupportedLocale;
  const t = await getTranslations({ locale: supportedLocale, namespace: "dentalVisionPage" });
  const content = buildStateContent(stateInfo);

  const postsResult = await sanityFetch({ query: DV_POSTS_QUERY, params: { locale } });
  const posts: SanityDocument[] = postsResult.data || [];

  const pageLd = getLobStatePageLd("dental-vision", locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getLobStateBreadcrumbLd("dental-vision", locale, state, "Home", "Dental & Vision Insurance", stateInfo.name);

  const allFaqs = [
    ...content.stateSpecificFaqs,
    { q: t("faqDental.items.0.q"), a: t("faqDental.items.0.a") },
    { q: t("faqDental.items.1.q"), a: t("faqDental.items.1.a") },
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
      <ServicePageTracker serviceName={`Dental & Vision Insurance - ${stateInfo.name}`} serviceCategory="dental-vision" />
      <div className="relative"><BackHome /></div>

      <HeroWithTestimonials
        badge={t("hero.badge")}
        name={t("hero.name")}
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="tmp48ylol1v_1_ig0hto"
        imagePosition="left"
        cta={<DentalButton />}
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
        cta={<DentalButton />}
      />

      <HeroWithTestimonials
        badge=""
        name=""
        title={t("definition.title")}
        description={t("definition.description")}
        imagePublicId="download_1_kgrurq"
        imagePosition="left"
        cta={<DentalButton />}
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
        imagePublicId="pexels-shvetsa-3845653_v1r87k"
        imagePosition="left"
      />

      <FaqSection
        label={t("faqDental.label")}
        title={
          <>
            {t("faqDental.titleBeforeBold")}{" "}
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
                Dental & Vision Insurance Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/dental-vision`}
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
        cta={<DentalButton />}
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
