"use client";

/**
 * Shared "Apply now" CTA shown on the success screen of any IUL lead/contact form.
 * Self-contained bilingual copy (no new i18n keys); links to the public /iul/apply funnel.
 */
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

export default function IulApplySuccessCta() {
  const isES = useLocale().startsWith("es");
  return (
    <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 p-4 text-center dark:border-blue-800 dark:bg-blue-900/20">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {isES ? "¿Listo para solicitar tu IUL?" : "Ready to apply for your IUL?"}
      </p>
      <Link
        href="/iul/apply"
        className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
      >
        {isES ? "Solicitar ahora" : "Apply now"} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
