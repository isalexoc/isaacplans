import { NextResponse, type NextRequest } from "next/server";
import {
  shortTermMedicalFormSchema,
  capitalizeName,
} from "@/lib/validation/shortTermMedicalSchema";
import { createLead, getPartnerBySlug, updateLead } from "@/lib/referral-partners/server";

/**
 * Lead capture for a referral partner's co-branded landing page (/partners/<slug>).
 *
 * Two writes, in this order and for this reason:
 *   1. Our own referral_partner_leads row — this is what the partner's dashboard counts, and it
 *      must survive a bad day at LeadConnector. Written first, always.
 *   2. Agent CRM via /api/create-contact — the system of record for actually working the lead,
 *      carrying the referral tags that make the partner's leads separable at commission time.
 *
 * If step 2 fails we still return success: the prospect did nothing wrong, the lead is durably
 * ours, and it shows up in /admin/referral-partners for manual recovery. We log loudly instead.
 */

const LOG = "[partner-lead]";

function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

function resolveBaseUrl(): string {
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:${process.env.PORT || 3000}`;
  }
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}

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

    const locale: "en" | "es" = body.locale === "es" ? "es" : "en";
    const firstName = capitalizeName(parsed.data.firstName.trim());
    const lastName = capitalizeName(parsed.data.lastName.trim());
    const email = parsed.data.email.trim().toLowerCase();
    const phone = normalizePhoneToE164(parsed.data.phone);

    const lead = await createLead({
      partnerId: partner.id,
      firstName,
      lastName,
      email,
      phone,
      locale,
    });

    let crmContactId: string | null = null;
    try {
      const response = await fetch(`${resolveBaseUrl()}/api/create-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          healthAlternativeData: {
            language: locale,
            source: `partner_referral_${slug.replace(/-/g, "_")}`,
            smsConsent: body.smsConsent === true,
            marketingConsent: body.marketingConsent === true,
            referralPartnerSlug: partner.slug,
            referralPartnerName: partner.companyName,
            referralPartnerContact: [partner.contactName, partner.contactTitle]
              .filter(Boolean)
              .join(", "),
          },
          meta: body.meta ?? undefined,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        contactId?: string;
        error?: string;
      };

      if (response.ok && data.success) {
        crmContactId = data.contactId ?? null;
        if (crmContactId) {
          await updateLead(lead.id, partner.id, { crmContactId });
        }
      } else {
        console.error(
          `${LOG} CRM push failed for lead ${lead.id} (${partner.slug}):`,
          data.error || response.status
        );
      }
    } catch (crmError) {
      console.error(`${LOG} CRM push threw for lead ${lead.id} (${partner.slug}):`, crmError);
    }

    console.log(
      `${LOG} ${partner.slug} → ${firstName} ${lastName} (${locale})`,
      crmContactId ? `crm:${crmContactId}` : "crm:FAILED — recover from /admin/referral-partners"
    );

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error) {
    console.error(`${LOG} Unhandled error:`, error);
    return NextResponse.json(
      { success: false, error: "Failed to submit" },
      { status: 500 }
    );
  }
}
