import {
  BadgeCheck,
  BarChart3,
  ClipboardCheck,
  ExternalLink,
  Layers,
  Shield,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import StmDurationChart from "@/components/stm-duration-chart";
import ManhattanIntroVideo from "@/components/manhattan-intro-video";
import PivotIntroVideo from "@/components/pivot-intro-video";
import type { SupportedLocale } from "@/lib/seo/i18n";

export type StmRequestInfoVariant = "pivot" | "manhattan";

export type StmRequestInfoLandingProps = {
  t: Awaited<ReturnType<typeof getTranslations>>;
  variant: StmRequestInfoVariant;
  /** When set (Manhattan agent quote), hero + mid CTAs use this URL instead of the modal button. */
  directQuoteUrl?: string;
  /** Hero intro videos (Pivot / Manhattan) — pass `locale` for Spanish WebVTT tracks. */
  locale?: SupportedLocale;
};

const valueIcons = [Sparkles, Layers, BarChart3, BadgeCheck] as const;
const stepIcons = [ClipboardCheck, Layers, Shield] as const;

const THEME: Record<
  StmRequestInfoVariant,
  {
    mainId: string;
    skipRing: string;
    heroBg: string;
    badge: string;
    dot: string;
    valueIconWrap: string;
    stepCircle: string;
    stepIcon: string;
    compareBar: string;
    midCta: string;
    faqRing: string;
    chartGradientId: string;
    chartFrom: string;
    chartTo: string;
    calloutAccent: string;
    logoSrc: string;
    logoW: number;
    logoH: number;
    quoteLinkClass: string;
  }
> = {
  pivot: {
    mainId: "pivot-stm-main",
    skipRing: "focus:ring-[#0d9488]",
    heroBg:
      "from-[#0d9488]/[0.07] via-background to-background dark:from-[#0d9488]/[0.12]",
    badge:
      "border-[#0d9488]/25 text-[#0f766a] shadow-sm dark:text-[#5eead4]",
    dot: "bg-[#14b8a6]",
    valueIconWrap:
      "bg-[#0d9488]/10 text-[#0f766a] dark:bg-[#0d9488]/20 dark:text-[#5eead4]",
    stepCircle: "bg-[#0d9488] text-white dark:bg-[#115e59]",
    stepIcon: "text-[#14b8a6] dark:text-[#5eead4]",
    compareBar: "from-[#0d9488] to-[#14b8a6]",
    midCta: "border-[#0d9488]/20 from-[#0d9488]/[0.06]",
    faqRing: "focus-visible:ring-[#0d9488]",
    chartGradientId: "pivot-stm-bar",
    chartFrom: "hsl(168 76% 30%)",
    chartTo: "hsl(172 66% 42%)",
    calloutAccent: "text-[#0f766a] dark:text-[#5eead4]",
    logoSrc:
      "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_240/v1774397411/pivothealth_logo_sabqbm.jpg",
    logoW: 160,
    logoH: 40,
    quoteLinkClass:
      "inline-flex min-h-[48px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0d9488] to-[#14b8a6] px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_-16px_rgba(13,148,136,0.45)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 sm:w-auto",
  },
  manhattan: {
    mainId: "manhattan-stm-main",
    skipRing: "focus:ring-[#1d4ed8]",
    heroBg:
      "from-[#1e40af]/[0.07] via-background to-background dark:from-[#1e40af]/[0.12]",
    badge:
      "border-[#1e40af]/25 text-[#1e3a8a] shadow-sm dark:text-[#93c5fd]",
    dot: "bg-[#3b82f6]",
    valueIconWrap:
      "bg-[#1e40af]/10 text-[#1e40af] dark:bg-[#1e40af]/20 dark:text-[#93c5fd]",
    stepCircle: "bg-[#1e40af] text-white dark:bg-[#1e3a8a]",
    stepIcon: "text-[#3b82f6] dark:text-[#93c5fd]",
    compareBar: "from-[#1e40af] to-[#3b82f6]",
    midCta: "border-[#1e40af]/20 from-[#1e40af]/[0.06]",
    faqRing: "focus-visible:ring-[#2563eb]",
    chartGradientId: "manhattan-stm-bar",
    chartFrom: "hsl(224 64% 32%)",
    chartTo: "hsl(217 91% 58%)",
    calloutAccent: "text-[#1e40af] dark:text-[#93c5fd]",
    logoSrc:
      "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_240/v1774397411/manhatan_logo_g6cswk.jpg",
    logoW: 180,
    logoH: 44,
    quoteLinkClass:
      "inline-flex min-h-[48px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e40af] to-[#3b82f6] px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_-16px_rgba(30,64,175,0.45)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:w-auto",
  },
};

export function stmRequestInfoMainId(variant: StmRequestInfoVariant): string {
  return THEME[variant].mainId;
}

export function stmRequestInfoSkipLinkRingClass(
  variant: StmRequestInfoVariant
): string {
  return THEME[variant].skipRing;
}

export default function StmRequestInfoLanding({
  t,
  variant,
  directQuoteUrl,
  locale,
}: StmRequestInfoLandingProps) {
  const th = THEME[variant];
  const useDirectQuote = Boolean(directQuoteUrl);
  const faqIds = [0, 1, 2, 3] as const;
  const prefix = variant;

  return (
    <main id={th.mainId} className="text-foreground">
      {/* Hero */}
      <section
        className={`relative overflow-hidden border-b border-border/60 bg-gradient-to-b ${th.heroBg}`}
        aria-labelledby={`${prefix}-hero-heading`}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.4) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-12">
            <div className="motion-safe:animate-fadeUp max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex w-fit items-center gap-2 rounded-full border bg-background/85 px-4 py-1.5 text-xs font-semibold tracking-wide backdrop-blur dark:bg-background/60 ${th.badge}`}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("hero.badge")}
                </span>
                <img
                  src={th.logoSrc}
                  alt=""
                  width={th.logoW}
                  height={th.logoH}
                  className="h-9 w-auto max-w-[200px] object-contain opacity-95 dark:opacity-100"
                  decoding="async"
                />
              </div>
              <h1
                id={`${prefix}-hero-heading`}
                className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]"
              >
                {t("hero.title")}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("hero.lead")}
              </p>
            </div>

            <aside
              className="motion-safe:animate-fadeUp-d2 rounded-2xl border border-border/80 bg-card/90 p-5 shadow-md ring-1 ring-black/5 backdrop-blur-sm [content-visibility:auto] lg:mt-2"
              aria-labelledby={`${prefix}-card-title`}
            >
              <h2
                id={`${prefix}-card-title`}
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("hero.cardTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("hero.cardBody")}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-foreground">
                <li className="flex gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${th.dot}`}
                    aria-hidden
                  />
                  {t("hero.cardBullets.0")}
                </li>
                <li className="flex gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${th.dot}`}
                    aria-hidden
                  />
                  {t("hero.cardBullets.1")}
                </li>
                <li className="flex gap-2">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${th.dot}`}
                    aria-hidden
                  />
                  {t("hero.cardBullets.2")}
                </li>
              </ul>
            </aside>
          </div>

          <div className="motion-safe:animate-fadeUp-d4 mt-10 max-w-2xl">
            <p
              id={`${prefix}-cta-label`}
              className="text-sm font-medium text-foreground"
            >
              {t("cta.label")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("cta.eyebrow")}</p>
            <div className="mt-5 max-w-md">
              {useDirectQuote && directQuoteUrl ? (
                <a
                  href={directQuoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-describedby={`${prefix}-cta-label`}
                  className={th.quoteLinkClass}
                >
                  {t("cta.primary")}
                  <ExternalLink className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                </a>
              ) : (
                <ShortTermMedicalButton emphasize tightTop />
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t("cta.helper")}</p>
          </div>

          {variant === "manhattan" && locale ? (
            <ManhattanIntroVideo
              locale={locale}
              heading={t("introVideo.heading")}
              description={t("introVideo.description")}
              captionNote={t("introVideo.captionNote")}
            />
          ) : null}
          {variant === "pivot" && locale ? (
            <PivotIntroVideo
              locale={locale}
              heading={t("introVideo.heading")}
              description={t("introVideo.description")}
              captionNote={t("introVideo.captionNote")}
            />
          ) : null}
        </div>
      </section>

      {/* Chart */}
      <section
        className="border-b border-border/60 bg-muted/20 py-14 sm:py-16 lg:py-20"
        aria-labelledby={`${prefix}-chart-section-title`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id={`${prefix}-chart-section-title`} className="sr-only">
            {t("chart.sectionTitle")}
          </h2>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
            <StmDurationChart
              title={t("chart.title")}
              subtitle={t("chart.subtitle")}
              ariaLabel={t("chart.ariaLabel")}
              footnote={t("chart.footnote")}
              monthLabels={[
                t("chart.months.0"),
                t("chart.months.1"),
                t("chart.months.2"),
                t("chart.months.3"),
              ]}
              yAxisLabel={t("chart.yAxis")}
              gradientId={th.chartGradientId}
              gradientFrom={th.chartFrom}
              gradientTo={th.chartTo}
            />
            <div className="motion-safe:animate-fadeUp space-y-4 lg:pt-2">
              <p
                className={`text-sm font-semibold uppercase tracking-wide ${th.calloutAccent}`}
              >
                {t("chart.calloutKicker")}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {t("chart.calloutTitle")}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t("chart.calloutBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section
        className="border-b border-border/60 bg-background py-14 sm:py-16 lg:py-20 [content-visibility:auto]"
        aria-labelledby={`${prefix}-value-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id={`${prefix}-value-heading`}
            className="text-center text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("valueProps.title")}
          </h2>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" role="list">
            {valueIcons.map((Icon, i) => (
              <li
                key={i}
                className="motion-safe:animate-fadeUp flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
              >
                <div
                  className={`mb-3 inline-flex rounded-lg p-2.5 ${th.valueIconWrap}`}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {t(`valueProps.items.${i}.title`)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                  {t(`valueProps.items.${i}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Mid CTA */}
      <section
        className="border-b border-border/60 bg-muted/15 py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby={`${prefix}-mid-cta-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div
            className={`rounded-2xl border bg-gradient-to-br to-background p-8 text-center shadow-sm sm:p-10 ${th.midCta}`}
          >
            <h2
              id={`${prefix}-mid-cta-heading`}
              className="text-xl font-bold tracking-tight sm:text-2xl"
            >
              {t("bottomCta.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {t("bottomCta.subtitle")}
            </p>
            <div className="mx-auto mt-6 flex max-w-md justify-center">
              {useDirectQuote && directQuoteUrl ? (
                <a
                  href={directQuoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${th.quoteLinkClass} w-full sm:w-auto`}
                >
                  {t("bottomCta.button")}
                  <ExternalLink className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
                </a>
              ) : (
                <ShortTermMedicalButton emphasize tightTop />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Steps + compare */}
      <section
        className="py-14 sm:py-16 lg:py-20 [content-visibility:auto]"
        aria-labelledby={`${prefix}-steps-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
            <div>
              <h2
                id={`${prefix}-steps-heading`}
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {t("steps.title")}
              </h2>
              <ol className="mt-8 space-y-6">
                {stepIcons.map((Icon, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${th.stepCircle}`}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`h-4 w-4 ${th.stepIcon}`}
                          aria-hidden
                        />
                        <h3 className="font-semibold text-foreground">
                          {t(`steps.items.${i}.title`)}
                        </h3>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {t(`steps.items.${i}.body`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div
              className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/40 p-6 shadow-inner ring-1 ring-black/5"
              aria-labelledby={`${prefix}-compare-heading`}
            >
              <h3
                id={`${prefix}-compare-heading`}
                className="text-lg font-semibold text-foreground"
              >
                {t("compare.title")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("compare.subtitle")}
              </p>
              <div
                className="mt-6 space-y-5"
                role="img"
                aria-label={t("compare.visualAria")}
              >
                <div>
                  <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{t("compare.barLabelA")}</span>
                    <span className="text-foreground">●●●●</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={`h-full w-[82%] rounded-full bg-gradient-to-r ${th.compareBar} motion-safe:transition-all motion-safe:duration-1000`}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{t("compare.barLabelB")}</span>
                    <span className="text-foreground">●●●●●</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full w-full rounded-full bg-slate-400/75 dark:bg-slate-500" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t("compare.caption")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section
        className="border-y border-border/60 bg-muted/25 py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby={`${prefix}-trust-heading`}
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            id={`${prefix}-trust-heading`}
            className="text-xl font-bold tracking-tight sm:text-2xl"
          >
            {t("trust.title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("trust.body")}</p>
        </div>
      </section>

      {/* Compliance */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 [content-visibility:auto]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">
            {t("complianceNote.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("complianceNote.body")}
          </p>
        </div>
      </section>

      {/* Guidance */}
      <section
        className="border-t border-border/60 bg-muted/20 py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby={`${prefix}-guide-heading`}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id={`${prefix}-guide-heading`} className="sr-only">
            {t("guidance.sectionTitle")}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("guidance.useCases.title")}
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>{t("guidance.useCases.items.0")}</li>
                <li>{t("guidance.useCases.items.1")}</li>
                <li>{t("guidance.useCases.items.2")}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("guidance.notInclude.title")}
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>{t("guidance.notInclude.items.0")}</li>
                <li>{t("guidance.notInclude.items.1")}</li>
                <li>{t("guidance.notInclude.items.2")}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                {t("guidance.beforeApply.title")}
              </h3>
              <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground">
                <li>{t("guidance.beforeApply.items.0")}</li>
                <li>{t("guidance.beforeApply.items.1")}</li>
                <li>{t("guidance.beforeApply.items.2")}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        className="py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby={`${prefix}-faq-heading`}
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2
            id={`${prefix}-faq-heading`}
            className="text-center text-2xl font-bold tracking-tight"
          >
            {t("faq.title")}
          </h2>
          <div className="mt-8 space-y-3">
            {faqIds.map((i) => (
              <details
                key={i}
                className="group rounded-xl border border-border bg-card open:bg-muted/20 open:shadow-sm"
              >
                <summary
                  className={`cursor-pointer list-none px-5 py-4 font-semibold text-foreground outline-none transition hover:bg-muted/30 focus-visible:z-10 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 ${th.faqRing} [&::-webkit-details-marker]:hidden`}
                >
                  <span className="flex items-center justify-between gap-3">
                    {t(`faq.items.${i}.q`)}
                    <span
                      className="text-muted-foreground transition group-open:rotate-180"
                      aria-hidden
                    >
                      ▼
                    </span>
                  </span>
                </summary>
                <div className="border-t border-border/60 px-5 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                  {t(`faq.items.${i}.a`)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA + disclosures */}
      <section className="border-t border-border/60 bg-muted/15 pb-16 pt-12 sm:pt-14 [content-visibility:auto]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ShortTermMedicalButton emphasize />

          <div className="mt-12 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">
                {t("disclosures.carrier.label")}
              </strong>{" "}
              {t("disclosures.carrier.text")}
            </p>
            <p>
              <strong className="text-foreground">
                {t("disclosures.notMEC.label")}
              </strong>{" "}
              {t("disclosures.notMEC.text")}
            </p>
            {useDirectQuote ? (
              <p>
                <strong className="text-foreground">
                  {t("disclosures.linkUse.label")}
                </strong>{" "}
                {t("disclosures.linkUse.text")}
              </p>
            ) : (
              <p>
                <strong className="text-foreground">
                  {t("disclosures.infoRequest.label")}
                </strong>{" "}
                {t("disclosures.infoRequest.text")}
              </p>
            )}
            <p>{t("disclosures.footer")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
