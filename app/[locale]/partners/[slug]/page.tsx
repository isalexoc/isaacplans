import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, Check, Phone } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PartnerLeadForm from "@/components/referral-partners/partner-lead-form";
import { getPartnerBySlug } from "@/lib/referral-partners/server";
import {
  PARTNER_DEFAULT_AUDIENCE,
  PARTNER_DEFAULT_HEADLINE,
  PARTNER_DEFAULT_INTRO,
  pickCopy,
} from "@/lib/referral-partners/content";
import { partnerHeroImage, partnerSectionImage } from "@/lib/referral-partners/images";
import { FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT } from "@/lib/get-covered-fast/constants";
import { routing } from "@/i18n/routing";

const ISAAC_LOGO =
  "https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_120,h_120,c_fill,g_auto/isaacplanslogo_tkraak.png";

const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";

/** Partner records change from the admin tool, so never cache this page across requests. */
export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const partner = await getPartnerBySlug(slug);
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: safeLocale, namespace: "partnerReferral.metadata" });

  if (!partner || partner.status !== "active") {
    return { title: t("title", { partner: "" }).trim(), robots: { index: false, follow: false } };
  }

  return {
    title: t("title", { partner: partner.companyName }),
    description: t("description"),
    // Meant to be shared by the partner, not found in search — and two partner pages pitching the
    // same product would otherwise compete with our own pages for the same terms.
    robots: { index: false, follow: true },
    openGraph: {
      title: t("title", { partner: partner.companyName }),
      description: t("description"),
      type: "website",
    },
  };
}

export default async function PartnerLandingPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const safeLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const copyLocale = safeLocale === "es" ? "es" : "en";

  const partner = await getPartnerBySlug(slug);
  if (!partner || partner.status !== "active") notFound();

  const t = await getTranslations({ locale: safeLocale, namespace: "partnerReferral" });

  const headline = pickCopy(
    copyLocale === "es" ? partner.headlineEs : partner.headlineEn,
    PARTNER_DEFAULT_HEADLINE,
    copyLocale
  );
  const intro = pickCopy(
    copyLocale === "es" ? partner.introEs : partner.introEn,
    PARTNER_DEFAULT_INTRO,
    copyLocale
  );
  const audience = pickCopy(
    copyLocale === "es" ? partner.audienceEs : partner.audienceEn,
    PARTNER_DEFAULT_AUDIENCE,
    copyLocale
  );

  const accent = partner.accentColor;
  const benefits = t.raw("benefits.items") as { title: string; body: string }[];
  const steps = t.raw("steps.items") as { title: string; body: string }[];
  const faqs = t.raw("faq.items") as { q: string; a: string }[];

  // The public-charge blocks are opt-in per partner: this copy is written for someone with a
  // pending case and would read as nonsense on, say, a realtor's referral page.
  const isImmigration = partner.audienceKind === "immigration";
  const factorItems = isImmigration ? (t.raw("factors.items") as string[]) : [];
  const situations = isImmigration
    ? (t.raw("situations.items") as { title: string; body: string }[])
    : [];

  return (
    <main className="bg-white dark:bg-slate-950">
      {/* ── Co-branded bar: the client sees immediately who vouched for us ── */}
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-4 px-4 py-4 sm:gap-6">
          <Image
            src={ISAAC_LOGO}
            alt="Isaac Plans Insurance"
            width={44}
            height={44}
            className="h-11 w-11 rounded-lg object-contain"
          />
          <span className="text-lg font-light text-slate-300 dark:text-slate-600">×</span>
          {partner.logoUrl ? (
            <Image
              src={partner.logoUrl}
              alt={partner.companyName}
              width={132}
              height={44}
              unoptimized
              className="h-11 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <span
              className="text-base font-bold tracking-tight sm:text-lg"
              style={{ color: accent }}
            >
              {partner.companyName}
            </span>
          )}
        </div>
      </div>

      {/* ── Hero: copy left, photo right ── */}
      <section
        className="relative overflow-hidden"
        style={{ backgroundImage: `linear-gradient(160deg, ${accent}14 0%, transparent 60%)` }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div>
            <span
              className="inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold sm:text-sm"
              style={{ backgroundColor: `${accent}1a`, color: accent }}
            >
              <BadgeCheck className="h-4 w-4 flex-shrink-0" />
              {t("badge", { partner: partner.companyName })}
            </span>

            <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">
              {headline}
            </h1>

            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">
              {intro}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#request"
                className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:brightness-110"
                style={{ backgroundColor: accent }}
              >
                {t("heroCta")}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how"
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-300 px-6 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t("heroSecondaryCta")}
              </a>
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("heroNote")}
            </p>
          </div>

          {/* PLACEHOLDER art — swap per partner in /admin/referral-partners. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl lg:aspect-[5/6]">
            <Image
              src={partnerHeroImage(partner.heroImageUrl)}
              alt={t("heroImageAlt")}
              fill
              unoptimized
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* ── The form. Its own section so the hero can stay visual. ── */}
      <section id="request" className="scroll-mt-4 border-y border-slate-200 bg-slate-50 px-4 py-12 dark:border-slate-800 dark:bg-slate-900/40 sm:py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("form.title")}</h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{t("form.subtitle")}</p>
          <div className="mt-6">
            <PartnerLeadForm partnerSlug={partner.slug} accentColor={accent} />
          </div>
        </div>
      </section>

      {/* ── What the government weighs (immigration partners only) ── */}
      {isImmigration && (
        <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            {/* PLACEHOLDER art — swap per partner in /admin/referral-partners. */}
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-lg">
              <Image
                src={partnerSectionImage(partner.sectionImageUrl)}
                alt={t("factors.imageAlt")}
                fill
                unoptimized
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>

            <div>
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {t("factors.label")}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t("factors.title")}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                {t("factors.body")}
              </p>

              <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
                {factorItems.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                  >
                    <Check className="h-4 w-4 flex-shrink-0" style={{ color: accent }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── Why people come to us (immigration partners only) ── */}
      {isImmigration && (
        <section className="border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: accent }}
              >
                {t("situations.label")}
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t("situations.title")}
              </h2>
              {audience && (
                <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {audience}
                </p>
              )}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {situations.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>

            {/* The honest caveat sits with the claims it qualifies, not buried in a footer. */}
            <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {t("situations.footnote", { partner: partner.companyName })}
            </p>
          </div>
        </section>
      )}

      {/* ── Benefits ── */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            {t("benefits.label")}
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {t("benefits.title")}
          </h2>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div
                className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${accent}1a` }}
              >
                <Check className="h-4 w-4" style={{ color: accent }} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{benefit.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {benefit.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        id="how"
        className="scroll-mt-8 border-y border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40"
      >
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
              {t("steps.label")}
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.title")}
            </h2>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold text-white"
                  style={{ backgroundColor: accent }}
                >
                  {index + 1}
                </div>
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Who you'll talk to ── */}
      <section className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
        <div className="flex flex-col items-center gap-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-start sm:p-8">
          <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl ring-4 ring-slate-100 dark:ring-slate-800">
            <Image
              src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
              alt={t("agent.photoAlt")}
              width={192}
              height={192}
              className="h-full w-full object-cover object-[center_20%]"
              sizes="96px"
            />
          </div>
          <div className="text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
              {t("agent.label")}
            </span>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
              {t("agent.name")}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("agent.title")}
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {t("agent.body")}
            </p>
            <a
              href={CRM_PHONE_TEL}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
              style={{ color: accent }}
            >
              <Phone className="h-4 w-4" />
              {CRM_PHONE_DISPLAY}
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:py-20">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
              {t("faq.label")}
            </span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("faq.title")}
            </h2>
          </div>

          <Accordion type="single" collapsible className="mt-8 w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.q} value={`faq-${index}`}>
                <AccordionTrigger className="text-left text-base font-semibold text-slate-900 hover:no-underline dark:text-white">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {faq.a.replace(/\{partner\}/g, partner.companyName)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="px-4 py-14 sm:py-20">
        <div
          className="mx-auto max-w-4xl rounded-3xl px-6 py-12 text-center sm:px-12"
          style={{ backgroundImage: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}
        >
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            {t("closing.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base text-white/90">{t("closing.body")}</p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <a
              href="#request"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold shadow-lg transition-transform hover:scale-[1.02]"
              style={{ color: accent }}
            >
              {t("closing.cta")}
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={CRM_PHONE_TEL} className="text-sm font-semibold text-white/90 hover:text-white">
              {t("closing.call", { phone: CRM_PHONE_DISPLAY })}
            </a>
          </div>
        </div>
      </section>

      {/* ── Partnership disclosure: enrolling is optional and independent ── */}
      <section className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {t("partnership.label")}
          </span>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t("partnership.body", { partner: partner.companyName })}
          </p>
          {partner.website && (
            <a
              href={partner.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold hover:underline"
              style={{ color: accent }}
            >
              {partner.companyName} →
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
