import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { IMPACT_LAST_PAYMENT_DAY } from "@/lib/intake-configs/impact-schedule";
import { businessToday, earliestMonthStart, formatLongDate } from "@/lib/intake-core/month-start";
import { ageOn, pricedMembers, SENIOR_AGE, TIERS } from "@/lib/impact-quote/plans";
import { quoteImageFileSlug, renderQuoteImage } from "@/lib/impact-quote/quote-image";
import { quoteImageRequestSchema } from "@/lib/impact-quote/quote-image-request";
import { fetchImpactPlans } from "@/lib/impact-quote/server";
import { isaacQuoteImageProfile } from "@/lib/tenancy/isaac-profile";

/**
 * POST /api/admin/impact-quote-image — the shareable Impact quote for anyone Isaac quotes on
 * /impact, with no intake: `{applicant, others[], tier, lang, asked, oldestDob}` in, a PNG out.
 *
 * Admin only (middleware gates /api/admin too). The names ride in the body, never in a URL, and
 * are never logged. The price is never taken from the browser: it is asked of Impact again for
 * the quote's two answers. The start line is the earliest 1st Impact allows today, as /impact
 * shows it.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = "private, no-store";
const fail = (status: number, error: string) =>
  NextResponse.json({ success: false, error }, { status, headers: { "Cache-Control": NO_STORE } });

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return fail(401, "Unauthorized");
    if (!(await getIsAdmin())) return fail(403, "Forbidden");

    const parsed = quoteImageRequestSchema.safeParse(await request.json().catch(() => null));
    const age = parsed.success ? ageOn(parsed.data.oldestDob) : null;
    if (!parsed.success || age === null) return fail(400, "Check the names and the quote.");
    const { applicant, others, tier, lang, asked, oldestDob } = parsed.data;

    const plans = await fetchImpactPlans(oldestDob, pricedMembers(asked, age));
    const monthly = plans?.find((plan) => plan.tier === tier)?.monthly;
    if (!monthly) return fail(502, "Impact gave no price for this plan.");

    const png = await renderQuoteImage({
      locale: lang,
      applicant,
      members: others,
      tier,
      pra: TIERS.find((t) => t.key === tier)?.pra ?? 0,
      monthly,
      startDate: formatLongDate(earliestMonthStart(businessToday(), IMPACT_LAST_PAYMENT_DAY), lang),
      startLabel: "earliest",
      household: { asked, senior: age >= SENIOR_AGE },
      origin: request.nextUrl.origin,
      agent: isaacQuoteImageProfile(),
    });

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="impact-${quoteImageFileSlug(applicant)}.png"`,
        "Cache-Control": NO_STORE,
      },
    });
  } catch (error) {
    // The message only: a request's names never reach the logs.
    console.error("[admin/impact-quote-image] POST failed:", error instanceof Error ? error.message : "unknown error");
    return fail(500, "Failed to create the image");
  }
}
