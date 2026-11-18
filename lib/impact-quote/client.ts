/**
 * Asks `/api/impact/quote` for a household's four prices. Client-side; null when Impact's service
 * doesn't answer (the caller offers WhatsApp or typed prices instead).
 */

import type { HouseholdSize, ImpactPlan } from "./plans";

export type QuoteAnswer = {
  plans: ImpactPlan[];
  members: HouseholdSize;
  age: number;
  senior: boolean;
  under18: boolean;
};

export async function requestImpactQuote(dob: string, members: HouseholdSize): Promise<QuoteAnswer | null> {
  try {
    const res = await fetch(`/api/impact/quote?dob=${dob}&members=${members}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) return null;
    return { plans: json.plans, members: json.members, age: json.age, senior: json.senior, under18: json.under18 };
  } catch {
    return null;
  }
}

/** `YYYY-MM-DD` from select values, or "" while incomplete. */
export function dobFromParts(month: string, day: string, year: string): string {
  return month && day && year ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
}
