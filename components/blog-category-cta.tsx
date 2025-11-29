"use client";

import { useLocale } from "next-intl";
import ACAButton from "@/components/ACAButton";
import IULButton from "@/components/IULButton";
import DentalButton from "@/components/DentalButton";
import FEButton from "@/components/FEButton";
import HIButton from "@/components/HIButton";
import CTAButtonMain from "@/components/cta-button-main";

interface BlogCategoryCTAProps {
  category: string;
}

/**
 * Maps blog post categories (Primary Category/LOB) to their corresponding CTA buttons.
 * For the 6 main LOBs, uses specific CTA buttons. For other categories, uses general contact CTA.
 */
export default function BlogCategoryCTA({ category }: BlogCategoryCTAProps) {
  const locale = useLocale();

  // Get CTA title based on category - friendly and industry standard
  const getCTATitle = () => {
    if (locale === "en") {
      return "Need Help?";
    } else {
      return "¿Necesitas Ayuda?";
    }
  };

  // Map category to CTA component
  const getCTA = () => {
    switch (category) {
      case "aca":
        return <ACAButton />;
      case "short-term-medical":
        return <HIButton />; // Short Term Medical uses Hospital Indemnity button
      case "dental-vision":
        return <DentalButton />;
      case "hospital-indemnity":
        return <HIButton />;
      case "iul":
        return <IULButton />;
      case "final-expense":
        return <FEButton />;
      default:
        // For other categories (cancer-plans, heart-stroke, general, tips-guides, news, etc.)
        // use general contact CTA
        return <CTAButtonMain />;
    }
  };

  const cta = getCTA();
  if (!cta) return null;

  return (
    <div className="my-8 pt-8 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
        {getCTATitle()}
      </h3>
      {cta}
    </div>
  );
}

