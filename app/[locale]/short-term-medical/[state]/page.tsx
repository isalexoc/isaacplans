import HeroWithTestimonials from "@/components/hero-template";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import CTABanner from "@/components/CTABanner-template";
import FaqSection from "@/components/FaqSection";
import EligibilitySection from "@/components/eligibility-section";
import AboutSectionGeneric from "@/components/about-section-template";
import { BackHome } from "@/components/back-home";
import ServicePageTracker from "@/components/service-page-tracker";
import type { Metadata } from "next";
import { getLobStatePageLd, getLobStateBreadcrumbLd } from "@/lib/seo/jsonld";
import Link from "next/link";
import { type SanityDocument } from "next-sanity";
import { client } from "@/sanity/lib/client";

export const dynamic = 'force-dynamic';
import { BlogPostCard } from "@/components/blog-post-card";
import { cloudinaryOgImageUrl } from "@/lib/blog-featured-image";
import {
  getStatesWithPagesForBuild,
  getLicensedStates,
  stateNameToSlug,
  type FeStateInfo,
} from "@/lib/licensed-states";
import { notFound } from "next/navigation";

const STM_POSTS_QUERY = `*[
  _type == "post"
  && defined(slug.current)
  && locale == $locale
  && status == "published"
  && category == "temporary-health-insurance"
]|order(publishedAt desc)[0...3]{
  _id, title, slug, publishedAt, image, locale, category, excerpt, readingTime
}`;

const OG_IMAGE = "https://www.isaacplans.com/images/stmain.png";

function buildStateContent(state: FeStateInfo) {
  const n = state.name;
  return {
    metaTitle: `Short-Term Medical Insurance in ${n} | Isaac Plans Insurance`,
    metaDescription: `Find affordable short-term medical insurance in ${n}. Flexible coverage terms, same-day decisions, and multiple carrier options — licensed agent serving ${n} residents.`,
    metaKeywords: `short-term medical insurance ${n}, temporary health insurance ${n}, gap coverage ${n}, short-term health plans ${n}`,
    h1: `Short-Term Medical Insurance in ${n}`,
    heroDescription: `Flexible, affordable temporary health coverage for ${n} residents. Choose coverage terms from 30 days to 12 months, get same-day approval, and protect yourself from unexpected medical bills.`,
    stateSpecificFaqs: [
      {
        q: `Is short-term medical insurance available in ${n}?`,
        a: `Yes. I am licensed in ${n} and work with multiple carriers that offer short-term medical plans to ${n} residents. Most plans are available year-round with no enrollment period restrictions.`,
      },
      {
        q: `How long can I keep a short-term health plan in ${n}?`,
        a: `Short-term plans in ${n} can typically provide coverage from 30 days up to 364 days, and in some cases can be renewed. These plans are ideal for coverage gaps, job transitions, or waiting for employer benefits to begin.`,
      },
      {
        q: `How quickly can I get covered in ${n}?`,
        a: `Most ${n} short-term medical applications are approved same day or within 24 hours, with coverage starting as soon as the next day. I will compare the best plans for your situation at no cost.`,
      },
    ],
    faqs: [
      {
        q: `Does short-term insurance cover pre-existing conditions in ${n}?`,
        a: `Most short-term plans in ${n} do not cover pre-existing conditions. If you have ongoing health needs, an ACA marketplace plan may be a better fit. I can help you compare both options to find the right coverage for your situation.`,
      },
      {
        q: `What does short-term medical insurance cover?`,
        a: `Short-term plans typically cover doctor visits, urgent care, emergency room care, hospitalization, and some diagnostic services. Coverage details vary by carrier and plan — I will walk you through the specifics before you apply.`,
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
  const canonical = `https://www.isaacplans.com/${locale}/short-term-medical/${state}`;
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
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Short-term medical insurance in ${stateInfo.name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [{ url: ogImageUrl, alt: `Short-term medical insurance in ${stateInfo.name}` }],
    },
  };
}

/* ───────── Page ───────── */
export default async function ShortTermMedicalStatePage({
  params,
}: {
  params: Promise<{ locale: string; state: string }>;
}) {
  const { locale, state } = await params;
  const stateInfo = await getStateInfo(state);
  if (!stateInfo) notFound();

  const content = buildStateContent(stateInfo);

  const posts: SanityDocument[] = await client.fetch(STM_POSTS_QUERY, { locale }) ?? [];

  const pageLd = getLobStatePageLd("short-term-medical", locale, state, content.metaTitle, content.metaDescription);
  const crumbLd = getLobStateBreadcrumbLd("short-term-medical", locale, state, "Home", "Short-Term Medical Insurance", stateInfo.name);

  const allFaqs = [...content.stateSpecificFaqs, ...content.faqs];

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
      <ServicePageTracker serviceName={`Short-Term Medical Insurance - ${stateInfo.name}`} serviceCategory="short-term-medical" />
      <div className="relative"><BackHome /></div>

      <HeroWithTestimonials
        badge="Licensed STM Expert"
        name="Isaac Orraiz"
        title={content.h1}
        description={content.heroDescription}
        imagePublicId="tmpfs1tzoqj_1_qqzvsx"
        imagePosition="left"
        cta={<ShortTermMedicalButton />}
        testimonials={[]}
        happyClient={{ title: "Happy Clients", subtitle: "Across the U.S." }}
      />

      <AboutSectionGeneric
        badge="Your Licensed Agent"
        headline="Temporary Coverage Without the Confusion"
        description="I specialize in short-term medical plans and help clients across multiple states find affordable gap coverage quickly. I compare carriers, explain exclusions, and make sure you understand exactly what you are buying."
        imagePublicId="isaacpic_c8kca5"
        name="Isaac Orraiz"
        role="Licensed Insurance Agent"
        credential="Health & Life Licensed"
        cta={<ShortTermMedicalButton />}
      />

      <EligibilitySection
        title={
          <>
            Who is Short-Term Medical{" "}
            <span className="font-bold">Right For?</span>
          </>
        }
        intro="Short-term medical insurance is a smart solution for people who need temporary coverage without the cost or restrictions of ACA plans."
        bullets={[
          "Between jobs or waiting for employer benefits to begin",
          "Missing Open Enrollment and ineligible for a Special Enrollment Period",
          "Early retirees waiting to qualify for Medicare",
          "College graduates no longer on a parent's plan",
        ]}
        note="Note: Short-term plans do not cover pre-existing conditions and are not a substitute for comprehensive ACA coverage."
        imagePublicId="tmp8ukl9fl1_m7udej"
        imagePosition="left"
      />

      <FaqSection
        label="Short-Term Medical FAQ"
        title={
          <>
            Common Questions About Short-Term Coverage in{" "}
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
                Short-Term Medical Articles
              </h2>
            </div>
            <Link
              href={`/${locale}/blog/category/temporary-health-insurance`}
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
        message="Looking for short-term health coverage? I will compare plans and find the best option for your budget."
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
        cta={<ShortTermMedicalButton />}
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
