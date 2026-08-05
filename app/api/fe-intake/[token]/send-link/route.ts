import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import {
  getFeIntakeByToken,
  syncFeIntakeLinkToCrm,
  toFeIntakeSummary,
  FE_INTAKE_LINK_SENT_TAG,
} from "@/lib/fe-intake/server";
import {
  agentCrmGetBaseCredentials,
  agentCrmAddContactTags,
  agentCrmRemoveContactTags,
} from "@/lib/agent-crm-contacts";

type RouteContext = { params: Promise<{ token: string }> };

// POST /api/fe-intake/[token]/send-link — admin only: refresh the CRM link field + add the
// trigger tag so a GHL workflow sends the client their link.
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
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (!row.crmContactId) {
      return NextResponse.json(
        { success: false, error: "This session has no linked CRM contact." },
        { status: 400 }
      );
    }
    const creds = agentCrmGetBaseCredentials();
    if (!creds) {
      return NextResponse.json({ success: false, error: "CRM is not configured." }, { status: 400 });
    }

    const linkSynced = await syncFeIntakeLinkToCrm(row);
    if (!linkSynced) {
      return NextResponse.json(
        { success: false, error: "Could not update the link in the CRM. Run pnpm fe-intake:fields and retry." },
        { status: 502 }
      );
    }

    // Remove then re-add the tag so the "tag added" workflow fires on every send.
    await agentCrmRemoveContactTags(row.crmContactId, [FE_INTAKE_LINK_SENT_TAG], creds.token, "[FE_INTAKE]");
    const tagged = await agentCrmAddContactTags(row.crmContactId, [FE_INTAKE_LINK_SENT_TAG], creds.token, "[FE_INTAKE]");
    if (!tagged) {
      return NextResponse.json({ success: false, error: "Could not tag the contact." }, { status: 502 });
    }

    return NextResponse.json({ success: true, session: toFeIntakeSummary(row) });
  } catch (error) {
    console.error("[fe-intake/:token/send-link] POST", error);
    return NextResponse.json({ success: false, error: "Failed to send link" }, { status: 500 });
  }
}
