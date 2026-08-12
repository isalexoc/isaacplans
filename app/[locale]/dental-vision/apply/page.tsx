/* app/[locale]/dental-vision/apply/page.tsx — public Dental & Vision "Apply now" landing (noindex until launched). */

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getEffectivePageMedia, getEffectiveOgImageUrl } from "@/lib/page-media/settings";
import HeroMedia from "@/components/media/hero-media";
import LobApplyCta from "@/components/lob-apply-cta";
import {
  ShieldCheck,
  Smile,
  UserCheck,
  Wallet,
  Languages,
  Lock,
  type LucideIcon,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dentalVisionApply.meta");
  const locale = await getLocale();
  // Admin-overridable social card (lib/page-media); falls back to the message-file image.
  const ogImageUrl = await getEffectiveOgImageUrl("dental-vision", "apply", locale, t("image"));

  return {
    title: t("title"),
    description: t("description"),
    // Hidden from search until the agent is ready to drive marketing traffic.
    robots: { index: false, follow: false },
    openGraph: {
      title: t("title"),
      description: t("description"),
      siteName: "Isaac Plans Insurance",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: t("imageAlt") }],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: [{ url: ogImageUrl, alt: t("imageAlt") }],
    },
  };
}

type Card = { title: string; desc: string };

const BENEFIT_ICONS: LucideIcon[] = [Smile, UserCheck, Wallet, Languages];

export default async function DentalVisionApplyPage() {
  const t = await getTranslations("dentalVisionApply");
  const locale = await getLocale();
  // Admin-overridable hero — an image by default, a video once Isaac uploads one.
  const heroMedia = await getEffectivePageMedia("dental-vision", "apply", "hero", locale);
  const benefits = t.raw("benefits") as Card[];
  const steps = t.raw("steps") as Card[];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-950">
      <div className="container mx-auto max-w-4xl px-4 py-10 sm:py-14">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
            {t("hero.badge")}
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Media (placeholder image until real creative is provided) */}
        <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-2xl border shadow-xl shadow-black/10">
          <HeroMedia
            media={heroMedia}
            alt={t("meta.imageAlt")}
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
          />
        </div>

        {/* Primary CTA */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <LobApplyCta lob="dental-vision" label={t("cta")} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> {t("ctaNote")}
          </p>
        </div>

        {/* Benefits */}
        <section className="mt-14">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("benefitsHeading")}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {benefits.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? ShieldCheck;
              return (
                <div
                  key={b.title}
                  className="flex gap-3 rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{b.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-14">
          <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("howItWorksHeading")}
          </h2>
          <ol className="mt-6 space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-950">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand to-accent text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Secure note + final CTA */}
        <div className="mt-12 rounded-2xl border border-green-200 bg-green-50 p-5 text-center dark:border-green-900 dark:bg-green-950/40">
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-800 dark:text-green-300">
            <ShieldCheck className="h-4 w-4" /> {t("secureNote")}
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <LobApplyCta lob="dental-vision" label={t("cta")} />
        </div>
      </div>
    </main>
  );
}
