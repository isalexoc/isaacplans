import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  agentCrmAddContactTags,
  agentCrmGetBaseCredentials,
  agentCrmRemoveContactTags,
  agentCrmUpdateContact,
} from "@/lib/agent-crm-contacts";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { getIntakeByToken } from "@/lib/intake-core/server";
import { buildSecureCaptureUrl } from "@/lib/intake-core/share-url";
import { getPendingCapture, secureCaptureSentTag } from "@/lib/intake-core/secure-capture";
import { ghlFieldIds } from "@/lib/iul-intake/ghl-field-ids";
import { resolveCrmContactLocale } from "@/lib/iul-intake/server";

/**
 * POST — hand the live secure link to the CRM so a GHL workflow texts it.
 *
 * The IUL route's two steps: write the URL to a contact field, then remove and re-add a tag whose
 * "tag added" trigger fires the workflow (removing first is what makes a second send re-fire it).
 *
 * The field is the IUL intake's `iul_secure_capture_link`, reused rather than a new one per line:
 * it only ever holds "this contact's latest secure link", and Isaac keeps new GHL custom fields to
 * a minimum. The tag is per line (`ha_secure_capture_sent`) so its workflow can word the text for
 * that product. Until the workflow exists, copying the link is the working path.
 */

type RouteContext = { params: Promise<{ lob: string; token: string }> };

const fail = (status: number, error: string) => NextResponse.json({ success: false, error }, { status });

export async function POST(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const { userId } = await auth();
    if (!userId) return fail(401, "Unauthorized");
    if (!(await getIsAdmin())) return fail(403, "Forbidden");
    const config = resolveConfig(lob);
    if (!config?.secureCapture) return fail(404, "Not found");
    // A line whose agent sends links from their own phone has no CRM workflow to text this.
    if (config.linkDelivery?.kind === "whatsapp") return fail(400, "This line sends links by WhatsApp.");
    const row = await getIntakeByToken(config, token);
    if (!row) return fail(404, "Not found");
    if (row.ownerUserId !== userId) return fail(403, "Forbidden");
    if (!row.crmContactId) return fail(400, "This intake has no linked CRM contact.");

    const capture = await getPendingCapture(row.id);
    if (!capture) return fail(400, "There is no active secure link to send.");

    const creds = agentCrmGetBaseCredentials();
    const fieldId = ghlFieldIds.iul_secure_capture_link;
    if (!creds || !fieldId) return fail(400, "CRM is not configured.");

    // The client's language from their CRM tag, so the text and the page match.
    const locale = await resolveCrmContactLocale(row.crmContactId, row.locale, creds.token);
    const written = await agentCrmUpdateContact(
      row.crmContactId,
      { customFields: [{ id: fieldId, field_value: buildSecureCaptureUrl(capture.token, locale, undefined, config.secureSlug) }] },
      creds.token,
      "[INTAKE_SECURE_CAPTURE]"
    );
    if (!written) return fail(502, "Could not write the link to the CRM.");

    const tag = secureCaptureSentTag(config);
    await agentCrmRemoveContactTags(row.crmContactId, [tag], creds.token, "[INTAKE_SECURE_CAPTURE]");
    const tagged = await agentCrmAddContactTags(row.crmContactId, [tag], creds.token, "[INTAKE_SECURE_CAPTURE]");
    if (!tagged) return fail(502, "Could not tag the contact.");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[intake/${lob}/:token/secure-capture/send] POST`, error);
    return fail(500, "Failed to send link");
  }
}
