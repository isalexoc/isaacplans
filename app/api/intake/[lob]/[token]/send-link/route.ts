import { NextRequest, NextResponse } from "next/server";
import { requireLineOperator } from "@/lib/auth/access";
import { forbidden, notFound, resolveConfig } from "@/lib/intake-core/route-helpers";
import {
  getIntakeByToken,
  intakeTags,
  syncIntakeLinkToCrm,
  toIntakeSummary,
} from "@/lib/intake-core/server";
import {
  agentCrmGetBaseCredentials,
  agentCrmAddContactTags,
  agentCrmRemoveContactTags,
} from "@/lib/agent-crm-contacts";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

// POST /api/intake/[lob]/[token]/send-link — admin only: refresh the CRM link field + add the
// trigger tag so a GHL workflow sends the client their link.
export async function POST(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    const gate = await requireLineOperator(lob);
    if ("error" in gate) return gate.error;
    const { access } = gate;

    const config = resolveConfig(lob);
    if (!config) return notFound();
    // A line whose agent sends links from their own phone has no CRM workflow to text this.
    if (config.linkDelivery?.kind === "whatsapp") {
      return NextResponse.json({ success: false, error: "This line sends links by WhatsApp." }, { status: 400 });
    }

    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
    // Only the owner sends a link (an admin, as before, may on any line).
    if (!access.isAdmin && row.ownerUserId !== access.userId) return forbidden();
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

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    const linkSentTag = intakeTags(config).linkSent;

    // 1) Guarantee the link field is current.
    const linkSynced = await syncIntakeLinkToCrm(config, row);
    if (!linkSynced) {
      return NextResponse.json(
        {
          success: false,
          error: `Could not update the link in the CRM. Run pnpm intake:fields ${config.lob} and retry.`,
        },
        { status: 502 }
      );
    }

    // 2) Remove then re-add the tag so the "tag added" workflow fires on every send.
    await agentCrmRemoveContactTags(row.crmContactId, [linkSentTag], creds.token, logTag);
    const tagged = await agentCrmAddContactTags(
      row.crmContactId,
      [linkSentTag],
      creds.token,
      logTag
    );
    if (!tagged) {
      return NextResponse.json({ success: false, error: "Could not tag the contact." }, { status: 502 });
    }

    return NextResponse.json({ success: true, session: toIntakeSummary(row) });
  } catch (error) {
    console.error(`[intake/${lob}/:token/send-link] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to send link" }, { status: 500 });
  }
}
