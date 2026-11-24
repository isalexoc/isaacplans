import { NextResponse, type NextRequest } from "next/server";

import { gateFrontDoor } from "@/lib/lead-guard/server";
import { processPartnerLead } from "@/lib/referral-partners/public-lead";

/**
 * Lead capture for a referral partner's co-branded landing page (/partners/<slug>).
 *
 * Lead Guard judges the browser's request first, before any database read: a blocked bot never
 * wakes Neon, a held lead is stored for Isaac and replayed through `processPartnerLead` on release.
 * The work itself — our row first, then the CRM push with the referral tags — lives in
 * lib/referral-partners/ (public-lead.ts → lead-intake.ts), shared with the admin's manual entry.
 */

const LOG = "[partner-lead]";
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: "Request too large" }, { status: 413 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid submission" }, { status: 400 });
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ success: false, error: "Invalid submission" }, { status: 400 });
    }
    const input = parsed as Record<string, unknown>;

    const gate = await gateFrontDoor(request, input, {
      surface: "partner_lead",
      route: "/api/partners/lead",
      contact: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        language: input.locale,
        smsConsent: input.smsConsent,
        marketingConsent: input.marketingConsent,
      },
    });
    if (gate.kind === "unavailable") {
      return NextResponse.json({ success: false, error: "We couldn't save your request. Please try again." }, { status: 503 });
    }
    if (gate.kind !== "proceed") {
      return NextResponse.json({ success: true, leadId: null });
    }

    const result = await processPartnerLead(gate.body, gate.visitor);
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(`${LOG} Unhandled error:`, error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: "Failed to submit" }, { status: 500 });
  }
}
