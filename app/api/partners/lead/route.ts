import { NextResponse, type NextRequest } from "next/server";
import {
  shortTermMedicalFormSchema,
  capitalizeName,
} from "@/lib/validation/shortTermMedicalSchema";
import { getPartnerBySlug } from "@/lib/referral-partners/server";
import { intakeReferralLead, normalizePhoneToE164 } from "@/lib/referral-partners/lead-intake";

/**
 * Lead capture for a referral partner's co-branded landing page (/partners/<slug>).
 *
 * The actual work — our row first, then the CRM push with the referral tags — lives in
 * lib/referral-partners/lead-intake.ts, shared with the admin's manual-entry route so a referral
 * typed in by hand is indistinguishable from one that came through this form.
 */

const LOG = "[partner-lead]";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
    if (!slug) {
      return NextResponse.json({ success: false, error: "Missing partner" }, { status: 400 });
    }

    const partner = await getPartnerBySlug(slug);
    if (!partner || partner.status !== "active") {
      return NextResponse.json({ success: false, error: "Unknown partner" }, { status: 404 });
    }

    const parsed = shortTermMedicalFormSchema.safeParse({
      firstName: String(body.firstName ?? ""),
      lastName: String(body.lastName ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
    });
    if (!parsed.success) {
      // The client validates the same schema, so a failure here is a bot or a hand-rolled POST.
      // Field-level messages would only help those callers; the form never surfaces this.
      const fields = [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
      return NextResponse.json(
        { success: false, error: "Invalid submission", fields },
        { status: 400 }
      );
    }

    const { lead } = await intakeReferralLead({
      partner,
      firstName: capitalizeName(parsed.data.firstName.trim()),
      lastName: capitalizeName(parsed.data.lastName.trim()),
      email: parsed.data.email.trim().toLowerCase(),
      phone: normalizePhoneToE164(parsed.data.phone),
      locale: body.locale === "es" ? "es" : "en",
      smsConsent: body.smsConsent === true,
      marketingConsent: body.marketingConsent === true,
      origin: "form",
      meta: body.meta ?? undefined,
    });

    // Success even when the CRM push failed: the prospect did nothing wrong, the lead is durably
    // ours, and it surfaces in /admin/referral-partners for recovery.
    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error(`${LOG} Unhandled error:`, error);
    return NextResponse.json({ success: false, error: "Failed to submit" }, { status: 500 });
  }
}
