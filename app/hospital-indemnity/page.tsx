"use client";

import HeroWithTestimonials from "@/components/hero-template";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations-hi";
import DentalButton from "@/components/DentalButton";

const HospitalIndemnityPage = () => {
  const { language } = useLanguage();
  const content = translations[language];

  return (
    <HeroWithTestimonials
      badge={content.hero.badge}
      name={content.hero.name}
      title={content.hero.title}
      description={content.hero.description}
      imagePublicId="pexels-rdne-6129237_vbgahf_1_gfwx1z"
      imagePosition="left"
      cta={<DentalButton />}
      testimonials={[content.hero.testimonials[0]]}
      happyClient={content.hero.happyClient}
    />
  );
};

export default HospitalIndemnityPage;
