/* app/[locale]/hospital-indemnity/page.tsx – client component */
"use client";

import { useTranslations } from "next-intl";
import HeroWithTestimonials from "@/components/hero-template";
import DentalButton from "@/components/DentalButton";

export default function HospitalIndemnityPage() {
  const t = useTranslations("HIpage.hero"); // namespace path

  return (
    <HeroWithTestimonials
      badge={t("badge")}
      name={t("name")}
      title={t("title")}
      description={t("description")}
      imagePublicId="pexels-rdne-6129237_vbgahf_1_gfwx1z"
      imagePosition="left"
      cta={<DentalButton />}
      testimonials={[
        {
          name: t("testimonials.0.name"),
          text: t("testimonials.0.text"),
        },
      ]}
      happyClient={{
        title: t("happyClient.title"),
        subtitle: t("happyClient.subtitle"),
      }}
    />
  );
}
