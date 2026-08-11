import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { capitalizeName } from "@/lib/validation/shortTermMedicalSchema";
import { getPartnerById } from "@/lib/referral-partners/server";
import {
  hasUsablePhone,
  intakeReferralLead,
  normalizePhoneToE164,
} from "@/lib/referral-partners/lead-intake";
import { REFERRAL_LEAD_STATUSES } from "@/lib/referral-partners/types";
import type { ReferralLeadStatus } from "@/lib/referral-partners/types";

/**
 * Add a referral by hand — for when a partner texts over a name and a number instead of sending
 * the person to their landing page.
 *
 * Runs the same intake as the public form, so the contact lands in Agent CRM with the same
 * referral tags and shows on the partner's dashboard identically. Email is optional here (a
 * texted referral usually has none); phone is what we actually need to work the lead.
 */

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!(await getIsAdmin())) {
    return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
  }
  return null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: partnerId } = await params;
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json({ success: false, error: "Partner not found" }, { status: 404 });
    }

    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const rawPhone = String(body.phone ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: "First and last name are required" },
        { status: 400 }
      );
    }
    if (!hasUsablePhone(rawPhone)) {
      return NextResponse.json(
        { success: false, error: "Enter a valid 10-digit US phone number" },
        { status: 400 }
      );
    }
    if (email && !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "That email doesn't look valid — leave it blank if you don't have one" },
        { status: 400 }
      );
    }

    const status: ReferralLeadStatus = REFERRAL_LEAD_STATUSES.includes(body.status)
      ? body.status
      : "new";

    const { lead, crmContactId, crmError } = await intakeReferralLead({
      partner,
      firstName: capitalizeName(firstName),
      lastName: capitalizeName(lastName),
      email: email || undefined,
      phone: normalizePhoneToE164(rawPhone),
      locale: body.locale === "en" ? "en" : partner.defaultLocale,
      smsConsent: body.smsConsent === true,
      marketingConsent: body.marketingConsent === true,
      origin: "manual",
      status,
      notes: String(body.notes ?? "").trim(),
    });

    // Unlike the public form, the admin SHOULD know the CRM push failed — they're the one who can
    // fix it. The lead is saved either way, so this is a warning rather than an error.
    return NextResponse.json({ success: true, lead, crmContactId, crmWarning: crmError });
  } catch (error) {
    console.error("[admin/referral-partners/:id/leads] create", error);
    return NextResponse.json({ success: false, error: "Failed to add referral" }, { status: 500 });
  }
}
