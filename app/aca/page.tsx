"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-aca";
import HeroWithTestimonials from "@/components/hero-with-testimonials";
import AboutSection from "@/components/AboutSection";
import EligibilitySection from "@/components/eligibility-section";
import EnrollmentSection from "@/components/enrollment-section";
import PlanTiersSection from "@/components/plan-tiers-section";
import PlanOptionsSection from "@/components/plan-options-section";
import FaqSection from "@/components/FaqSection";
import CTABanner from "@/components/CTABanner";

const page = () => {
  const { language } = useLanguage();
  const content = t[language];

  return (
    <>
      <HeroWithTestimonials
        badge={content.hero.badge}
        name={content.hero.name}
        title={content.hero.title}
        description={content.hero.description}
        imagePublicId="tmpfs1tzoqj_1_qqzvsx"
        imagePosition="left"
        testimonials={[
          {
            name: content.hero.testimonials[0].name,
            text: content.hero.testimonials[0].text,
          },
        ]}
        happyClient={{
          title: content.hero.happyClient.title,
          subtitle: content.hero.happyClient.subtitle,
        }}
      />
      <AboutSection
        badge={content.about.badge}
        headline={content.about.headline}
        description={content.about.description}
        imagePublicId="isaacpic_c8kca5"
        imagePosition="left"
        name={content.about.name}
        role={content.about.role}
        credential={content.about.credential}
        /* default CTA uses t.about.cta automatically 
         if you pass your own button, supply <Button>t.cta</Button> */
      />
      <HeroWithTestimonials
        badge=""
        name=""
        title={content.definition.title}
        description={content.definition.description}
        imagePublicId="pexels-emma-bauso-1183828-2253879_1_zd87oq"
        imagePosition="left"
      />
      <EligibilitySection
        title={
          <>
            {content.eligibility.headlineBeforeBold}{" "}
            <span className="font-bold">
              {content.eligibility.headlineBold}
            </span>
          </>
        }
        intro={content.eligibility.intro}
        bullets={[...content.eligibility.bullets]}
        note={content.eligibility.note}
        imagePublicId="tmp8ukl9fl1_m7udej" /* same id for both langs */
        imagePosition="left"
      />
      <EnrollmentSection
        title={
          <>
            {content.enroll.headlineBeforeBold}{" "}
            <span className="font-bold">{content.enroll.headlineBold}</span>
          </>
        }
        intro={content.enroll.intro}
        steps={[content.enroll.step1, content.enroll.step2]}
        subHeading={content.enroll.subHeading}
        bullets={[...content.enroll.bullets]}
        note={content.enroll.note}
        imagePublicId="tmph9wnbhil_wts4sf"
        imagePosition="right"
      />
      <PlanTiersSection
        title={
          <>
            {content.tiers.titleBeforeBold}{" "}
            <span className="font-bold">{content.tiers.titleBold}</span>
          </>
        }
        intro={content.tiers.intro}
        tiers={content.tiers.plans.map((plan) => ({
          ...plan,
          bullets: [...plan.bullets],
        }))}
      />
      <PlanOptionsSection
        title={content.otherPlans.title}
        options={[...content.otherPlans.options]}
      />
      <FaqSection
        label={content.faq.label}
        title={
          <>
            {content.faq.titleBeforeBold}{" "}
            <span className="font-bold">{content.faq.titleBold}</span>
          </>
        }
        faqs={content.faq.items.map(({ q, a }) => ({ question: q, answer: a }))}
        imagePublicId="tmpft70mt0j_1_hppsqh"
        imagePosition="left" /* or "right" */
      />
      <CTABanner
        message={content.ctaBanner.message}
        className="bg-blue-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200"
      />
    </>
  );
};

export default page;
