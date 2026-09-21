import { NextRequest, NextResponse } from "next/server";

import {
  AGENT_CRM_API_BASE,
  extractCrmEmail,
  getCustomFieldStringValue,
  mergeCustomFieldsWithUpdates,
  phonesMatch,
  resolveLeadSourceDetailsCustomField,
  unwrapContactRecord,
} from "@/lib/agent-crm-contact-append";
import { agentCrmAddContactTags } from "@/lib/agent-crm-contacts";
import {
  AREA_LABELS_ES,
  AREA_TAGS,
  LS_TAG_QUESTIONNAIRE_COMPLETE,
  LS_TAG_URGENCY_NOW,
  LS_TAG_URGENCY_PREVENTION,
  URGENCY_LABELS_ES,
  isAreaSlug,
  isUrgencySlug,
} from "@/lib/legal-shield/constants";

const LOG = "[legal-shield/append]";

/** Marks the block this route owns inside the shared lead_source_details field. */
const BLOCK_HEADING = "Cuestionario LegalShield";

/**
 * Save the two LegalShield questionnaire answers onto the contact created in step 1.
 *
 * These answers are not analytics — the call script reads them out loud: *"veo aquí en tu formulario
 * que te interesa específicamente el tema de ___. Además, me indicaste que ___."*
 *
 * **No new custom fields.** Isaac did not want any provisioned for this line, so the answers land
 * in two places that already exist:
 *
 *  - **Tags** carry the structured half (`ls_area_*`, `ls_urgencia_*`), which is what GHL smart
 *    lists and workflow filters can match on. Applied through `POST /contacts/{id}/tags`, which is
 *    additive — it cannot clobber the tags written at creation — and fires GHL's "tag added"
 *    triggers, the mechanism the LegalShield workflow runs on.
 *  - **`lead_source_details`** carries the readable half. It is the shared field every lead type
 *    on this site already writes to, so `{{contact.lead_source_details}}` renders in the advisor's
 *    notification with a sentence he can read rather than a list of slugs.
 *
 * Two modes, same endpoint (the shape `contact-append-iul` established):
 *  - Partial (default): fired after each screen, keepalive, unawaited. Captures the answers of
 *    someone who closes the tab on screen 3.
 *  - Final (`final: true`): the same write plus the completion tag.
 *
 * The readable block is REPLACED rather than appended on every save. A partial and then a final
 * save would otherwise stack two near-identical blocks on the record, and the advisor would be
 * reading a contradictory older copy half the time.
 *
 * Fires no Pixel/CAPI events — the Lead was counted in step 1.
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
    const { contactId, email, phone, areas, urgency, final } = body as {
      contactId?: string;
      email?: string;
      phone?: string;
      areas?: unknown;
      urgency?: unknown;
      final?: boolean;
    };

    // Phone is the credential. A bare `contactId` must never be enough — GHL ids leak through
    // webhooks, exports and the CRM UI, and this endpoint writes to a contact record.
    if (!contactId || !phone?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
          required: ["contactId", "phone"],
        },
        { status: 400 }
      );
    }

    const baseUrl = AGENT_CRM_API_BASE;
    const q = new URLSearchParams({ locationId });
    const contactUrl = `${baseUrl}/contacts/${encodeURIComponent(contactId)}?${q}`;
    const getHeaders = {
      Accept: "application/json",
      Authorization: `Bearer ${piToken}`,
      Version: "2021-07-28",
    };

    const res = await fetch(contactUrl, { method: "GET", headers: getHeaders });
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

    const requestedEmail = (email ?? "").trim().toLowerCase();
    const crmEmail = extractCrmEmail(contact);
    const crmPhone = typeof contact.phone === "string" ? contact.phone : "";
    const emailOk = Boolean(crmEmail) && crmEmail === requestedEmail;
    const phoneOk = Boolean(crmPhone) && phonesMatch(phone, crmPhone);

    if (!emailOk && !phoneOk) {
      // Logged in full because the client call is fire-and-forget: a silent 403 is the one way
      // these answers can vanish with nothing surfacing in the UI.
      console.warn(`${LOG} Auth mismatch:`, {
        contactId,
        crmEmailPresent: Boolean(crmEmail),
        crmPhonePresent: Boolean(crmPhone),
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

    const areaSlugs = Array.isArray(areas) ? areas.filter(isAreaSlug) : [];
    const urgencySlug = isUrgencySlug(urgency) ? urgency : null;

    // ── Tags: the structured half ────────────────────────────────────────────
    const tags: string[] = areaSlugs.map((slug) => AREA_TAGS[slug]);
    if (urgencySlug) {
      tags.push(
        urgencySlug === "ahora_mismo" ? LS_TAG_URGENCY_NOW : LS_TAG_URGENCY_PREVENTION
      );
    }
    if (final === true) tags.push(LS_TAG_QUESTIONNAIRE_COMPLETE);
    if (tags.length > 0) {
      await agentCrmAddContactTags(contactId, tags, piToken, LOG);
    }

    // ── lead_source_details: the readable half ───────────────────────────────
    if (areaSlugs.length === 0 && !urgencySlug) {
      return NextResponse.json({ success: true, updated: tags.length > 0 });
    }

    const leadSourceDetailsField = await resolveLeadSourceDetailsCustomField(
      baseUrl,
      locationId,
      piToken
    );
    if (!leadSourceDetailsField?.id) {
      // The tags already landed, so the lead is still segmentable — just not readable.
      console.warn(`${LOG} lead_source_details not resolvable; tags applied, text skipped.`);
      return NextResponse.json({ success: true, updated: tags.length > 0, textSkipped: true });
    }

    const existing = getCustomFieldStringValue(
      contact.customFields,
      leadSourceDetailsField.id
    );
    const submittedAt =
      new Date().toLocaleString() +
      " " +
      (Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    const areaLines = areaSlugs.length
      ? areaSlugs.map((slug) => `  - ${AREA_LABELS_ES[slug]}`)
      : ["  (no respondio)"];
    const block = [
      BLOCK_HEADING,
      "========================",
      "",
      "Areas en las que quiere respaldo legal:",
      ...areaLines,
      "",
      `Situacion actual: ${urgencySlug ? URGENCY_LABELS_ES[urgencySlug] : "(no respondio)"}`,
      "",
      final === true
        ? `Cuestionario completo: ${submittedAt}`
        : `Respuesta parcial: ${submittedAt}`,
    ].join("\n");

    const putRes = await fetch(contactUrl, {
      method: "PUT",
      headers: { ...getHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        customFields: mergeCustomFieldsWithUpdates(contact.customFields, [
          {
            id: leadSourceDetailsField.id,
            key: leadSourceDetailsField.key,
            field_value: replaceBlock(existing, block),
          },
        ]),
      }),
    });

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      console.error(`${LOG} CRM PUT failed:`, putRes.status, errText);
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
    console.error(LOG, e);
    return NextResponse.json(
      { success: false, error: "Unexpected error" },
      { status: 500 }
    );
  }
}

/**
 * Swap our block into the shared field, dropping any earlier copy of it.
 *
 * Everything written at contact creation sits above and is left alone — this only takes ownership
 * of the text from our own heading onwards, which is the last thing in the field because we are
 * the only writer after creation.
 */
function replaceBlock(existing: string, block: string): string {
  if (!existing) return block;
  const marker = existing.indexOf(BLOCK_HEADING);
  if (marker === -1) return `${existing}\n\n${block}`;
  return `${existing.slice(0, marker).trimEnd()}\n\n${block}`;
}
