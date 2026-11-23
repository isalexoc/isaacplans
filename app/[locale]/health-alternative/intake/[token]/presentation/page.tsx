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
import { notFound, redirect as redirectTo } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
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
  pricedMembers,
  TIERS,
  type HouseholdSize,
  type ImpactQuote,
  type ImpactTierKey,
} from "@/lib/impact-quote/plans";
import { fetchImpactPlans } from "@/lib/impact-quote/server";
import { getIntakeOperator, operatorCrmOptions, operatorOwns } from "@/lib/tenancy/context";
import { crmCredsForOwner, type CrmOwnerOptions } from "@/lib/tenancy/crm";
import { isaacProfile } from "@/lib/tenancy/isaac-profile";
import { agentPublicProfile } from "@/lib/tenancy/profile";
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
async function clientLocale(row: IntakeSessionRow, crm: CrmOwnerOptions): Promise<DeckLocale> {
  const fallback: DeckLocale = row.locale === "es" ? "es" : "en";
  if (!row.crmContactId) return fallback;
  const creds = await crmCredsForOwner(row.ownerUserId, crm);
  if (!creds) return fallback;
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
 * panel can always supply prices afterwards. Also what the slide's questions start from (the size
 * as asked, not the 1 Impact prices from 65) and the plan already on the form.
 */
async function initialQuote(row: IntakeSessionRow): Promise<{
  quote: ImpactQuote | null;
  household: { members: HouseholdSize; oldestDob: string | null };
  initialTier: ImpactTierKey | null;
}> {
  const config = requireIntakeConfig("health-alternative");
  const data = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
  const { people, oldestDob } = householdFromIntake(data);
  const asked = householdSize(people);
  const household = { members: asked, oldestDob };
  const initialTier = TIERS.find((t) => t.key === data.impactPlan)?.key ?? null;
  if (!oldestDob) return { quote: null, household, initialTier };
  const oldestAge = ageOn(oldestDob);
  const members = pricedMembers(asked, oldestAge);
  const plans = await fetchImpactPlans(oldestDob, members);
  return { quote: plans ? { plans, members, oldestAge, source: "impact" } : null, household, initialTier };
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

  // An operator of this line (an admin, or an agent on Health Coverage) who owns this intake.
  const gate = await getIntakeOperator("health-alternative");
  if (!gate.ok) {
    if (gate.status === 401) {
      redirectTo(`/${locale}/sign-in?redirect_url=/${locale}/health-alternative/intake`);
    }
    redirectTo(`/${locale}/unauthorized`);
  }
  const op = gate.operator;

  const row = await getIntakeByToken(requireIntakeConfig("health-alternative"), token);
  // One answer for "no such intake" and "not yours", as in the meeting API. Not yours is audited.
  if (!row || !(await operatorOwns(op, row))) notFound();

  // The intake's button asks for the client's language. The header's switch never sends `lang`,
  // so a deliberate switch is left alone.
  if (lang === "client") {
    const wanted = await clientLocale(row, operatorCrmOptions(op));
    if (wanted !== locale) {
      redirect({
        href: { pathname: "/health-alternative/intake/[token]/presentation", params: { token } },
        locale: wanted,
      });
    }
  }

  const firstName = str(row.data?.firstName) || (row.contactName ?? "").trim().split(/\s+/)[0] || "";
  // The owner's deck (checked above): Isaac's, or the agent's own name, photo, number, IBO # and
  // licenses (ACN P&P §I.6: each IBO shows only their own Business ID).
  const agent = op.kind === "agent" && op.agent ? agentPublicProfile(op.agent) : await isaacProfile();
  const slides = buildImpactSlides({
    locale,
    firstName,
    startDate: coverageStart(row, locale),
    agent,
    token,
    ...(await initialQuote(row)),
  });

  return <ImpactPresentation token={token} locale={locale} slides={slides} />;
}
