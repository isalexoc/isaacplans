"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  COMPARISON_TIER_ORDER,
  TIER_MEDAL_URLS,
  TIER_THEMES,
  type ComparisonTier,
} from "@/lib/final-expense-leave-behind-tiers";

function MockTierCard({
  tier,
  label,
  prospect,
  coverage,
  coverageLabel,
  premium,
  perMonth,
  className,
  style,
}: {
  tier: ComparisonTier;
  label: string;
  prospect: string;
  coverage: string;
  coverageLabel: string;
  premium: string;
  perMonth: string;
  className?: string;
  style?: CSSProperties;
}) {
  const theme = TIER_THEMES[tier];

  return (
    <div
      className={cn(
        "relative w-[168px] shrink-0 overflow-hidden rounded-xl border shadow-2xl sm:w-[188px]",
        className
      )}
      style={{
        background: theme.cardGradient,
        borderColor: theme.borderAccent,
        boxShadow: `0 24px 48px -12px rgba(0,0,0,0.55), 0 0 0 1px ${theme.borderAccent}`,
        ...style,
      }}
    >
      <div
        className="flex flex-col items-center gap-2 px-3 py-4 text-center"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
      >
        <div className="h-6 w-24 rounded bg-white/10" aria-hidden />
        <div className="flex items-center gap-1.5">
          <img src={TIER_MEDAL_URLS[tier]} alt="" className="h-8 w-8 object-contain" />
          <span className="text-xs font-semibold tracking-wide" style={{ color: theme.accentHero }}>
            {label}
          </span>
        </div>
        <p className="text-[10px] text-white/70">{prospect}</p>
        <p className="text-lg font-bold leading-none" style={{ color: theme.accentHero }}>
          {coverage}
        </p>
        <p className="text-[10px] text-white/60">{coverageLabel}</p>
        <div
          className="mt-1 rounded-md px-2 py-1"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <span className="text-sm font-semibold text-white">{premium}</span>
          <span className="text-[10px] text-white/65">{perMonth}</span>
        </div>
      </div>
    </div>
  );
}

function MockCompareStrip({
  labels,
  compareLabel,
}: {
  labels: Record<ComparisonTier, string>;
  compareLabel: string;
}) {
  return (
    <div
      className="mx-auto mt-6 max-w-md overflow-hidden rounded-xl border border-white/10 bg-[#060a12] p-3 shadow-2xl"
      aria-hidden
    >
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-white/50">
        {compareLabel}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {COMPARISON_TIER_ORDER.map((tier) => {
          const theme = TIER_THEMES[tier];
          return (
            <div
              key={tier}
              className="rounded-lg border px-1 py-2 text-center"
              style={{
                background: theme.cardGradient,
                borderColor: theme.borderAccent,
              }}
            >
              <img
                src={TIER_MEDAL_URLS[tier]}
                alt=""
                className="mx-auto h-6 w-6 object-contain"
              />
              <p className="mt-1 text-[9px] font-medium" style={{ color: theme.accentMuted }}>
                {labels[tier]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  const t = useTranslations("finalExpenseLeaveBehind.landing");
  const [redirectUrl, setRedirectUrl] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUrl(window.location.pathname);
    }
  }, []);

  const tierLabels: Record<ComparisonTier, string> = {
    bronze: t("tierBronze"),
    silver: t("tierSilver"),
    gold: t("tierGold"),
  };

  const mockCardProps = {
    prospect: t("mockProspect"),
    coverage: t("mockCoverage"),
    coverageLabel: t("mockCoverageLabel"),
    premium: t("mockPremium"),
    perMonth: t("mockPerMonth"),
  };

  const primaryCtaClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-sky-500/25 transition hover:from-sky-400 hover:to-blue-500 hover:shadow-sky-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a12]";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-amber-600/15 blur-3xl" />
        <div className="absolute -right-24 top-32 h-[380px] w-[380px] rounded-full bg-sky-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#003366]/30 blur-3xl" />
      </div>

      <section className="relative border-b border-white/10 bg-gradient-to-b from-[#060a12] via-[#0c1424] to-[#0f172a] px-4 pb-20 pt-4 text-white sm:pb-28">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Link href="/final-expense">{t("backToFe")}</Link>
          </Button>
          <LandingSignInButton
            redirectUrl={redirectUrl}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
          >
            {t("ctaPrimary")}
          </LandingSignInButton>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
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

          <div className="relative mx-auto w-full max-w-lg" aria-hidden>
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-slate-500">
              {t("previewLabel")}
            </p>
            <div className="relative flex h-[280px] items-end justify-center sm:h-[300px]">
              <MockTierCard
                tier="bronze"
                label={tierLabels.bronze}
                {...mockCardProps}
                className="absolute left-0 top-8 -rotate-12 opacity-90 animate-leave-behind-float"
              />
              <MockTierCard
                tier="gold"
                label={tierLabels.gold}
                {...mockCardProps}
                className="absolute right-0 top-8 rotate-12 opacity-90 animate-leave-behind-float [animation-delay:1s]"
              />
              <MockTierCard
                tier="silver"
                label={tierLabels.silver}
                {...mockCardProps}
                className="relative z-10 scale-105 animate-leave-behind-float [animation-delay:0.5s]"
              />
            </div>
            <MockCompareStrip labels={tierLabels} compareLabel={t("tierCompare")} />
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
          <div className="mt-8 flex flex-col items-center gap-3">
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
