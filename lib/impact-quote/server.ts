/**
 * Prices from Impact Health Sharing's own quote service.
 *
 * `api.impacthealthsharing.com/api/v1/price` is what Impact's public quote page (Isaac's referral
 * page included) calls from the browser: no key, `dateOfBirth=YYYY-MM-DD` of the oldest applicant
 * and `groupTypeId` 1, 2 or 3 (3 = three or more), answering the four programs' monthly prices.
 *
 * **It is not a published partner API.** Isaac chose to use it (2026-11-17) with typed prices as
 * the fallback, so everything here fails soft: a timeout, an error or an unexpected shape returns
 * null and the slide asks for the prices instead. Responses are cached for a day per
 * (birth date, household size) — Impact's prices change rarely, and the cache keeps a public page
 * from turning into traffic on Impact's service.
 */

import "server-only";
import { plansFromPrograms, type HouseholdSize, type ImpactPlan } from "./plans";

const IMPACT_PRICE_URL = "https://api.impacthealthsharing.com/api/v1/price";
const TIMEOUT_MS = 6000;
const ONE_DAY = 86_400;

export async function fetchImpactPlans(oldestDob: string, members: HouseholdSize): Promise<ImpactPlan[] | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(oldestDob)) return null;
  const url = `${IMPACT_PRICE_URL}?dateOfBirth=${oldestDob}&groupTypeId=${members}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: ONE_DAY },
    });
    if (!res.ok) {
      console.warn(`[impact-quote] price service answered ${res.status}`);
      return null;
    }
    const json = (await res.json().catch(() => null)) as { data?: { Programs?: unknown } } | null;
    const plans = plansFromPrograms(json?.data?.Programs);
    return plans.length ? plans : null;
  } catch (error) {
    console.warn("[impact-quote] price service failed:", error instanceof Error ? error.message : error);
    return null;
  }
}
