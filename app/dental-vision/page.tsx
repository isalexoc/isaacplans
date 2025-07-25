"use client";

import HeroWithTestimonials from "@/components/hero-template";
import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-dentalVision";
import DentalButton from "@/components/DentalButton";
import AboutSection from "@/components/about-section-template";
import PlanEnrollCard from "@/components/SelfEnrollSection";
import EligibilitySection from "@/components/eligibility-section";
import EnrollmentSection from "@/components/enrollment-section-template";

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
        link="https://myplan.ameritas.com/id/010A1380"
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
        cta={content.selfEnroll.cta}
      />
    </>
  );
};

export default page;
