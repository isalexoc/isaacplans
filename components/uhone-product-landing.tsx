import { CheckCircle2, ListChecks, Shield, Sparkles, Users } from "lucide-react";
import Image from "next/image";
import type { getTranslations } from "next-intl/server";
import ShortTermMedicalButton from "@/components/ShortTermMedicalButton";
import UhoneEnrollmentSteps from "@/components/uhone-enrollment-steps";
import UhoneProductFaq from "@/components/uhone-product-faq";
import {
  UHONE_UHC_LOGO_URL,
  uhoneMarketingAssetUrl,
  uhoneShopCensusUrl,
} from "@/lib/uhone-broker";
import { UHONE_HUB_PRODUCT_CONFIG } from "@/lib/uhone-hub-products";
import {
  getUhoneProductHeroSrc,
  slugToProductId,
  type UhoneProductPageSlug,
} from "@/lib/uhone-product-slugs";

export type UhoneProductLandingProps = {
  slug: UhoneProductPageSlug;
  t: Awaited<ReturnType<typeof getTranslations>>;
};

export default function UhoneProductLanding({ slug, t }: UhoneProductLandingProps) {
  const productId = slugToProductId(slug)!;
  const cfg = UHONE_HUB_PRODUCT_CONFIG[productId];
  const quoteUrl = uhoneShopCensusUrl(cfg.shopSegment);
  const bannerSrc = cfg.bannerFile ? uhoneMarketingAssetUrl(cfg.bannerFile) : null;
  const heroSrc = getUhoneProductHeroSrc(slug);
  const prefix = `${slug}.`;

  const faqItems = [0, 1, 2, 3, 4].map((i) => ({
    q: t(`${prefix}faq.items.${i}.q`),
    a: t(`${prefix}faq.items.${i}.a`),
  }));

  const highlights = t.raw(`${prefix}highlights`) as { title: string; items: string[] };

  const sectionIcons = [CheckCircle2, Users, ListChecks] as const;

  return (
    <main id="uhone-product-main" className="text-foreground">
      <section
        className="relative overflow-hidden border-b border-border/60 bg-gradient-to-b from-[hsl(var(--custom)/0.1)] via-background to-background"
        aria-labelledby="uhone-product-hero-heading"
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

        <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
            <div className="order-2 min-w-0 lg:order-1">
              <div className="mb-5">
                <Image
                  src={UHONE_UHC_LOGO_URL}
                  alt={t("shared.uhcLogoAlt")}
                  width={480}
                  height={140}
                  priority
                  sizes="(max-width: 640px) 220px, 260px"
                  className="h-10 w-auto max-w-[min(100%,260px)] object-contain object-left sm:h-12"
                />
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[hsl(var(--custom)/0.28)] bg-background/90 px-4 py-1.5 text-xs font-semibold tracking-wide text-[hsl(var(--custom))] shadow-sm backdrop-blur-sm">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t(`${prefix}hero.badge`)}
              </span>
              <h1
                id="uhone-product-hero-heading"
                className="mt-5 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-[2.35rem] lg:leading-[1.12]"
              >
                {t(`${prefix}hero.title`)}
              </h1>
              <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t(`${prefix}hero.lead`)}
              </p>
              <div className="mt-8 w-full min-w-0 max-w-xl">
                <a
                  href={quoteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block w-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                  aria-label={`${t(`${prefix}hero.title`)} — ${t("labels.quoteOnUhone")}`}
                >
                  {bannerSrc ? (
                    <span className="block w-full overflow-hidden rounded-xl bg-muted/40 shadow-sm ring-1 ring-border/60 transition group-hover:shadow-md group-hover:ring-border dark:bg-muted/25">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bannerSrc}
                        alt=""
                        width={560}
                        height={140}
                        className="block h-auto w-full object-contain object-center"
                        loading="eager"
                        decoding="async"
                      />
                    </span>
                  ) : (
                    <span className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] px-5 py-3 text-sm font-semibold text-white shadow-md transition group-hover:brightness-110">
                      {t("labels.quoteOnUhone")}
                    </span>
                  )}
                </a>
              </div>
            </div>

            <figure className="relative order-1 aspect-[4/3] w-full min-w-0 overflow-hidden rounded-2xl shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/10 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.45)] dark:ring-white/10 lg:order-2">
              <Image
                src={heroSrc}
                alt={t(`${prefix}hero.title`)}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 44vw"
                className="object-cover object-center"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.12)] via-transparent to-transparent"
                aria-hidden
              />
            </figure>
          </div>
        </div>
      </section>

      <section
        className="border-b border-border/60 py-14 sm:py-16 lg:py-20"
        aria-labelledby="uhone-product-sections-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 id="uhone-product-sections-heading" className="sr-only">
            {t(`${prefix}sections.what.title`)}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {(["what", "who", "confirm"] as const).map((key, i) => {
              const Icon = sectionIcons[i];
              return (
                <article
                  key={key}
                  className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/5"
                >
                  <div className="mb-3 inline-flex rounded-lg bg-[hsl(var(--custom)/0.12)] p-2.5 text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.18)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {t(`${prefix}sections.${key}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {t(`${prefix}sections.${key}.body`)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-b border-border/60 bg-muted/15 py-14 sm:py-16 lg:py-20"
        aria-labelledby="uhone-product-more-heading"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2
            id="uhone-product-more-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            {t(`${prefix}sections.more.title`)}
          </h2>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
            {t(`${prefix}sections.more.body`)}
          </p>
        </div>
      </section>

      <section
        className="border-b border-border/60 py-14 sm:py-16 lg:py-20"
        aria-labelledby="uhone-product-highlights-heading"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-2 text-[hsl(var(--custom))]">
            <Sparkles className="h-6 w-6 shrink-0" aria-hidden />
            <h2
              id="uhone-product-highlights-heading"
              className="text-xl font-bold tracking-tight sm:text-2xl"
            >
              {highlights.title}
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
            {highlights.items.map((text, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-2xl border border-border/80 bg-card p-5 shadow-sm ring-1 ring-black/5"
              >
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--custom))]"
                  aria-hidden
                />
                <span className="text-sm leading-relaxed text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="border-b border-border/60 bg-muted/15 py-12 sm:py-14 lg:py-16"
        aria-labelledby="uhone-product-quote-cta-heading"
      >
        <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-[hsl(var(--custom)/0.06)] to-background p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
            <h2
              id="uhone-product-quote-cta-heading"
              className="text-lg font-semibold leading-snug text-foreground sm:text-xl"
            >
              {t(`${prefix}ctaBand.title`)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`${prefix}ctaBand.body`)}
            </p>
            <div className="mt-6 w-full min-w-0">
              <a
                href={quoteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block w-full min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
                aria-label={`${t(`${prefix}hero.title`)} — ${t("labels.quoteOnUhone")}`}
              >
                {bannerSrc ? (
                  <span className="block w-full overflow-hidden rounded-xl bg-muted/40 shadow-sm ring-1 ring-border/60 transition group-hover:shadow-md group-hover:ring-border dark:bg-muted/25">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bannerSrc}
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
                    {t("labels.quoteOnUhone")}
                  </span>
                )}
              </a>
            </div>
          </div>
        </div>
      </section>

      <UhoneEnrollmentSteps
        title={t("shared.enrollmentSteps.title")}
        subtitle={t("shared.enrollmentSteps.subtitle")}
        step1Title={t("shared.enrollmentSteps.step1Title")}
        step1Body={t("shared.enrollmentSteps.step1Body")}
        step2Title={t("shared.enrollmentSteps.step2Title")}
        step2Body={t("shared.enrollmentSteps.step2Body")}
        step3Title={t("shared.enrollmentSteps.step3Title")}
        step3Body={t("shared.enrollmentSteps.step3Body")}
      />

      <UhoneProductFaq
        title={t(`${prefix}faq.title`)}
        items={faqItems}
        sectionId="uhone-product-faq-heading"
      />

      <section
        className="border-b border-border/60 bg-gradient-to-br from-[hsl(var(--custom)/0.08)] to-background py-14 sm:py-16"
        aria-labelledby="uhone-product-cta-band"
      >
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 id="uhone-product-cta-band" className="text-2xl font-bold tracking-tight">
            {t("shared.contactClosing.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("shared.contactClosing.body")}
          </p>
          <div className="mt-8 flex flex-col items-center">
            <ShortTermMedicalButton emphasize />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6 dark:bg-amber-500/[0.08]">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
            {t(`${prefix}disclaimer.title`)}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t(`${prefix}disclaimer.body`)}
          </p>
        </div>
      </section>
    </main>
  );
}
