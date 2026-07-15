"use client";

import { useEffect, useState } from "react";
import { SignInButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BadgeCheck,
  Download,
  Hash,
  Languages,
  MessageCircle,
  PartyPopper,
  Send,
  Sparkles,
  UserCircle,
  Zap,
} from "lucide-react";
import { SaleStickerLandingShare } from "@/components/sale-sticker/sale-sticker-landing-share";
import { CONFETTI_PIECES, SALE_TYPE_THEME, STICKER_THEME } from "@/lib/sale-sticker-assets";

const FEATURE_ICONS = [Hash, UserCircle, MessageCircle, Languages] as const;

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

/** Pure-CSS replica of the celebration sticker (real theme colors) — no image asset needed. */
function StickerMock({ t }: { t: ReturnType<typeof useTranslations<"saleSticker.landing">> }) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* Floating format chips */}
      <div className="absolute -right-3 top-6 z-10 rotate-3 sm:-right-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/30">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          {t("mockChipSticker")}
        </span>
      </div>
      <div className="absolute -left-3 bottom-10 z-10 -rotate-3 sm:-left-6">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-sky-500/30">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          {t("mockChipAnimated")}
        </span>
      </div>

      {/* The sticker card */}
      <div
        className="relative -rotate-2 overflow-hidden rounded-[2rem] border-4 border-white/90 shadow-2xl ring-1 ring-black/20 transition-transform duration-300 hover:rotate-0"
        style={{ background: STICKER_THEME.background }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: STICKER_THEME.glow }} aria-hidden />
        {/* Confetti (same pieces as the real sticker) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {CONFETTI_PIECES.map((p, i) => (
            <span
              key={i}
              className="absolute"
              style={{
                top: p.top,
                left: p.left,
                width: p.size,
                height: p.round ? p.size : p.size * 0.5,
                backgroundColor: p.color,
                borderRadius: p.round ? "50%" : 2,
                transform: `rotate(${p.rotate}deg)`,
                opacity: 0.92,
              }}
            />
          ))}
        </div>

        <div className="relative px-6 py-8 text-center">
          {/* Gold sale-number badge */}
          <div className="mx-auto flex flex-col items-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
              style={{
                background: "radial-gradient(circle at 50% 34%, #FFE79A 0%, #FFD65A 56%, #FFB020 100%)",
                border: "3px solid #FFF3C4",
              }}
            >
              <span className="text-2xl font-extrabold tracking-tight" style={{ color: "#3A2400" }}>
                #3
              </span>
            </div>
            <span className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white drop-shadow">
              {t("mockBadgeCaption")}
            </span>
          </div>

          <p className="mt-5 text-xl font-extrabold text-white drop-shadow-sm">{t("mockPhrase")}</p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span
              className="rounded-full border px-4 py-1.5 text-xs font-semibold text-white"
              style={{ borderColor: STICKER_THEME.cardBorder, backgroundColor: "rgba(255,255,255,0.10)" }}
            >
              {t("mockClient")}
            </span>
            <span
              className="rounded-full border px-4 py-1.5 text-xs font-semibold"
              style={{
                color: SALE_TYPE_THEME.in_person.accent,
                borderColor: SALE_TYPE_THEME.in_person.accent,
                backgroundColor: SALE_TYPE_THEME.in_person.accentSoft,
              }}
            >
              {t("mockLeadSource")}
            </span>
          </div>

          {/* Agent row */}
          <div
            className="mx-auto mt-6 flex items-center justify-center gap-3 rounded-2xl border px-4 py-3"
            style={{ borderColor: STICKER_THEME.cardBorder, backgroundColor: "rgba(255,255,255,0.08)" }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white">
              <UserCircle className="h-6 w-6" aria-hidden />
            </span>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight text-white">{t("mockAgentName")}</p>
              <p className="text-[11px] leading-tight" style={{ color: STICKER_THEME.textMuted }}>
                {t("mockAgentRole")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-xs uppercase tracking-widest text-slate-500">
        {t("previewLabel")}
      </p>
    </div>
  );
}

export default function SaleStickerLanding() {
  const t = useTranslations("saleSticker.landing");
  const [redirectUrl, setRedirectUrl] = useState("/");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRedirectUrl(window.location.pathname);
    }
  }, []);

  const primaryCtaClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3.5 text-base font-semibold text-[#3A2400] shadow-lg shadow-amber-500/25 transition hover:from-amber-300 hover:to-orange-400 hover:shadow-amber-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060a12]";

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute -right-24 top-32 h-[380px] w-[380px] rounded-full bg-sky-600/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-[#003366]/30 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="relative border-b border-white/10 bg-gradient-to-b from-[#060a12] via-[#0c1424] to-[#0f172a] px-4 pb-20 pt-12 text-white sm:pb-28 sm:pt-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-200">
              <PartyPopper className="h-3.5 w-3.5" aria-hidden />
              {t("eyebrow")}
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t("heroTitle")}{" "}
              <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-orange-300 bg-clip-text text-transparent">
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
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <BadgeCheck className="h-4 w-4 text-emerald-400" aria-hidden />
                {t("trustLine")}
              </p>
              <SaleStickerLandingShare />
            </div>
          </div>

          <StickerMock t={t} />
        </div>
      </section>

      {/* ── Features ── */}
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
                className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition hover:border-amber-500/40 hover:shadow-md dark:hover:border-amber-400/30"
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

      {/* ── How it works ── */}
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
            { step: "2", icon: PartyPopper },
            { step: "3", icon: Send },
          ].map(({ step, icon: Icon }, idx) => (
            <div key={step} className="relative text-center">
              {idx < 2 && (
                <span
                  className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-amber-500/50 to-transparent md:block"
                  aria-hidden
                />
              )}
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#003366] to-sky-700 text-white shadow-lg">
                <Icon className="h-6 w-6" aria-hidden />
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
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

      {/* ── Final CTA ── */}
      <section className="px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl rounded-3xl border border-amber-500/20 bg-gradient-to-br from-[#003366] via-[#0c4a7a] to-sky-800 px-6 py-12 text-center text-white shadow-xl sm:px-10">
          <p className="mx-auto mb-4 inline-flex items-center gap-2 text-amber-300">
            <Sparkles className="h-5 w-5" aria-hidden />
            <Download className="h-5 w-5" aria-hidden />
            <MessageCircle className="h-5 w-5" aria-hidden />
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl">{t("finalTitle")}</h2>
          <p className="mx-auto mt-4 max-w-lg text-sky-100/90">{t("finalSubtitle")}</p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <LandingSignInButton
              redirectUrl={redirectUrl}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-[#003366] shadow-lg transition hover:bg-amber-50"
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
