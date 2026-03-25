"use client";

import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

type Variant = "afterEligibility" | "afterCarriers";

export function ShortTermEnrollmentBand({ variant }: { variant: Variant }) {
  const t = useTranslations(
    "uhone.shortterm.templateContent.uhone.shortterm.enrollmentCta"
  );
  const titleKey =
    variant === "afterEligibility" ? "afterEligibilityTitle" : "afterCarriersTitle";
  const trustKey =
    variant === "afterEligibility" ? "afterEligibilityTrust" : "afterCarriersTrust";

  return (
    <section
      className="relative border-y border-slate-200/80 bg-gradient-to-b from-white via-slate-50/90 to-white py-12 dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-900/95 dark:to-slate-950 md:py-14"
      aria-labelledby={`stm-enroll-band-${variant}-heading`}
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div
          className="animate-fadeUp rounded-2xl border border-[hsl(var(--custom)/0.2)] bg-white/90 p-6 shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] ring-1 ring-[hsl(var(--custom)/0.12)] backdrop-blur-sm dark:bg-slate-900/85 dark:ring-white/10 sm:p-8"
          style={{ animationDelay: "0.05s" }}
        >
          <h2
            id={`stm-enroll-band-${variant}-heading`}
            className="text-balance text-center text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl"
          >
            {t(titleKey)}
          </h2>
          <div className="mt-6 flex justify-center">
            <ShortTermMedicalButton emphasize tightTop />
          </div>
          <p className="mx-auto mt-4 flex max-w-lg items-start justify-center gap-2 text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:items-center sm:text-base">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--custom))] sm:mt-0"
              aria-hidden
            />
            <span>{t(trustKey)}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
