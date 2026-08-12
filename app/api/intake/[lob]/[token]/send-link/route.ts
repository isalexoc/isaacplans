import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { forbidden, notFound, resolveConfig, unauthorized } from "@/lib/intake-core/route-helpers";
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
    const { userId } = await auth();
    if (!userId) return unauthorized();
    if (!(await getIsAdmin())) return forbidden();

    const config = resolveConfig(lob);
    if (!config) return notFound();

    const row = await getIntakeByToken(config, token);
    if (!row) return notFound();
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
