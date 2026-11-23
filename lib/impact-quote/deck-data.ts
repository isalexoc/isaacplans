/**
 * What the Impact deck's page reads from one application: the client's first name, the start date
 * and the household's quote. Shared by Isaac's deck (/health-alternative/intake/[token]/
 * presentation) and an agent's (/agent/applications/[token]/presentation). Server-only (it decrypts
 * the application and asks Impact for prices); no CRM here.
 */

import "server-only";
import type { DeckLocale } from "@/components/impact-presentation/copy";
import { requireIntakeConfig } from "@/lib/intake-configs";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import {
  businessToday,
  earliestMonthStart,
  formatIsoLong,
  isValidMonthStart,
  toIso,
} from "@/lib/intake-core/month-start";
import { decryptIntakeData } from "@/lib/intake-core/sensitive";
import type { IntakeSessionRow } from "@/lib/intake-core/server";
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
} from "./plans";
import { fetchImpactPlans } from "./server";

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** The name the welcome slide greets: the form's first name, else the contact's. */
export function deckFirstName(row: IntakeSessionRow): string {
  return str(row.data?.firstName) || (row.contactName ?? "").trim().split(/\s+/)[0] || "";
}

/** The start date the client picked, or Impact's earliest 1st when there is no valid pick yet. */
export function deckCoverageStart(row: IntakeSessionRow, locale: DeckLocale): string {
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
export async function deckInitialQuote(row: IntakeSessionRow): Promise<{
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
