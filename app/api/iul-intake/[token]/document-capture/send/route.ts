import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  getIntakeByToken,
  syncDocumentCaptureLinkToCrm,
  IUL_DOCUMENT_CAPTURE_SENT_TAG,
} from "@/lib/iul-intake/server";
import { getPendingDocumentCapture } from "@/lib/iul-intake/document-capture";
import {
  agentCrmGetBaseCredentials,
  agentCrmAddContactTags,
  agentCrmRemoveContactTags,
} from "@/lib/agent-crm-contacts";

/**
 * POST — hand the live document link to the CRM so a GHL workflow texts or emails it.
 *
 * Same two-step shape as the secure-capture send route, because there is no direct SMS API in this
 * codebase: write the URL to a custom field, then toggle a tag whose "tag added" trigger fires the
 * workflow. Removing before adding is what makes a second send re-fire it.
 *
 * Its own field and its own tag, not the secure-capture ones. Both links can be live at the same
 * moment — the client is typing their SSN on one and photographing a green card on the other — and
 * a workflow that texts "the link" would otherwise have no way to know which it meant.
 *
 * Isaac has to build that workflow in GHL once, keyed on `iul_document_capture_sent`. Until then
 * the copy-link button is the working path, which is why this route failing is not fatal.
 */

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await getIsAdmin())) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (row.ownerUserId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (!row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "This session has no linked CRM contact." },
        { status: 400 }
      );
    }

    const capture = await getPendingDocumentCapture(row.id);
    if (!capture) {
      return NextResponse.json(
        { success: false, error: "There is no active document link to send." },
        { status: 400 }
      );
    }

    const creds = agentCrmGetBaseCredentials();
    if (!creds) {
      return NextResponse.json({ success: false, error: "CRM is not configured." }, { status: 400 });
    }

    const synced = await syncDocumentCaptureLinkToCrm(row, capture.token);
    if (!synced) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Could not write the link to the CRM. Run `pnpm iul:fields` to create the document capture field, then retry.",
        },
        { status: 502 }
      );
    }

    // Remove then re-add so the "tag added" workflow fires on every send, not just the first.
    await agentCrmRemoveContactTags(
      row.crmContactId,
      [IUL_DOCUMENT_CAPTURE_SENT_TAG],
      creds.token,
      "[IUL_INTAKE]"
    );
    const tagged = await agentCrmAddContactTags(
      row.crmContactId,
      [IUL_DOCUMENT_CAPTURE_SENT_TAG],
      creds.token,
      "[IUL_INTAKE]"
    );
    if (!tagged) {
      return NextResponse.json(
        { success: false, error: "Could not tag the contact." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[iul-intake/:token/document-capture/send] POST", error);
    return NextResponse.json({ success: false, error: "Failed to send link" }, { status: 500 });
  }
}
