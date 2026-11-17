/*
 * app/[locale]/health-alternative/intake/[token]/presentation/page.tsx — the Impact sales deck for
 * one client (agent only).
 *
 * Opened from the agent's intake form in a new tab, which the agent shares through CrankWheel. The
 * client's name and start date come from the intake. Middleware marks the route private (no chat,
 * trackers or admin gear on the client's screen) and gives it the slim header, whose language
 * switch flips the deck.
 */

import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect as redirectTo } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getIsAdmin } from "@/lib/auth/admin";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import { getIntakeByToken, type IntakeSessionRow } from "@/lib/intake-core/server";
import {
  businessToday,
  earliestMonthStart,
  formatIsoLong,
  isValidMonthStart,
  toIso,
} from "@/lib/intake-core/month-start";
import { resolveCrmContactLocale } from "@/lib/iul-intake/server";
import { decryptIntakeData } from "@/lib/intake-core/sensitive";
import type { IntakeData } from "@/lib/intake-core/types";
import {
  ageOn,
  householdFromIntake,
  householdSize,
  SENIOR_AGE,
  type ImpactQuote,
} from "@/lib/impact-quote/plans";
import { fetchImpactPlans } from "@/lib/impact-quote/server";
import { getLicensedStateCount } from "@/lib/licensed-states";
import ImpactPresentation from "@/components/impact-presentation/impact-presentation";
import { buildImpactSlides } from "@/components/impact-presentation/slides";
import type { DeckLocale } from "@/components/impact-presentation/copy";

export const metadata: Metadata = {
  title: "Impact Health Sharing",
  robots: { index: false, follow: false, nocache: true },
  // The token in this URL is the intake's credential.
  referrer: "no-referrer",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The client's language: their CRM `spanish` tag, else the session's (the meeting link's rule). */
async function clientLocale(row: IntakeSessionRow): Promise<DeckLocale> {
  const fallback: DeckLocale = row.locale === "es" ? "es" : "en";
  const creds = agentCrmGetBaseCredentials();
  if (!row.crmContactId || !creds) return fallback;
  return resolveCrmContactLocale(row.crmContactId, fallback, creds.token);
}

/** The start date the client picked, or Impact's earliest 1st when there is no valid pick yet. */
function coverageStart(row: IntakeSessionRow, locale: DeckLocale): string {
  const picked = str(row.data?.requestedEffectiveDate);
  const iso = isValidMonthStart(picked, IMPACT_LAST_PAYMENT_DAY)
    ? picked
    : toIso(earliestMonthStart(businessToday(), IMPACT_LAST_PAYMENT_DAY));
  return formatIsoLong(iso, locale);
}

/**
 * Impact's prices for the household the intake describes (how many people, the oldest birth
 * date), or null when the form doesn't say yet or Impact's service is down. The agent's quote
 * panel can always supply prices afterwards.
 */
async function initialQuote(row: IntakeSessionRow): Promise<ImpactQuote | null> {
  const config = requireIntakeConfig("health-alternative");
  const data = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
  const { people, oldestDob } = householdFromIntake(data);
  if (!oldestDob) return null;
  const oldestAge = ageOn(oldestDob);
  const members = oldestAge !== null && oldestAge >= SENIOR_AGE ? 1 : householdSize(people);
  const plans = await fetchImpactPlans(oldestDob, members);
  return plans ? { plans, members, oldestAge, source: "impact" } : null;
}

async function licensedStates(): Promise<number> {
  try {
    return await getLicensedStateCount();
  } catch {
    return 0;
  }
}

export default async function ImpactPresentationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { token } = await params;
  const { lang } = await searchParams;
  const locale: DeckLocale = (await getLocale()) === "es" ? "es" : "en";

  const { userId } = await auth();
  if (!userId) redirectTo(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
  if (!(await getIsAdmin())) redirectTo(`/${locale}/unauthorized`);

  const row = await getIntakeByToken(requireIntakeConfig("health-alternative"), token);
  // One answer for "no such intake" and "not yours", as in the meeting API.
  if (!row || row.ownerUserId !== userId) notFound();

  // The intake's button asks for the client's language. The header's switch never sends `lang`,
  // so a deliberate switch is left alone.
  if (lang === "client") {
    const wanted = await clientLocale(row);
    if (wanted !== locale) {
      redirect({
        href: { pathname: "/health-alternative/intake/[token]/presentation", params: { token } },
        locale: wanted,
      });
    }
  }

  const firstName = str(row.data?.firstName) || (row.contactName ?? "").trim().split(/\s+/)[0] || "";
  const slides = buildImpactSlides({
    locale,
    firstName,
    startDate: coverageStart(row, locale),
    licensedStates: await licensedStates(),
    agentIbo: process.env.IMPACT_AGENT_IBO?.trim() || null,
    token,
    quote: await initialQuote(row),
  });

  return <ImpactPresentation token={token} locale={locale} slides={slides} />;
}
