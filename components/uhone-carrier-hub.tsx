import {
  Activity,
  Brain,
  Cross,
  HeartPulse,
  Hospital,
  Pill,
  Shield,
  Sparkles,
  Stethoscope,
  Umbrella,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import { Link } from "@/i18n/navigation";
import {
  uhoneMarketingAssetUrl,
  uhoneShopCensusUrl,
} from "@/lib/uhone-broker";
import {
  UHONE_HUB_PRODUCT_CONFIG,
  UHONE_HUB_SECTIONS,
  type UhoneHubProductId,
  type UhoneHubSectionId,
} from "@/lib/uhone-hub-products";

const SECTION_ICONS: Record<UhoneHubSectionId, typeof Stethoscope> = {
  medical: Stethoscope,
  hospital: Hospital,
  criticalLife: HeartPulse,
  dentalVision: Sparkles,
  accident: Umbrella,
  wellness: Brain,
};

export type UhoneCarrierHubProps = {
  t: Awaited<ReturnType<typeof getTranslations>>;
};

function ProductQuoteBlock({
  productId,
  t,
}: {
  productId: UhoneHubProductId;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  const cfg = UHONE_HUB_PRODUCT_CONFIG[productId];
  const href = uhoneShopCensusUrl(cfg.shopSegment);
  const banner = cfg.bannerFile
    ? uhoneMarketingAssetUrl(cfg.bannerFile)
    : null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {cfg.internalShortTermPage ? (
          <Link
            href="/carriers/uhone/shortterm"
            className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-[hsl(var(--custom))] underline-offset-4 transition hover:underline"
          >
            <Activity className="h-4 w-4 shrink-0" aria-hidden />
            {t("labels.learnStm")}
          </Link>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex w-fit max-w-full flex-col gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
          aria-label={`${t(`products.${productId}.title`)} — ${t("labels.opensNew")}`}
        >
          {banner ? (
            <span className="block overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/5 transition group-hover:shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={banner}
                alt=""
                width={400}
                height={120}
                className="h-auto w-full max-w-[min(100%,420px)] object-contain"
                loading="lazy"
                decoding="async"
              />
            </span>
          ) : (
            <span className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] px-5 py-3 text-sm font-semibold text-white shadow-md transition group-hover:brightness-110">
              {t("labels.ctaQuote")}
            </span>
          )}
        </a>
      </div>
    </div>
  );
}

export default function UhoneCarrierHub({ t }: UhoneCarrierHubProps) {
  return (
    <main id="uhone-hub-main" className="text-foreground">
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[hsl(var(--custom)/0.09)] via-background to-background"
        aria-labelledby="uhone-hub-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.22]"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-18 lg:px-8 lg:py-22">
          <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,340px)] lg:items-start">
            <div className="motion-safe:animate-fadeUp max-w-3xl">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--custom)/0.28)] bg-background/85 px-4 py-1.5 text-xs font-semibold tracking-wide text-[hsl(var(--custom))] shadow-sm backdrop-blur">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("hero.badge")}
              </span>
              <h1
                id="uhone-hub-hero-heading"
                className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.45rem] lg:leading-[1.12]"
              >
                {t("hero.title")}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("hero.lead")}
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {([0, 1, 2] as const).map((i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border/70 bg-card/80 px-4 py-3 text-sm leading-snug text-muted-foreground shadow-sm ring-1 ring-black/5 backdrop-blur-sm"
                  >
                    <span className="font-medium text-foreground">
                      {t(`trustStrip.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="motion-safe:animate-fadeUp-d2 rounded-2xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-6 shadow-lg ring-1 ring-black/5">
              <p className="text-sm font-semibold text-foreground">
                {t("hero.allPlansLabel")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("labels.opensNew")}
              </p>
              <a
                href={uhoneShopCensusUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uhoneMarketingAssetUrl("/allPlans_btn.jpg")}
                  alt={t("hero.allPlansAlt")}
                  width={320}
                  height={96}
                  className="h-auto w-full object-contain"
                  loading="eager"
                  decoding="async"
                />
              </a>
            </aside>
          </div>
        </div>
      </section>

      {/* Product sections */}
      {UHONE_HUB_SECTIONS.map((section, sIdx) => {
        const Icon = SECTION_ICONS[section.id];
        return (
          <section
            key={section.id}
            className={`border-b border-border/60 py-14 sm:py-16 lg:py-20 ${
              sIdx % 2 === 1 ? "bg-muted/20" : "bg-background"
            }`}
            aria-labelledby={`uhone-hub-sec-${section.id}`}
          >
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
              <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 text-[hsl(var(--custom))]">
                    <Icon className="h-6 w-6" aria-hidden />
                    <span className="text-xs font-bold uppercase tracking-widest opacity-90">
                      UnitedHealthOne
                    </span>
                  </div>
                  <h2
                    id={`uhone-hub-sec-${section.id}`}
                    className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    {t(`sections.${section.id}.title`)}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                    {t(`sections.${section.id}.subtitle`)}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {section.productIds.map((pid) => (
                  <article
                    key={pid}
                    className="group flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <h3 className="text-lg font-semibold leading-snug text-foreground">
                      {t(`products.${pid}.title`)}
                    </h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {t(`products.${pid}.body`)}
                    </p>
                    <p className="mt-3 text-xs font-medium text-muted-foreground">
                      {t("labels.time")}: {t(`products.${pid}.time`)}
                    </p>
                    <div className="mt-5 border-t border-border/60 pt-5">
                      <ProductQuoteBlock productId={pid} t={t} />
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Isaac CTA */}
      <section
        className="border-b border-border/60 bg-gradient-to-br from-[hsl(var(--custom)/0.08)] to-background py-14 sm:py-16"
        aria-labelledby="uhone-hub-isaac-cta"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <Pill className="mx-auto h-10 w-10 text-[hsl(var(--custom))]" aria-hidden />
          <h2
            id="uhone-hub-isaac-cta"
            className="mt-4 text-2xl font-bold tracking-tight"
          >
            {t("ctaBand.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("ctaBand.body")}
          </p>
          <div className="mt-8 flex justify-center">
            <ShortTermMedicalButton emphasize />
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 dark:bg-amber-500/[0.08]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            {t("disclaimer.title")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t("disclaimer.body")}
          </p>
        </div>
      </section>
    </main>
  );
}
