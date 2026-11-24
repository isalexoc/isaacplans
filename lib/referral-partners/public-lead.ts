import "server-only";

import { capitalizeName, shortTermMedicalFormSchema } from "@/lib/validation/shortTermMedicalSchema";
import { getPartnerBySlug } from "@/lib/referral-partners/server";
import { intakeReferralLead, normalizePhoneToE164 } from "@/lib/referral-partners/lead-intake";
import type { CreateContactContext } from "@/lib/create-contact/core";

/**
 * A lead from a referral partner's public landing page (/partners/<slug>), after Lead Guard let it
 * through. Shared by /api/partners/lead and Lead Guard's Release, so a released partner lead also
 * creates the referral row (partner dashboard, commission) exactly like a live one.
 */

const LOG = "[partner-lead]";

export type PartnerLeadResult = { status: number; body: Record<string, unknown> };

export async function processPartnerLead(
  body: Record<string, any>,
  visitor: { ip?: string; ua?: string } | null,
  /** Set by Lead Guard's Release: the consent record keeps the original submit time. */
  released?: CreateContactContext["released"]
): Promise<PartnerLeadResult> {
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slug) return { status: 400, body: { success: false, error: "Missing partner" } };

  const partner = await getPartnerBySlug(slug);
  if (!partner || partner.status !== "active") {
    return { status: 404, body: { success: false, error: "Unknown partner" } };
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
    return { status: 400, body: { success: false, error: "Invalid submission", fields } };
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
    visitor: visitor ?? undefined,
    released: released ?? null,
  });

  // Success even when the CRM push failed: the prospect did nothing wrong, the lead is durably
  // ours, and it surfaces in /admin/referral-partners for recovery.
  console.log(`${LOG} lead stored`, { partner: partner.slug });
  return { status: 200, body: { success: true, leadId: lead.id } };
}
