import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import { formatIsoLong, isValidMonthStart } from "@/lib/intake-core/month-start";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { decryptIntakeData } from "@/lib/intake-core/sensitive";
import { getIntakeByToken } from "@/lib/intake-core/server";
import type { IntakeData, RepeaterRow } from "@/lib/intake-core/types";
import {
  ageOn,
  householdFromIntake,
  householdSize,
  RECOMMENDED_TIER,
  SENIOR_AGE,
  TIERS,
  type ImpactTierKey,
} from "@/lib/impact-quote/plans";
import { quoteImageFileSlug, renderQuoteImage } from "@/lib/impact-quote/quote-image";
import { fetchImpactPlans } from "@/lib/impact-quote/server";
import { resolveCrmContactLocale } from "@/lib/iul-intake/server";

/**
 * GET …/quote-image?tier=esencial&monthly=306&lang=es — the shareable Impact quote as a PNG.
 *
 * Agent only (admin + owner of the intake): it carries the client's and their family's names.
 * Names come from the form; the plan and price from the agent's panel (what's on screen there),
 * else from the form's "Your plan", else Esencial at Impact's price for the household. The
 * language is the panel's choice, else the client's (CRM `spanish` tag, then the session).
 */

type RouteContext = { params: Promise<{ lob: string; token: string }> };

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const fullName = (first: unknown, last: unknown) => [str(first), str(last)].filter(Boolean).join(" ");

function isTier(v: unknown): v is ImpactTierKey {
  return typeof v === "string" && TIERS.some((t) => t.key === v);
}

/** The monthly price: the panel's, the form's, or Impact's for this household. Null if none. */
async function monthlyFor(tier: ImpactTierKey, asked: number, data: IntakeData): Promise<number | null> {
  if (asked > 0) return asked;
  if (data.impactPlan === tier && Number(data.impactMonthly) > 0) return Number(data.impactMonthly);
  const { people, oldestDob } = householdFromIntake(data);
  if (!oldestDob) return null;
  const age = ageOn(oldestDob);
  const plans = await fetchImpactPlans(oldestDob, age !== null && age >= SENIOR_AGE ? 1 : householdSize(people));
  return plans?.find((p) => p.tier === tier)?.monthly ?? null;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return fail(401, "Unauthorized");
    if (!(await getIsAdmin())) return fail(403, "Forbidden");
    const config = resolveConfig(lob);
    if (!config?.impactPresentation) return fail(404, "Not found");
    const row = await getIntakeByToken(config, token);
    if (!row) return fail(404, "Not found");
    if (row.ownerUserId !== userId) return fail(403, "Forbidden");

    const params = request.nextUrl.searchParams;
    const data = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    const tier: ImpactTierKey = isTier(params.get("tier")) ? (params.get("tier") as ImpactTierKey) : isTier(data.impactPlan) ? data.impactPlan : RECOMMENDED_TIER;
    const monthly = await monthlyFor(tier, Number(params.get("monthly")) || 0, data);
    if (!monthly) return fail(400, "Quote the household first.");

    const lang = params.get("lang");
    let locale: "en" | "es" = lang === "es" || lang === "en" ? lang : row.locale === "es" ? "es" : "en";
    const creds = agentCrmGetBaseCredentials();
    if (!lang && row.crmContactId && creds) locale = await resolveCrmContactLocale(row.crmContactId, locale, creds.token);

    const applicant = fullName(data.firstName, data.lastName) || str(row.contactName) || "—";
    const members =
      data.hasDependents === "yes" && Array.isArray(data.dependents)
        ? (data.dependents as RepeaterRow[]).map((r) => fullName(r.firstName, r.lastName)).filter(Boolean)
        : [];
    const start = str(data.requestedEffectiveDate);

    const png = await renderQuoteImage({
      locale,
      applicant,
      members,
      tier,
      pra: TIERS.find((t) => t.key === tier)?.pra ?? 0,
      monthly,
      startDate: isValidMonthStart(start, IMPACT_LAST_PAYMENT_DAY) ? formatIsoLong(start, locale) : null,
      origin: request.nextUrl.origin,
    });

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="impact-${quoteImageFileSlug(applicant)}.png"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`[intake/${lob}/:token/quote-image] GET`, error);
    return fail(500, "Failed to create the image");
  }
}
