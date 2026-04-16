import { ExternalLink, Shield } from "lucide-react";
import type { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import {
  MANHATTAN_PRODUCT_SLUGS,
  manhattanQuoteUrlForSlug,
} from "@/lib/manhattan-product-routes";

export type ManhattanHealthHubProps = {
  t: Awaited<ReturnType<typeof getTranslations>>;
};

const cardBtn =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c4a6e] to-[#0d9488] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c4a6e] focus-visible:ring-offset-2";

export default function ManhattanHealthHub({ t }: ManhattanHealthHubProps) {
  const quoteLabel = t("labels.quoteCta");

  return (
    <main id="manhattan-health-hub-main" className="text-foreground">
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[#0c4a6e]/[0.07] via-background to-background dark:from-[#0c4a6e]/[0.12]"
        aria-labelledby="manhattan-hub-hero-heading"
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
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#0c4a6e]/25 bg-background/85 px-4 py-1.5 text-xs font-semibold tracking-wide text-[#0c4a6e] shadow-sm backdrop-blur dark:bg-background/60 dark:text-[#5eead4]">
              <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("hub.hero.badge")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_220/v1774397411/manhatan_logo_g6cswk.jpg"
              alt=""
              width={140}
              height={44}
              className="h-9 w-auto opacity-90 dark:opacity-100"
              decoding="async"
            />
          </div>
          <h1
            id="manhattan-hub-hero-heading"
            className="mt-6 max-w-3xl text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.35rem] lg:leading-[1.12]"
          >
            {t("hub.hero.title")}
          </h1>
          <p className="mt-4 max-w-3xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("hub.hero.lead")}
          </p>
        </div>
      </section>

      <section
        className="border-b border-border/60 bg-muted/15 py-12 sm:py-14"
        aria-labelledby="manhattan-hub-stm-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 rounded-2xl border border-[#0c4a6e]/20 bg-gradient-to-br from-[#0c4a6e]/[0.06] to-background p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-[#0c4a6e] dark:text-[#5eead4]">
                {t("hub.stm.badge")}
              </p>
              <h2
                id="manhattan-hub-stm-heading"
                className="mt-1 text-xl font-bold tracking-tight sm:text-2xl"
              >
                {t("hub.stm.title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {t("hub.stm.body")}
              </p>
            </div>
            <Link
              href="/carriers/manhattan/shortterm"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c4a6e] to-[#0d9488] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c4a6e] focus-visible:ring-offset-2"
            >
              {t("hub.stm.cta")}
              <ExternalLink className="h-5 w-5 opacity-90" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section
        className="border-b border-border/60 py-14 sm:py-16"
        aria-labelledby="manhattan-hub-products-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2
            id="manhattan-hub-products-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t("hub.productsSection.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("hub.productsSection.subtitle")}
          </p>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" role="list">
            {MANHATTAN_PRODUCT_SLUGS.map((slug) => (
              <li key={slug}>
                <article className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5">
                  <h3 className="text-lg font-semibold leading-snug">
                    {t(`products.${slug}.hero.title`)}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`products.${slug}.hero.lead`)}
                  </p>
                  <a
                    href={manhattanQuoteUrlForSlug(slug)}
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
        </div>
      </section>

      <section className="border-b border-border/60 bg-gradient-to-br from-[#0c4a6e]/[0.06] to-background py-14 sm:py-16">
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
