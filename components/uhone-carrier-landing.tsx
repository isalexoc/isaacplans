import {
  BadgeCheck,
  Layers,
  MousePointerClick,
  Shield,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import UhoneIntroVideo from "@/components/uhone-intro-video";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import { getTranslations } from "next-intl/server";
import type { SupportedLocale } from "@/lib/seo/i18n";

export type UhoneCarrierLandingProps = {
  locale: SupportedLocale;
  t: Awaited<ReturnType<typeof getTranslations>>;
};

export default function UhoneCarrierLanding({ locale, t }: UhoneCarrierLandingProps) {

  const valueIcons = [Sparkles, Layers, TrendingUp, BadgeCheck] as const;
  const stepIcons = [MousePointerClick, Layers, Shield] as const;

  return (
    <>
      {/* Hero + primary CTA + video */}
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[hsl(var(--custom)/0.08)] via-background to-background"
        aria-labelledby="uhone-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="motion-safe:animate-fadeUp max-w-3xl">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--custom)/0.25)] bg-background/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-[hsl(var(--custom))] shadow-sm backdrop-blur dark:bg-background/60">
              <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("hero.badge")}
            </span>
            <h1
              id="uhone-hero-heading"
              className="mt-5 text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-[2.35rem] lg:leading-[1.15]"
            >
              {t("hero.title")}
            </h1>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("hero.lead")}
            </p>
          </div>

          <div className="motion-safe:animate-fadeUp-d2 mt-8 max-w-2xl">
            <p
              id="uhone-apply-label"
              className="text-sm font-medium text-foreground"
            >
              {t("cta.label")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("cta.eyebrow")}</p>
            <a
              href="https://shop.uhone.com/en/quote/census/shortterm?brokerid=AA5607941"
              target="_blank"
              rel="noopener noreferrer"
              aria-labelledby="uhone-apply-label"
              className="mt-5 inline-block max-w-full rounded-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.35)] ring-1 ring-black/5 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
            >
              <img
                src="https://www.uhone.com/ContentManagement/FileAttachment.ashx?FilePath=/Short_Term_Banner_Btn.jpg"
                alt=""
                width={400}
                height={120}
                className="h-auto w-full max-w-md rounded-lg"
                decoding="async"
              />
            </a>
          </div>

          <div className="motion-safe:animate-fadeUp-d4 mt-10">
            <UhoneIntroVideo
              locale={locale}
              heading={t("introVideo.heading")}
              description={t("introVideo.description")}
              captionNote={
                locale.startsWith("es")
                  ? t("introVideo.captionNote")
                  : undefined
              }
            />
          </div>
        </div>
      </section>

      {/* Value props */}
      <section
        className="border-b border-border/60 bg-muted/30 py-14 sm:py-16 lg:py-20"
        aria-labelledby="uhone-value-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="uhone-value-heading"
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
                <div className="mb-3 inline-flex rounded-lg bg-[hsl(var(--custom)/0.12)] p-2.5 text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.18)]">
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

      {/* Steps + visual */}
      <section
        className="py-14 sm:py-16 lg:py-20"
        aria-labelledby="uhone-steps-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-start lg:gap-16">
            <div>
              <h2
                id="uhone-steps-heading"
                className="text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {t("steps.title")}
              </h2>
              <ol className="mt-8 space-y-6">
                {stepIcons.map((Icon, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--custom))] text-sm font-bold text-primary-foreground"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Icon
                          className="h-4 w-4 text-[hsl(var(--custom))]"
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
              aria-labelledby="uhone-flex-heading"
            >
              <h3
                id="uhone-flex-heading"
                className="text-lg font-semibold text-foreground"
              >
                {t("flexibility.title")}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("flexibility.subtitle")}
              </p>
              <div
                className="mt-6 space-y-5"
                role="img"
                aria-label={t("flexibility.visualAria")}
              >
                <div>
                  <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{t("flexibility.barLabelA")}</span>
                    <span className="text-foreground">●●●●●</span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <div className="h-full w-[88%] rounded-full bg-[hsl(var(--custom))] motion-safe:transition-all motion-safe:duration-1000" />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground">
                    <span>{t("flexibility.barLabelB")}</span>
                    <span className="text-foreground">●●●</span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-muted"
                    aria-hidden
                  >
                    <div className="h-full w-[55%] rounded-full bg-slate-400/80 dark:bg-slate-500" />
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {t("flexibility.caption")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section
        className="border-y border-border/60 bg-muted/25 py-12 sm:py-14"
        aria-labelledby="uhone-trust-heading"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2
            id="uhone-trust-heading"
            className="text-xl font-bold tracking-tight sm:text-2xl"
          >
            {t("trust.title")}
          </h2>
          <p className="mt-3 text-muted-foreground">{t("trust.body")}</p>
        </div>
      </section>

      {/* State variation */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
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
        className="border-t border-border/60 bg-muted/20 py-12 sm:py-14"
        aria-labelledby="uhone-guide-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="uhone-guide-heading"
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

      {/* FAQ */}
      <section
        className="py-12 sm:py-14"
        aria-labelledby="uhone-faq-heading"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2
            id="uhone-faq-heading"
            className="text-center text-2xl font-bold tracking-tight"
          >
            {t("faq.title")}
          </h2>
          <dl className="mt-8 space-y-6">
            <div className="rounded-xl border border-border bg-card p-5">
              <dt className="font-semibold text-foreground">
                {t("faq.items.0.q")}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("faq.items.0.a")}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <dt className="font-semibold text-foreground">
                {t("faq.items.1.q")}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("faq.items.1.a")}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <dt className="font-semibold text-foreground">
                {t("faq.items.2.q")}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("faq.items.2.a")}
              </dd>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <dt className="font-semibold text-foreground">
                {t("faq.items.3.q")}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("faq.items.3.a")}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Help + disclosures */}
      <section className="border-t border-border/60 bg-muted/15 pb-16 pt-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ShortTermMedicalButton emphasize />
          <div className="mt-12 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">
                {t("disclosures.underwriter.label")}
              </strong>{" "}
              {t("disclosures.underwriter.text")}
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
    </>
  );
}
