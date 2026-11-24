import { NextRequest, NextResponse } from "next/server";
import { interceptGuardPseudoId } from "@/lib/lead-guard/server";

import {
  AGENT_CRM_API_BASE,
  extractCrmEmail,
  phonesMatch,
  unwrapContactRecord,
} from "@/lib/agent-crm-contact-append";
import { sendIulGuiaEmail } from "@/lib/email/iul-guia";
import { IUL_GUIA_PDF_URL } from "@/lib/iul-guia/constants";

const LOG = "[iul/guia-email]";

/**
 * Emails the free IUL guide to a lead who just completed step 1.
 *
 * **This route authenticates.** Without the contact lookup below it would be an open relay: anyone
 * could POST an arbitrary address and have mail sent from the agency's own domain, which is how a
 * sending reputation dies. The rule is the one `/api/legal-shield/guide-email` uses — the
 * submitted email or phone must match the contact that `contactId` names.
 *
 * Called fire-and-forget by the client after step 1 returns, never awaited on the submit path:
 * no lead route on this site declares `maxDuration`, so the budget is Vercel's 10s default and an
 * SMTP handshake has no business inside it.
 *
 * Returns 200 and does nothing when the guide URL or SMTP credentials are unset, or when
 * `IUL_GUIA_EMAIL_VIA_CRM=1` — the switch for handing delivery to a GHL workflow later.
 */
export async function POST(request: NextRequest) {
  try {
    if (process.env.IUL_GUIA_EMAIL_VIA_CRM === "1") {
      return NextResponse.json({ success: true, sent: false, reason: "handled_by_crm" });
    }
    if (!IUL_GUIA_PDF_URL) {
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

    // Lead Guard: a stand-in contact id of a held or blocked lead. Still held: the step-2 data is
    // filed with the hold (replayed on release); already released: continue with the real contact.
    const guardIntercept = await interceptGuardPseudoId(body?.contactId, "/api/iul/guia-email", body);
    if (guardIntercept?.action === "respond") {
      return NextResponse.json({ success: true, sent: false });
    }
    if (guardIntercept?.action === "continue") body.contactId = guardIntercept.contactId;
    const { contactId, email, phone } = body as {
      contactId?: string;
      email?: string;
      phone?: string;
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
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    const contact = unwrapContactRecord(await res.json());
    if (!contact || (contact.id != null && String(contact.id) !== String(contactId))) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    // Never an arbitrary inbox (Lead Guard): a phone match alone used to email the guide to
    // whatever address was typed — exactly what form-bombing bots look for. The guide goes to the
    // address on file: the typed one when they match (a new lead's step 1 saved it), else the
    // contact's own email (a returning lead whose different email went to a note). No email on
    // file → nothing is sent. The greeting uses the CRM's first name, never text from the request.
    const to = emailOk ? emailTrimmed : phoneOk && crmEmail ? crmEmail : null;
    if (!to) {
      console.warn(`${LOG} No email on file for this contact — not sending`, { contactId });
      return NextResponse.json({ success: true, sent: false, reason: "email_not_on_file" });
    }
    const crmFirstName = typeof contact.firstName === "string" ? contact.firstName.trim() : "";
    const sent = await sendIulGuiaEmail({
      to,
      firstName: crmFirstName,
      pdfUrl: IUL_GUIA_PDF_URL,
    });

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    console.error(LOG, e);
    return NextResponse.json({ success: false, error: "Unexpected error" }, { status: 500 });
  }
}
