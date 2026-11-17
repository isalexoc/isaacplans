import { NextRequest, NextResponse } from "next/server";
import { ageOn, SENIOR_AGE, type HouseholdSize } from "@/lib/impact-quote/plans";
import { fetchImpactPlans } from "@/lib/impact-quote/server";

/**
 * GET /api/impact/quote?dob=YYYY-MM-DD&members=1|2|3 — Impact's four prices for a household.
 *
 * Public: the self-serve presentation calls it from a visitor's browser, and the agent's quote
 * panel from the intake. It only relays Impact's own public quote (cached a day per input) and
 * stores nothing. `success: false` means "type the prices instead".
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const dob = params.get("dob") ?? "";
  const age = ageOn(dob);
  const asked = Number(params.get("members"));
  if (age === null || ![1, 2, 3].includes(asked)) {
    return NextResponse.json({ success: false, error: "Enter a real date of birth and household size." }, { status: 400 });
  }

  // Impact's own rule: from 65 the Senior Program is one person per membership.
  const senior = age >= SENIOR_AGE;
  const members = (senior ? 1 : asked) as HouseholdSize;
  const plans = await fetchImpactPlans(dob, members);
  if (!plans) return NextResponse.json({ success: false, error: "Impact's prices are not available right now." }, { status: 502 });

  return NextResponse.json({ success: true, plans, members, age, senior, under18: age < 18 });
}
