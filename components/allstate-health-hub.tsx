import { ExternalLink, Shield } from "lucide-react";
import type { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import { allstateQuickQuoteUrl } from "@/lib/allstate-quick-quote";
import {
  ALLSTATE_CANCER_ONLY_SLUG,
  ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS,
  ALLSTATE_SENIOR_PRODUCT_SLUGS,
  natgenProductParamForSlug,
} from "@/lib/allstate-product-routes";

export type AllstateHealthHubProps = {
  t: Awaited<ReturnType<typeof getTranslations>>;
};

const cardBtn =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0033A0] to-[#0077B6] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2";

export default function AllstateHealthHub({ t }: AllstateHealthHubProps) {
  const quoteLabel = t("labels.quoteCta");

  return (
    <main id="allstate-health-hub-main" className="text-foreground">
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[#0033A0]/[0.07] via-background to-background dark:from-[#0033A0]/[0.12]"
        aria-labelledby="allstate-hub-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.4) 1px, transparent 0)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0033A0]/25 bg-background/85 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#0033A0] shadow-sm backdrop-blur dark:bg-background/60 dark:text-[#5eb3e8]">
              <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("hub.hero.badge")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            id="allstate-hub-hero-heading"
            className="mt-6 max-w-3xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.35rem] lg:leading-[1.12]"
          >
            {t("hub.hero.title")}
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("hub.hero.lead")}
          </p>
        </div>
      </section>

      {/* STM featured */}
      <section
        className="border-b border-border/60 bg-muted/15 py-12 sm:py-14"
        aria-labelledby="allstate-hub-stm-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#0033A0]/20 bg-gradient-to-br from-[#0033A0]/[0.06] to-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[#0033A0] dark:text-[#5eb3e8]">
                {t("hub.stm.badge")}
              </p>
              <h2
                id="allstate-hub-stm-heading"
                className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
              >
                {t("hub.stm.title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {t("hub.stm.body")}
              </p>
            </div>
            <Link
              href="/carriers/allstate/shortterm"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0033A0] to-[#0077B6] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0033A0] focus-visible:ring-offset-2"
            >
              {t("hub.stm.cta")}
              <ExternalLink className="h-5 w-5 opacity-90" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* Seniors */}
      <section
        className="border-b border-border/60 py-14 sm:py-16"
        aria-labelledby="allstate-hub-seniors-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-hub-seniors-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("hub.seniorsSection.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("hub.seniorsSection.subtitle")}
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2" role="list">
            {ALLSTATE_SENIOR_PRODUCT_SLUGS.map((slug) => (
              <li key={slug}>
                <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5">
                  <h3 className="text-lg font-semibold leading-snug">
                    {t(`seniors.${slug}.hero.title`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`seniors.${slug}.hero.lead`)}
                  </p>
                  <a
                    href={allstateQuickQuoteUrl(natgenProductParamForSlug(slug))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cardBtn} mt-5`}
                  >
                    {quoteLabel}
                    <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </a>
                </article>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-border/70 bg-muted/20 p-6">
            <h3 className="text-base font-semibold">{t("hub.cancerStrip.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("hub.cancerStrip.body")}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={allstateQuickQuoteUrl(
                  natgenProductParamForSlug(ALLSTATE_CANCER_ONLY_SLUG)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cardBtn} w-full sm:w-auto`}
              >
                {quoteLabel}
                <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Individual */}
      <section
        className="border-b border-border/60 bg-muted/10 py-14 sm:py-16"
        aria-labelledby="allstate-hub-individual-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="allstate-hub-individual-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("hub.individualSection.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("hub.individualSection.subtitle")}
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {ALLSTATE_INDIVIDUAL_PRODUCT_SLUGS.map((slug) => (
              <li key={slug}>
                <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5">
                  <h3 className="text-lg font-semibold leading-snug">
                    {t(`individual.${slug}.hero.title`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`individual.${slug}.hero.lead`)}
                  </p>
                  <a
                    href={allstateQuickQuoteUrl(natgenProductParamForSlug(slug))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cardBtn} mt-5`}
                  >
                    {quoteLabel}
                    <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                  </a>
                </article>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-border/70 bg-background p-6">
            <h3 className="text-base font-semibold">{t("hub.cancerStrip.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("hub.cancerStrip.body")}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={allstateQuickQuoteUrl(
                  natgenProductParamForSlug(ALLSTATE_CANCER_ONLY_SLUG)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={`${cardBtn} w-full sm:w-auto`}
              >
                {quoteLabel}
                <ExternalLink className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/60 bg-gradient-to-br from-[#0033A0]/[0.06] to-background py-14 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight">
            {t("shared.contactClosing.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("shared.contactClosing.body")}
          </p>
          <div className="mt-8 flex justify-center">
            <ShortTermMedicalButton emphasize />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 dark:bg-amber-500/[0.08]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            {t("hub.disclaimer.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("hub.disclaimer.body")}
          </p>
        </div>
      </section>
    </main>
  );
}
