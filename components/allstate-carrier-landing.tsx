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
import AllstateStldiChart from "@/components/allstate-stldi-chart";
import AllstateIntroVideo from "@/components/allstate-intro-video";
import type { SupportedLocale } from "@/lib/seo/i18n";

export type AllstateCarrierLandingProps = {
  t: Awaited<ReturnType<typeof getTranslations>>;
  quoteUrl: string;
  locale: SupportedLocale;
};

const valueIcons = [Sparkles, Layers, BarChart3, BadgeCheck] as const;
const stepIcons = [ClipboardCheck, Layers, Shield] as const;

export default function AllstateCarrierLanding({
  t,
  quoteUrl,
  locale,
}: AllstateCarrierLandingProps) {
  const faqIds = [0, 1, 2, 3] as const;

  return (
    <main
      id="allstate-stm-main"
      className="allstate-carrier text-foreground"
    >
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[#0033A0]/[0.07] via-background to-background dark:from-[#0033A0]/[0.12]"
        aria-labelledby="allstate-hero-heading"
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
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0033A0]/25 bg-background/85 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#0033A0] shadow-sm backdrop-blur dark:bg-background/60 dark:text-[#5eb3e8]">
                  <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("hero.badge")}
                </span>
                <img
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_200/v1774397414/allstate_logo_ungrkt.png"
                  alt=""
                  width={120}
                  height={36}
                  className="h-8 w-auto opacity-90 dark:opacity-100"
                  decoding="async"
                />
              </div>
              <h1
                id="allstate-hero-heading"
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
              aria-labelledby="allstate-quote-card-title"
            >
              <h2
                id="allstate-quote-card-title"
                className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {t("hero.cardTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("hero.cardBody")}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-foreground">
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0077B6]" aria-hidden />
                  {t("hero.cardBullets.0")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0077B6]" aria-hidden />
                  {t("hero.cardBullets.1")}
                </li>
                <li className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0077B6]" aria-hidden />
                  {t("hero.cardBullets.2")}
                </li>
              </ul>
            </aside>
          </div>

          <div className="motion-safe:animate-fadeUp-d4 mt-10 max-w-2xl">
            <p
              id="allstate-apply-label"
              className="text-sm font-medium text-foreground"
            >
              {t("cta.label")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("cta.eyebrow")}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <a
                href={quoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby="allstate-apply-label"
                className="inline-flex min-h-[48px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0033A0] to-[#0077B6] px-6 py-3.5 text-base font-semibold text-white shadow-[0_12px_40px_-16px_rgba(0,51,160,0.55)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 sm:w-auto"
              >
                {t("cta.primary")}
                <ExternalLink className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
              </a>
            </div>
          </div>

          <AllstateIntroVideo
            locale={locale}
            heading={t("introVideo.heading")}
            description={t("introVideo.description")}
            captionNote={t("introVideo.captionNote")}
          />
        </div>
      </section>

      {/* Chart + value intro */}
      <section
        className="border-b border-border/60 bg-muted/20 py-14 sm:py-16 lg:py-20"
        aria-labelledby="allstate-chart-section-title"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-chart-section-title"
            className="sr-only"
          >
            {t("chart.sectionTitle")}
          </h2>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-12">
            <AllstateStldiChart
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
            />
            <div className="motion-safe:animate-fadeUp space-y-4 lg:pt-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#0033A0] dark:text-[#5eb3e8]">
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
        aria-labelledby="allstate-value-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-value-heading"
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
                <div className="mb-3 inline-flex rounded-lg bg-[#0033A0]/10 p-2.5 text-[#0033A0] dark:bg-[#0033A0]/20 dark:text-[#5eb3e8]">
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

      {/* Pricing ZIP CTA — after value props */}
      <section
        className="border-b border-border/60 bg-muted/15 py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby="allstate-mid-cta-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-[#0033A0]/20 bg-gradient-to-br from-[#0033A0]/[0.06] to-background p-8 text-center shadow-sm sm:p-10">
            <h2
              id="allstate-mid-cta-heading"
              className="text-xl font-bold tracking-tight sm:text-2xl"
            >
              {t("bottomCta.title")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {t("bottomCta.subtitle")}
            </p>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0033A0] to-[#0077B6] px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2"
            >
              {t("bottomCta.button")}
              <ExternalLink className="h-5 w-5 shrink-0 opacity-90" aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* Steps + compare */}
      <section
        className="py-14 sm:py-16 lg:py-20 [content-visibility:auto]"
        aria-labelledby="allstate-steps-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
            <div>
              <h2
                id="allstate-steps-heading"
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {t("steps.title")}
              </h2>
              <ol className="mt-8 space-y-6">
                {stepIcons.map((Icon, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0033A0] text-sm font-bold text-white dark:bg-[#1e4d8c]"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4 text-[#0077B6] dark:text-[#5eb3e8]"
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
              aria-labelledby="allstate-compare-heading"
            >
              <h3
                id="allstate-compare-heading"
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
                    <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-[#0033A0] to-[#0077B6] motion-safe:transition-all motion-safe:duration-1000" />
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
        aria-labelledby="allstate-trust-heading"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            id="allstate-trust-heading"
            className="text-xl font-bold tracking-tight sm:text-2xl"
          >
            {t("trust.title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("trust.body")}</p>
        </div>
      </section>

      {/* State / compliance */}
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
        aria-labelledby="allstate-guide-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-guide-heading"
            className="sr-only"
          >
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

      {/* FAQ — native disclosure for accessibility + crawlability */}
      <section
        className="py-12 sm:py-14 [content-visibility:auto]"
        aria-labelledby="allstate-faq-heading"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-faq-heading"
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
                <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-foreground outline-none transition hover:bg-muted/30 focus-visible:z-10 focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
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

      {/* Help + disclosures */}
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
            <p>
              <strong className="text-foreground">
                {t("disclosures.linkUse.label")}
              </strong>{" "}
              {t("disclosures.linkUse.text")}
            </p>
            <p>{t("disclosures.footer")}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
