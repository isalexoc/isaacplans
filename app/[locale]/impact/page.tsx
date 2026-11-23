/*
 * app/[locale]/impact/page.tsx (es: /impacto) — the self-serve Impact Health Sharing presentation.
 *
 * One general link Isaac shares by WhatsApp or text with leads he can't get on a call. They walk
 * the same story as his CrankWheel deck, one screen at a time, and finish on "Apply now", which
 * starts their own Health Coverage application. Public; middleware gives it the slim header and
 * keeps the CRM chat bubble off it (it would cover the Next button).
 */

import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import ImpactGuide from "@/components/impact-presentation/impact-guide";
import { buildGuideSteps } from "@/components/impact-presentation/guide-steps";
import { DECK_COPY, type DeckLocale } from "@/components/impact-presentation/copy";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import { businessToday, earliestMonthStart, formatLongDate } from "@/lib/intake-core/month-start";
import { getIsAdmin } from "@/lib/auth/admin";
import { getPathname } from "@/i18n/navigation";
import { isaacProfile } from "@/lib/tenancy/isaac-profile";
import { agentContact } from "@/lib/tenancy/profile";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.isaacplans.com";

export async function generateMetadata(): Promise<Metadata> {
  const locale: DeckLocale = (await getLocale()) === "es" ? "es" : "en";
  const t = DECK_COPY[locale];
  const title = `Impact Health Sharing · ${t.welcome.title}`;
  const description = t.welcome.lead;
  const images = [{ url: `${SITE_URL}/images/impact/presentation/og-impact.jpg`, width: 1200, height: 630, alt: "Impact Health Sharing" }];
  return {
    title,
    description,
    // Shared by link, not found by search, like the apply page until Isaac drives traffic to it.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", siteName: "Isaac Plans Insurance", locale: locale === "es" ? "es_US" : "en_US", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function ImpactGuidePage() {
  const locale: DeckLocale = (await getLocale()) === "es" ? "es" : "en";
  // Isaac, signed in as admin: he can walk past the quote, and make a quote image for anyone he quotes.
  const isAdmin = await getIsAdmin();
  // His own guide: his name, photo, number, IBO # (env) and licensed states (Sanity).
  const agent = await isaacProfile();
  const { steps, quoteStep } = buildGuideSteps({
    locale,
    // Nobody has picked a date yet, so the earliest 1st Impact allows today.
    startDate: formatLongDate(earliestMonthStart(businessToday(), IMPACT_LAST_PAYMENT_DAY), locale),
    agent,
    admin: isAdmin,
  });
  // A visitor must quote before "Apply now"; Isaac can walk straight through. "Apply now" is the
  // same localized address next-intl's Link always drew, worked out here on the server.
  return (
    <ImpactGuide
      locale={locale}
      steps={steps}
      quoteStep={quoteStep}
      canSkipQuote={isAdmin}
      agent={agentContact(agent)}
      applyHref={getPathname({ href: "/health-alternative/apply/start", locale })}
    />
  );
}
