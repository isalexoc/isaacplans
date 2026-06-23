/* app/[locale]/iul/apply/page.tsx — public IUL "Apply now" landing (noindex until launched). */

import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import IulApplyVideo from "@/components/iul-apply-video";
import IulApplyCta from "@/components/iul-apply-cta";
import {
  ShieldCheck,
  TrendingUp,
  HeartHandshake,
  PiggyBank,
  Lock,
  type LucideIcon,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("iulApply.meta");
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
      images: [{ url: t("image"), width: 1200, height: 630, alt: t("imageAlt") }],
    },
  };
}

type Card = { title: string; desc: string };

const BENEFIT_ICONS: LucideIcon[] = [TrendingUp, ShieldCheck, HeartHandshake, PiggyBank];

export default async function IulApplyPage() {
  const t = await getTranslations("iulApply");
  const locale = await getLocale();
  const benefits = t.raw("benefits") as Card[];
  const steps = t.raw("steps") as Card[];
  // Localized path Clerk returns to after the sign-in/sign-up modal.
  const startHref = locale === "es" ? "/es/iul/aplicar/start" : "/en/iul/apply/start";
  // Placeholder image until the agent's recording is set via NEXT_PUBLIC_IUL_APPLY_VIDEO_URL.
  const heroImage =
    locale === "es"
      ? "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1280,c_limit/v1767070515/quote_iul_es_bcqglt.png"
      : "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_1280,c_limit/v1767070514/quote_iul_en_cxwq4x.png";

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

        {/* Media (placeholder image until the video is set) */}
        <div className="mt-8">
          <IulApplyVideo
            comingSoonLabel={t("video.comingSoon")}
            imageUrl={heroImage}
            imageAlt={t("meta.imageAlt")}
          />
        </div>

        {/* Primary CTA */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <IulApplyCta label={t("cta")} startHref={startHref} />
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
          <IulApplyCta label={t("cta")} startHref={startHref} />
        </div>
      </div>
    </main>
  );
}
