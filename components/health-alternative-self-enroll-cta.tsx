"use client";

/**
 * Shared "self-enroll" CTA shown on the success screen of any Health Coverage Alternative
 * lead/contact form. Self-contained bilingual copy (no new i18n keys); links out to Isaac's
 * existing Pivot Health agent quote link — mirrors LifeInsuranceSelfEnrollCta's structure.
 */
import { useLocale } from "next-intl";
import { ExternalLink } from "lucide-react";
import { PIVOT_DIRECT_QUOTE_URL } from "@/lib/pivot-direct-quote";

export default function HealthAlternativeSelfEnrollCta() {
  const isES = useLocale().startsWith("es");
  return (
    <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {isES ? "¿Prefiere autoinscribirse ahora?" : "Prefer to self-enroll now?"}
      </p>
      <a
        href={PIVOT_DIRECT_QUOTE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
      >
        {isES ? "Inscribirse ahora" : "Enroll now"} <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
