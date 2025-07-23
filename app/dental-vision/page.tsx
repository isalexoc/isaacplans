"use client";

import HeroWithTestimonials from "@/components/hero-template";
import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-dentalVision";
import DentalButton from "@/components/DentalButton";
import AboutSection from "@/components/about-section-template";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import EligibilitySection from "@/components/eligibility-section";

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
        imagePublicId="tmp48ylol1v_1_ig0hto"
        imagePosition="left"
        cta={<DentalButton />}
        testimonials={[content.hero.testimonials[0]]}
        happyClient={content.hero.happyClient}
      />
      <AboutSection
        badge={content.about.badge}
        headline={content.about.headline}
        description={content.about.description}
        imagePublicId="isaacpic_c8kca5"
        name={content.about.name}
        role={content.about.role}
        credential={content.about.credential}
        cta={<DentalButton />}
      />

      <HeroWithTestimonials
        badge=""
        name=""
        title={content.definition.title}
        description={content.definition.description}
        imagePublicId="download_1_kgrurq"
        imagePosition="left"
        cta={<DentalButton />}
      />
      <PlanEnrollCard
        title={content.selfEnroll.title}
        subtitle={content.selfEnroll.subtitle}
        cta={content.selfEnroll.cta}
        link="https://www.healthsherpa.com/?_agent_id=isaacplans"
        imageUrl="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_96,dpr_auto/ameritas-transparent_1_bbjb2f.png
      "
        disclaimer={content.selfEnroll.disclaimer}
        className="max-w-3xl mx-auto mt-24"
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
        imagePublicId="pexels-shvetsa-3845653_v1r87k" /* same id for both langs */
        imagePosition="left"
      />
    </>
  );
};

export default page;
