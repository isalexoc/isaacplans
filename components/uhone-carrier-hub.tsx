import {
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
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import {
  UHONE_ALL_PLANS_BUTTON_IMAGE_URL,
  UHONE_ALL_PLANS_CENSUS_URL,
  UHONE_UHC_LOGO_URL,
  uhoneMarketingAssetUrl,
  uhoneShopCensusUrl,
} from "@/lib/uhone-broker";
import {
  UHONE_HUB_PRODUCT_CONFIG,
  UHONE_HUB_SECTIONS,
  type UhoneHubProductId,
  type UhoneHubSectionId,
} from "@/lib/uhone-hub-products";

/** Cloudinary: f_auto, q_auto, bounded dimensions, smart crop for hero */
const UHONE_HUB_HERO_IMAGE =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1600,h_1200,c_fill,g_auto/v1774717951/pexels-silverkblack-36729904_ulbsz4.jpg";

/** UnitedHealthcare mark — f_auto, q_auto, capped width for crisp logos */
const UHONE_HUB_UHC_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_480,c_limit/v1774718587/united-healthcare-logo_avzxnj.png";

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
    <div className="flex w-full min-w-0 flex-col gap-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
        aria-label={`${t(`products.${productId}.title`)} — ${t("labels.ctaQuote")}`}
      >
        {banner ? (
          <span className="block w-full overflow-hidden rounded-xl bg-muted/40 shadow-sm ring-1 ring-border/60 transition group-hover:shadow-md group-hover:ring-border dark:bg-muted/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner}
              alt=""
              width={560}
              height={140}
              className="block h-auto w-full object-contain object-center"
              loading="lazy"
              decoding="async"
            />
          </span>
        ) : (
          <span className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] px-5 py-3 text-sm font-semibold text-white shadow-md transition group-hover:brightness-110">
            {t("labels.ctaQuote")}
          </span>
        )}
      </a>
    </div>
  );
}

export default function UhoneCarrierHub({ t }: UhoneCarrierHubProps) {
  return (
    <main id="uhone-hub-main" className="text-foreground">
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[hsl(var(--custom)/0.1)] via-background to-background"
        aria-labelledby="uhone-hub-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.28] dark:opacity-[0.18]"
          aria-hidden
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
            backgroundSize: "30px 30px",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-transparent to-transparent" aria-hidden />

        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          {/*
            Mobile column order: badge+title → image → lead+trust → all-plans.
            lg 2×2: [ title | image ] [ lead+trust | all-plans ]
          */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:items-start lg:gap-10 xl:gap-12">
            <div className="motion-safe:animate-fadeUp min-w-0 max-w-3xl">
              <div className="mb-5">
                <Image
                  src={UHONE_UHC_LOGO_URL}
                  alt={t("hero.logoAlt")}
                  width={480}
                  height={140}
                  priority
                  sizes="(max-width: 640px) 220px, 260px"
                  className="h-10 w-auto max-w-[min(100%,260px)] object-contain object-left sm:h-12"
                />
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--custom)/0.28)] bg-background/90 px-4 py-1.5 text-xs font-semibold tracking-wide text-[hsl(var(--custom))] shadow-sm backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("hero.badge")}
              </span>
              <h1
                id="uhone-hub-hero-heading"
                className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.45rem] lg:leading-[1.12]"
              >
                {t("hero.title")}
              </h1>
            </div>

            <figure className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/10 motion-safe:animate-fadeUp-d2 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:ring-white/10">
              <Image
                src={UHONE_HUB_HERO_IMAGE}
                alt={t("hero.imageAlt")}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover object-center"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/5 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] via-transparent to-transparent"
                aria-hidden
              />
            </figure>

            <div className="motion-safe:animate-fadeUp min-w-0 max-w-3xl lg:max-w-none">
              <p className="text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t("hero.lead")}
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {([0, 1, 2] as const).map((i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border/70 bg-card/90 px-4 py-3 text-sm leading-snug text-muted-foreground shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:bg-card/70"
                  >
                    <span className="font-medium text-foreground">
                      {t(`trustStrip.${i}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="rounded-2xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-5 shadow-lg ring-1 ring-black/5 motion-safe:animate-fadeUp-d2 sm:p-6">
              <p className="text-sm font-semibold text-foreground">
                {t("hero.allPlansLabel")}
              </p>
              <a
                href={UHONE_ALL_PLANS_CENSUS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block w-full min-w-0 overflow-hidden rounded-xl bg-muted/40 shadow-sm ring-1 ring-border/60 transition hover:shadow-md hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2 dark:bg-muted/25"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={UHONE_ALL_PLANS_BUTTON_IMAGE_URL}
                  alt={t("hero.allPlansAlt")}
                  width={560}
                  height={120}
                  className="block h-auto w-full object-contain object-center"
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
