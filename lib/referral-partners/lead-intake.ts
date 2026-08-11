import "server-only";
import { createLead, updateLead } from "./server";
import type {
  ReferralLeadRecord,
  ReferralLeadStatus,
  ReferralPartnerRecord,
} from "./types";

/**
 * The one path a partner referral takes into our systems, whichever door it came through.
 *
 * Two doors exist: the prospect submits the partner's landing page, or a partner texts us a name
 * and a number and we type it in from /admin/referral-partners. Both have to end up identical —
 * same table, same CRM tags, same attribution — or a manually-entered referral would be invisible
 * to the workflows and smart lists that pay the partner. That is why this is shared code rather
 * than two similar-looking route handlers.
 *
 * Order matters: our own row is written FIRST and the CRM push is best-effort. A referral we
 * failed to push is recoverable from the admin tool; a referral we never recorded is gone, and
 * with it the partner's commission.
 */

const LOG = "[referral-intake]";

export type ReferralIntakeOrigin = "form" | "manual";

export type ReferralIntakeInput = {
  partner: ReferralPartnerRecord;
  firstName: string;
  lastName: string;
  /** Optional: a partner texting a referral over often sends only a name and a phone. */
  email?: string;
  phone: string;
  locale: "en" | "es";
  smsConsent?: boolean;
  marketingConsent?: boolean;
  origin: ReferralIntakeOrigin;
  /** Manual entries can start further along — we may have already spoken to them. */
  status?: ReferralLeadStatus;
  notes?: string;
  /** Meta dedup payload; only the public form has one. */
  meta?: { eventId?: string; eventSourceUrl?: string; fbp?: string; fbc?: string };
};

export type ReferralIntakeResult = {
  lead: ReferralLeadRecord;
  crmContactId: string | null;
  /** Non-null when the CRM push failed — the lead still exists and is recoverable. */
  crmError: string | null;
};

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

/** E.164 for the US. Accepts the digits a partner would text over in any shape. */
export function normalizePhoneToE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
}

export function hasUsablePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export async function intakeReferralLead(
  input: ReferralIntakeInput
): Promise<ReferralIntakeResult> {
  const { partner, origin } = input;
  const slugKey = partner.slug.replace(/-/g, "_");

  const lead = await createLead({
    partnerId: partner.id,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    locale: input.locale,
  });

  // Status/notes are a second write rather than part of the insert, so the create path stays
  // identical for both origins. Skipped entirely unless there is something to change — a form
  // submission (and a manual entry left on the default) never pays for it.
  const needsStatus = Boolean(input.status) && input.status !== "new";
  const needsNotes = Boolean(input.notes?.trim());
  if (needsStatus || needsNotes) {
    await updateLead(lead.id, partner.id, {
      ...(needsStatus ? { status: input.status } : {}),
      ...(needsNotes ? { notes: input.notes } : {}),
    });
  }

  let crmContactId: string | null = null;
  let crmError: string | null = null;

  try {
    const response = await fetch(`${resolveBaseUrl()}/api/create-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: input.firstName,
        lastName: input.lastName,
        // Omitted entirely rather than sent empty — create-contact treats email as optional.
        ...(input.email ? { email: input.email } : {}),
        phone: input.phone,
        healthAlternativeData: {
          language: input.locale,
          // Same tags either way; the source string is what tells the two apart in the CRM note.
          source:
            origin === "manual"
              ? `partner_referral_${slugKey}_manual`
              : `partner_referral_${slugKey}`,
          smsConsent: input.smsConsent === true,
          marketingConsent: input.marketingConsent === true,
          referralPartnerSlug: partner.slug,
          referralPartnerName: partner.companyName,
          referralPartnerContact: [partner.contactName, partner.contactTitle]
            .filter(Boolean)
            .join(", "),
        },
        ...(input.meta ? { meta: input.meta } : {}),
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
      crmError = data.error || `CRM responded ${response.status}`;
      console.error(`${LOG} CRM push failed for lead ${lead.id} (${partner.slug}):`, crmError);
    }
  } catch (error) {
    crmError = error instanceof Error ? error.message : "CRM request failed";
    console.error(`${LOG} CRM push threw for lead ${lead.id} (${partner.slug}):`, error);
  }

  console.log(
    `${LOG} ${origin} · ${partner.slug} → ${input.firstName} ${input.lastName} (${input.locale})`,
    crmContactId ? `crm:${crmContactId}` : "crm:FAILED — recover from /admin/referral-partners"
  );

  return { lead, crmContactId, crmError };
}
