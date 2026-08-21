import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  HelpCircle,
  Layers,
  LayoutTemplate,
  MessageSquare,
  PhoneCall,
  Quote,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Unlock,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AgentCrmCta from "@/components/agent-crm/agent-crm-cta";
import AgentCrmLeadForm from "@/components/agent-crm/agent-crm-lead-form";
import AgentCrmWalkthrough from "@/components/agent-crm/agent-crm-video";
import {
  AGENT_CRM_ISAAC_PHOTO,
  agentCrmOgImage,
  agentCrmVideo,
} from "@/lib/agent-crm-affiliate";
import { routing } from "@/i18n/routing";

type PageProps = { params: Promise<{ locale: string }> };

type Item = { title: string; body: string };
type Faq = { question: string; answer: string };

/** Positional icons for `agentCrm.problem.items` — four pains, in the order they're written. */
const PROBLEM_ICONS: LucideIcon[] = [Layers, Clock, Wallet, HelpCircle];

/** Positional icons for `agentCrm.features.items`. */
const FEATURE_ICONS: LucideIcon[] = [
  Users,
  Zap,
  MessageSquare,
  CalendarCheck,
  LayoutTemplate,
  Star,
  BarChart3,
  Smartphone,
];

/** Positional icons for `agentCrm.bonus.items`. */
const BONUS_ICONS: LucideIcon[] = [PhoneCall, Users];

/** Positional icons for `agentCrm.trial.items`. */
const TRIAL_ICONS: LucideIcon[] = [Unlock, ShieldCheck, CalendarClock];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: "agentCrm.metadata" });

  const title = t("title");
  const description = t("description");
  const alt = t("imageAlt");
  // Per-language share card — an agent forwarding this to another agent should see a card written
  // in the language the link actually opens in.
  const image = agentCrmOgImage(safeLocale === "es" ? "es" : "en");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "Isaac Plans Insurance",
      locale: safeLocale === "es" ? "es_ES" : "en_US",
      type: "website",
      url: `https://www.isaacplans.com/${safeLocale}/agent-crm`,
      images: [{ url: image, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt }],
    },
    alternates: {
      canonical: `https://www.isaacplans.com/${safeLocale}/agent-crm`,
      languages: {
        en: "https://www.isaacplans.com/en/agent-crm",
        es: "https://www.isaacplans.com/es/agent-crm",
      },
    },
  };
}

/**
 * /agent-crm — the page Isaac shares with other agents to promote his Agent CRM affiliate link.
 *
 * Aimed at producers, not at clients, which is why nothing on it looks like the rest of the site's
 * lead funnels: no quote form above the fold, no "get covered" language, and the primary action is
 * an outbound link rather than a lead capture. The one capture on the page sits below the FAQ and
 * is deliberately the quieter control — see `agent-crm-lead-form.tsx`.
 */
export default async function AgentCrmPage({ params }: PageProps) {
  const { locale } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: "agentCrm" });

  const trust = t.raw("hero.trust") as string[];
  const problems = t.raw("problem.items") as Item[];
  const features = t.raw("features.items") as Item[];
  const replaces = t.raw("replaces.items") as string[];
  const trials = t.raw("trial.items") as Item[];
  const bonuses = t.raw("bonus.items") as Item[];
  const steps = t.raw("steps.items") as Item[];
  const faqs = t.raw("faq.items") as Faq[];

  const video = agentCrmVideo(safeLocale === "es" ? "es" : "en");

  /* Built inline rather than added as a fifth near-identical `get*FaqLd` helper in lib/seo. */
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <main className="bg-white dark:bg-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* ─────────────────────────── Hero ─────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950">
        {/* Two soft brand-coloured blooms instead of a flat gradient — cheaper than an image and
            it keeps the hero from reading as a generic dark box. */}
        <div
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-accent/20 blur-3xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:py-20 lg:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur sm:text-sm">
            <Sparkles className="h-4 w-4 flex-shrink-0 text-accent" />
            {t("hero.badge")}
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t("hero.title")}
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t("hero.subtitle")}
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <AgentCrmCta
              label={t("hero.cta")}
              placement="hero"
              className="w-full sm:w-auto"
            />
            <a
              href="#walkthrough"
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-white/25 px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10 sm:w-auto sm:text-lg"
            >
              {t("hero.ctaSecondary")}
            </a>
          </div>

          <p className="mx-auto mt-6 max-w-xl text-sm font-medium text-accent">
            {t("hero.bonusNote")}
          </p>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            {trust.map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <Check className="h-4 w-4 flex-shrink-0 text-accent" aria-hidden />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ────────────────────── The walkthrough video ────────────────────── */}
      <section
        id="walkthrough"
        className="scroll-mt-24 bg-slate-100 py-14 dark:bg-slate-900 sm:py-20"
      >
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("video.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("video.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t("video.subtitle")}
            </p>
          </div>

          <div className="mt-9">
            <AgentCrmWalkthrough
              video={video}
              playLabel={t("video.playLabel")}
              placeholderTitle={t("video.placeholderTitle")}
              placeholderBody={t("video.placeholderBody")}
            />
          </div>

          <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
            {t("video.caption")}
          </p>

          <div className="mt-8 flex justify-center">
            <AgentCrmCta label={t("hero.cta")} placement="under_video" />
          </div>
        </div>
      </section>

      {/* ──────────────────── The free trial (risk reversal) ────────────────────
          Sits directly after the walkthrough on purpose: an agent who just watched the video and
          is interested has exactly one question left — what does it cost me to find out? Answering
          it here, before the pitch continues, is worth more than answering it in the FAQ.

          Emerald rather than the brand blue so it reads as a separate promise from the "why
          through my link" card further down, instead of blurring into one offer. */}
      <section className="bg-emerald-50 py-14 dark:bg-emerald-950/20 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white sm:text-sm">
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              {t("trial.label")}
            </span>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("trial.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-700 dark:text-slate-300">
              {t("trial.subtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {trials.map((item, i) => {
              const Icon = TRIAL_ICONS[i] ?? Check;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                    <Icon
                      className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                      aria-hidden
                    />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {t("trial.note")}
          </p>

          <div className="mt-7 flex justify-center">
            <AgentCrmCta label={t("trial.cta")} placement="trial" />
          </div>
        </div>
      </section>

      {/* ───────────────────────── The problem ───────────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("problem.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("problem.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-slate-600 dark:text-slate-300">
              {t("problem.subtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {problems.map((item, i) => {
              const Icon = PROBLEM_ICONS[i] ?? Layers;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                      <Icon className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.body}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────── Who's telling you this ─────────────────── */}
      <section className="bg-slate-50 py-14 dark:bg-slate-900/60 sm:py-16">
        <div className="mx-auto max-w-4xl px-4">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
            {t("isaac.label")}
          </p>
          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-9">
            <Quote className="h-8 w-8 text-custom/40" aria-hidden />
            <p className="mt-4 text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-xl">
              {t("isaac.quote")}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Image
                src={AGENT_CRM_ISAAC_PHOTO}
                alt={t("isaac.photoAlt")}
                width={128}
                height={128}
                className="h-16 w-16 flex-shrink-0 rounded-full object-cover object-[center_20%] ring-2 ring-custom/20"
                sizes="64px"
              />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-white">{t("isaac.name")}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {t("isaac.role")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── What you get ───────────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("features.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("features.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t("features.subtitle")}
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((item, i) => {
              const Icon = FEATURE_ICONS[i] ?? Sparkles;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-custom/10">
                    <Icon className="h-5 w-5 text-custom" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ──────────────────── What it replaces ──────────────────── */}
      <section className="bg-slate-50 py-14 dark:bg-slate-900/60 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("replaces.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("replaces.title")}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t("replaces.body")}
            </p>
            <p className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">
              {t("replaces.footnote")}
            </p>
          </div>

          <ul className="grid gap-2.5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {replaces.map((line) => (
              <li key={line} className="flex items-center gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                </span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {line}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─────────────────── Why through my link (the bonus) ─────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-[#005a8c] p-7 text-white shadow-xl sm:p-10">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-accent sm:text-sm">
                {t("bonus.label")}
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                {t("bonus.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-white/80">
                {t("bonus.subtitle")}
              </p>
            </div>

            <div className="mt-9 grid gap-5 sm:grid-cols-2">
              {bonuses.map((item, i) => {
                const Icon = BONUS_ICONS[i] ?? Sparkles;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-5 w-5 text-white" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/85">{item.body}</p>
                  </div>
                );
              })}
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-white/75">
              {t("bonus.note")}
            </p>

            <div className="mt-7 flex justify-center">
              <AgentCrmCta label={t("bonus.cta")} placement="bonus" variant="light" />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── How to start ───────────────────────── */}
      <section className="bg-slate-50 py-14 dark:bg-slate-900/60 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("steps.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("steps.title")}
            </h2>
          </div>

          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-custom text-base font-extrabold text-custom-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────────────────── FAQ ───────────────────────────── */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("faq.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:text-4xl">
              {t("faq.title")}
            </h2>
          </div>

          {/* Native <details> — an accordion here doesn't need to ship JavaScript, and the
              answers stay in the DOM for crawlers reading the FAQPage markup above. */}
          <div className="mt-9 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-slate-200 bg-white px-5 py-4 open:shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900 outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-custom/40 dark:text-white [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg leading-none text-slate-500 transition-transform group-open:rotate-45 dark:bg-slate-800 dark:text-slate-400"
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── Soft capture: ask me first ──────────────────── */}
      <section className="bg-slate-50 py-14 dark:bg-slate-900/60 sm:py-20">
        <div className="mx-auto max-w-2xl px-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-custom sm:text-sm">
              {t("form.label")}
            </p>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("form.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {t("form.subtitle")}
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <AgentCrmLeadForm />
          </div>
        </div>
      </section>

      {/* ───────────────────────── Final CTA ───────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 py-16 sm:py-20">
        <div
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand/25 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
            {t("finalCta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t("finalCta.subtitle")}
          </p>
          <div className="mt-8 flex justify-center">
            <AgentCrmCta label={t("finalCta.cta")} placement="final" />
          </div>
          <p className="mt-5 text-sm font-medium text-accent">{t("finalCta.note")}</p>

          {/* FTC affiliate disclosure. Kept on the page itself, not only in the footer, because
              this is the page where the relationship actually exists. */}
          <p className="mx-auto mt-12 max-w-2xl border-t border-white/10 pt-6 text-xs leading-relaxed text-slate-500">
            {t("disclosure")}
          </p>
        </div>
      </section>
    </main>
  );
}
