"use client";

import HeroWithTestimonials from "@/components/hero-template";
import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-dentalVision";
import DentalButton from "@/components/DentalButton";

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
        cta={<DentalButton />}
        testimonials={[content.hero.testimonials[0]]}
        happyClient={content.hero.happyClient}
      />
    </>
  );
};

export default page;
