import { NextRequest, NextResponse } from "next/server";

import {
  AGENT_CRM_API_BASE,
  extractCrmEmail,
  getCustomFieldStringValue,
  mergeCustomFieldsWithUpdates,
  phonesMatch,
  resolveLeadSourceDetailsCustomField,
  unwrapContactRecord,
  type CrmCustomFieldRow,
} from "@/lib/agent-crm-contact-append";
import { getIulStep2FieldId } from "@/lib/iul-step2-ads/ghl-field-ids";
import { ianaTimezoneFromUsPostalCode } from "@/lib/iana-timezone-from-us-postal";

/**
 * Save IUL Step-2 answers (the /iul/get-covered ad funnel quiz) onto an existing CRM
 * contact created in Step 1. Verifies `email`/`phone` match the contact before updating.
 * Fires NO Meta/Pixel/CAPI events — the Lead was already counted in Step 1.
 *
 * Two modes (same endpoint):
 *  - Partial (default): called fire-and-forget after each question / on back-edit. Overwrites
 *    only the dedicated Step-2 custom fields for the answers present (+ native state/timezone
 *    when state is present). Captures partial completions.
 *  - Final (`final: true`): also appends the human-readable "IUL Step 2" block to
 *    `lead_source_details` (the completion snapshot).
 */
export async function POST(request: NextRequest) {
  try {
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;

    if (!piToken || !locationId) {
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      contactId,
      email,
      phone,
      retirementTimeline,
      investments,
      monthlySavings,
      age,
      state,
      final,
    } = body as {
      contactId?: string;
      email?: string;
      phone?: string;
      retirementTimeline?: string;
      investments?: string[];
      monthlySavings?: string;
      age?: string | number;
      state?: string;
      final?: boolean;
    };

    if (!contactId || !email?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          required: ["contactId", "email"],
        },
        { status: 400 }
      );
    }

    const baseUrl = AGENT_CRM_API_BASE;
    const q = new URLSearchParams({ locationId });

    const getRes = await fetch(
      `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${piToken}`,
          Version: "2021-07-28",
        },
      }
    );

    if (!getRes.ok) {
      const errTxt = await getRes.text();
      console.error("[contact-append-iul] GET contact failed:", getRes.status, errTxt);
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const raw = await getRes.json();
    const contact = unwrapContactRecord(raw);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }
    if (contact.id != null && String(contact.id) !== String(contactId)) {
      console.error("[contact-append-iul] Contact id mismatch:", {
        requested: contactId,
        got: contact.id,
      });
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    const requestedEmail = email.toLowerCase().trim();
    const crmEmail = extractCrmEmail(contact);
    const crmPhone = typeof contact.phone === "string" ? contact.phone : "";
    const emailOk = Boolean(crmEmail) && crmEmail === requestedEmail;
    const phoneOk =
      Boolean(phone?.trim()) && Boolean(crmPhone) && phonesMatch(phone!, crmPhone);

    if (!emailOk && !phoneOk) {
      console.warn("[contact-append-iul] Auth mismatch:", {
        requestedEmail,
        crmEmailPresent: Boolean(crmEmail),
        phoneOkAttempted: Boolean(phone?.trim()),
      });
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          hint: "Email or phone did not match this contact.",
        },
        { status: 403 }
      );
    }

    const stateNormalized =
      typeof state === "string" && state.trim().length === 2
        ? state.trim().toUpperCase()
        : (state || "").trim();

    const ageStr = age !== undefined && age !== null ? `${age}`.trim() : "";
    const investmentsList = Array.isArray(investments)
      ? investments.filter((i) => typeof i === "string" && i.trim())
      : [];
    const formatInvestments = (inv: string[]): string =>
      inv.length > 0 ? inv.join(", ") : "";

    // Native fields: state + derived timezone (state fallback yields e.g. CA → America/Los_Angeles).
    const updatePayload: Record<string, unknown> = {};
    if (stateNormalized) {
      updatePayload.state = stateNormalized;
      const tz = ianaTimezoneFromUsPostalCode("", stateNormalized);
      if (tz) updatePayload.timezone = tz;
    }

    // Dedicated Step-2 custom fields — overwrite each present answer (the partial-capture model).
    const customFieldUpdates: CrmCustomFieldRow[] = [];
    const pushField = (slug: Parameters<typeof getIulStep2FieldId>[0], value: string) => {
      if (!value) return;
      const id = getIulStep2FieldId(slug);
      if (!id) {
        console.warn(
          `[contact-append-iul] Step-2 field "${slug}" not provisioned — run scripts/create-iul-step2-fields.ts`
        );
        return;
      }
      customFieldUpdates.push({ id, field_value: value });
    };
    pushField("iul_s2_age", ageStr);
    pushField("iul_s2_retirement_timeline", (retirementTimeline || "").trim());
    pushField("iul_s2_monthly_savings", (monthlySavings || "").trim());
    pushField("iul_s2_investments", formatInvestments(investmentsList));

    // Final submission: append the readable "IUL Step 2" snapshot to lead_source_details.
    if (final === true) {
      const leadSourceDetailsField = await resolveLeadSourceDetailsCustomField(
        baseUrl,
        locationId,
        piToken
      );
      if (leadSourceDetailsField?.id) {
        const existingLeadDetails = getCustomFieldStringValue(
          contact.customFields,
          leadSourceDetailsField.id
        );
        const submittedAt =
          new Date().toLocaleString() +
          " " +
          (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
        const step2Details = [
          "IUL Step 2 (qualifying questions)",
          "=================================",
          "",
          `  Age: ${ageStr || "Not provided"}`,
          `  State: ${stateNormalized || "Not provided"}`,
          `  Monthly savings: ${monthlySavings || "Not provided"}`,
          `  Retirement timeline: ${retirementTimeline || "Not provided"}`,
          `  Current investments: ${formatInvestments(investmentsList) || "Not provided"}`,
          "",
          `Step 2 submitted: ${submittedAt}`,
        ].join("\n");

        const nextLeadDetails = existingLeadDetails
          ? `${existingLeadDetails}\n\n${step2Details}`
          : step2Details;

        customFieldUpdates.push({
          id: leadSourceDetailsField.id,
          key: leadSourceDetailsField.key,
          field_value: nextLeadDetails,
        });
      }
    }

    if (customFieldUpdates.length > 0) {
      updatePayload.customFields = mergeCustomFieldsWithUpdates(
        contact.customFields,
        customFieldUpdates
      );
    }

    if (Object.keys(updatePayload).length === 0) {
      // Nothing to write (no provisioned fields, no state, not final) — treat as success.
      return NextResponse.json({ success: true, updated: false });
    }

    const putUrl = `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${piToken}`,
        Version: "2021-07-28",
      },
      body: JSON.stringify(updatePayload),
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.error("[contact-append-iul] CRM PUT failed:", putRes.status, errText);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to save your answers",
          details:
            process.env.NODE_ENV === "development" ? errText.slice(0, 500) : undefined,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (e) {
    console.error("[contact-append-iul]", e);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}
