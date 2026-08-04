"use client";

/**
 * Shared "self-enroll" CTA shown on the success screen of any Life Insurance lead/contact form.
 * Self-contained bilingual copy (no new i18n keys); links out to Isaac's Ethos instant-enrollment
 * link — mirrors IulApplySuccessCta's structure, but points externally instead of to an internal
 * apply funnel (Life Insurance has none; Ethos handles the application itself).
 */
import { useLocale } from "next-intl";
import { ExternalLink } from "lucide-react";
import { LIFE_INSURANCE_ENROLL_URL } from "@/lib/get-covered-fast/constants";

export default function LifeInsuranceSelfEnrollCta() {
  const isES = useLocale().startsWith("es");
  return (
    <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {isES ? "¿Prefiere autoinscribirse ahora?" : "Prefer to self-enroll now?"}
      </p>
      <a
        href={LIFE_INSURANCE_ENROLL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
      >
        {isES ? "Inscribirse ahora" : "Enroll now"} <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
