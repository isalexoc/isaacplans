"use client";

import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  Download,
  ImageIcon,
  Layers,
  Sparkles,
  UserCircle,
  Zap,
} from "lucide-react";
import { LeaveBehindLandingShare } from "@/components/leave-behind/leave-behind-landing-share";
import { leaveBehindLandingOgImageUrl } from "@/lib/leave-behind-og-url";
import type { SupportedLocale } from "@/lib/seo/i18n";

const FEATURE_ICONS = [Layers, UserCircle, Zap, BadgeCheck] as const;

function LandingSignInButton({
  redirectUrl,
  className,
  children,
}: {
  redirectUrl: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <SignInButton
      mode="modal"
      forceRedirectUrl={redirectUrl}
      signUpForceRedirectUrl={redirectUrl}
      fallbackRedirectUrl={redirectUrl}
      signUpFallbackRedirectUrl={redirectUrl}
    >
      <button type="button" className={className}>
        {children}
      </button>
    </SignInButton>
  );
}

export default function FinalExpenseLeaveBehindLanding() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("finalExpenseLeaveBehind.landing");
  const heroImageUrl = leaveBehindLandingOgImageUrl(locale);
  const [redirectUrl, setRedirectUrl] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUrl(window.location.pathname);
    }
  }, []);

  const primaryCtaClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:from-sky-400 hover:to-blue-500 hover:shadow-sky-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a12]";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-amber-600/15 blur-3xl" />
        <div className="absolute -right-24 top-32 h-[380px] w-[380px] rounded-full bg-sky-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#003366]/30 blur-3xl" />
      </div>

      <section className="relative border-b border-white/10 bg-gradient-to-b from-[#060a12] via-[#0c1424] to-[#0f172a] px-4 pb-20 pt-12 text-white sm:pb-28 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-sky-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t("eyebrow")}
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t("heroTitle")}{" "}
              <span className="bg-gradient-to-r from-amber-200 via-sky-200 to-blue-300 bg-clip-text text-transparent">
                {t("heroTitleHighlight")}
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
              {t("heroSubtitle")}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <LandingSignInButton redirectUrl={redirectUrl} className={primaryCtaClass}>
                {t("ctaPrimary")}
                <ArrowRight className="h-5 w-5" aria-hidden />
              </LandingSignInButton>
              <p className="text-sm text-slate-400">{t("ctaHint")}</p>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500 lg:justify-start">
              <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
              {t("trustLine")}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl ring-1 ring-white/10">
              <Image
                src={heroImageUrl}
                alt={t("meta.imageAlt")}
                width={1200}
                height={630}
                className="h-auto w-full"
                priority
                sizes="(max-width: 1024px) 100vw, 512px"
              />
              <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
                <LeaveBehindLandingShare className="border-white/25 bg-black/45 shadow-lg backdrop-blur-md hover:border-sky-400/50 hover:bg-black/60" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-background px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300 sm:text-3xl">
            {t("featuresTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{t("featuresSubtitle")}</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => {
            const Icon = FEATURE_ICONS[i - 1];
            return (
              <div
                key={i}
                className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition hover:border-sky-500/30 hover:shadow-md dark:hover:border-sky-500/20"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#003366]/10 text-[#003366] dark:bg-sky-500/15 dark:text-sky-300">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {t(`feature${i}Title` as "feature1Title")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`feature${i}Body` as "feature1Body")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-b border-border/60 bg-muted/30 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-bold text-[#003366] dark:text-sky-300 sm:text-3xl">
            {t("howTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("howSubtitle")}</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-8 md:grid-cols-3">
          {[
            { step: "1", icon: UserCircle },
            { step: "2", icon: ImageIcon },
            { step: "3", icon: Download },
          ].map(({ step, icon: Icon }, idx) => (
            <div key={step} className="relative text-center">
              {idx < 2 && (
                <span
                  className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-sky-500/50 to-transparent md:block"
                  aria-hidden
                />
              )}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003366] to-sky-700 text-white shadow-lg">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
                {step}
              </p>
              <h3 className="mt-2 font-semibold text-foreground">
                {t(`step${step}Title` as "step1Title")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`step${step}Body` as "step1Body")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-sky-500/20 bg-gradient-to-br from-[#003366] via-[#0c4a7a] to-sky-800 px-6 py-12 text-center text-white shadow-xl sm:px-10">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("finalTitle")}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sky-100/90">{t("finalSubtitle")}</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <LandingSignInButton
              redirectUrl={redirectUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#003366] shadow-lg transition hover:bg-sky-50"
            >
              {t("finalCta")}
              <ArrowRight className="h-5 w-5" aria-hidden />
            </LandingSignInButton>
          </div>
        </div>
      </section>
    </div>
  );
}
