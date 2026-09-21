import { NextRequest, NextResponse } from "next/server";

import {
  AGENT_CRM_API_BASE,
  extractCrmEmail,
  phonesMatch,
  unwrapContactRecord,
} from "@/lib/agent-crm-contact-append";
import { sendLegalShieldGuideEmail } from "@/lib/email/legal-shield-guide";
import { LEGAL_SHIELD_GUIDE_PDF_URL } from "@/lib/legal-shield/constants";

const LOG = "[legal-shield/guide-email]";

/**
 * Emails the free report to a lead who just completed step 1.
 *
 * **This route authenticates.** Without the contact lookup below it would be an open relay: anyone
 * could POST an arbitrary address and have mail sent from the agency's own domain, which is how a
 * sending reputation dies. The rule is the one `/api/legal-shield/append` uses — the submitted
 * email or phone must match the contact that `contactId` names.
 *
 * Called fire-and-forget by the client after step 1 returns, never awaited on the submit path:
 * no lead route on this site declares `maxDuration`, so the budget is Vercel's 10s default and an
 * SMTP handshake has no business inside it.
 *
 * Returns 200 and does nothing when the guide URL or SMTP credentials are unset, or when
 * `LEGAL_SHIELD_GUIDE_EMAIL_VIA_CRM=1` — the switch for handing delivery to a GHL workflow later.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.LEGAL_SHIELD_GUIDE_EMAIL_VIA_CRM === "1") {
      return NextResponse.json({ success: true, sent: false, reason: "handled_by_crm" });
    }
    if (!LEGAL_SHIELD_GUIDE_PDF_URL) {
      return NextResponse.json({ success: true, sent: false, reason: "no_guide_url" });
    }
    if (!process.env.EMAIL_USER_INFO) {
      return NextResponse.json({ success: true, sent: false, reason: "no_smtp" });
    }

    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;
    if (!piToken || !locationId) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { contactId, email, phone, firstName } = body as {
      contactId?: string;
      email?: string;
      phone?: string;
      firstName?: string;
    };

    const emailTrimmed = (email ?? "").trim().toLowerCase();
    if (!contactId || !phone?.trim() || !emailTrimmed) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          required: ["contactId", "phone", "email"],
        },
        { status: 400 }
      );
    }

    const q = new URLSearchParams({ locationId });
    const res = await fetch(
      `${AGENT_CRM_API_BASE}/contacts/${encodeURIComponent(contactId)}?${q}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${piToken}`,
          Version: "2021-07-28",
        },
      }
    );
    if (!res.ok) {
      console.error(`${LOG} GET contact failed:`, res.status);
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const contact = unwrapContactRecord(await res.json());
    if (!contact || (contact.id != null && String(contact.id) !== String(contactId))) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const crmEmail = extractCrmEmail(contact);
    const crmPhone = typeof contact.phone === "string" ? contact.phone : "";
    const emailOk = Boolean(crmEmail) && crmEmail === emailTrimmed;
    const phoneOk = Boolean(crmPhone) && phonesMatch(phone, crmPhone);

    if (!emailOk && !phoneOk) {
      console.warn(`${LOG} Auth mismatch — refusing to send:`, {
        contactId,
        crmEmailPresent: Boolean(crmEmail),
        crmPhonePresent: Boolean(crmPhone),
      });
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 }
      );
    }

    const sent = await sendLegalShieldGuideEmail({
      to: emailTrimmed,
      firstName: (firstName ?? "").trim(),
      pdfUrl: LEGAL_SHIELD_GUIDE_PDF_URL,
    });

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    console.error(LOG, e);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
