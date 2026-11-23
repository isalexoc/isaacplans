import { NextResponse, after, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { clerkCrmSyncConfigured, syncClerkUserToAgentCrm } from "@/lib/clerk-agent-crm-sync";
import { clerkCrmSyncDecisionFor } from "@/lib/tenancy/agent-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Clerk → Agent CRM (LeadConnector).
 *
 * Dashboard: Clerk → Webhooks → Add endpoint
 * URL: https://www.isaacplans.com/api/webhooks/clerk  (or your preview URL)
 * Subscribe to: user.created, user.updated
 * Signing secret → set CLERK_WEBHOOK_SIGNING_SECRET in Vercel env (same value Clerk shows).
 *
 * Optional env:
 * - AGENT_CRM_SYNC_CLERK=false — disable CRM updates from this webhook
 * - AGENT_CRM_CLERK_TAG — default tag `clerk_user` for smart lists
 *
 * Agents of the agent platform never go into Isaac's CRM: an account carrying the agent marker
 * (`publicMetadata.agentId`, set by the invitation or the link), or with an `agents` row by its id
 * or email, is skipped (lib/tenancy/agent-accounts.ts). That is decided before the webhook answers:
 * when the check itself fails, the answer is a 503 and Clerk's sender retries the event later, so
 * an ordinary visitor is still synced once the database answers. With the sync off on this
 * deployment (AGENT_CRM_SYNC_CLERK=false, or no CRM env) there is no check at all.
 */

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const data = evt.data as unknown as Record<string, unknown>;
      // Without a CRM to sync to, the upsert below is the same no-op it always was: no lookup.
      const decision = clerkCrmSyncConfigured() ? await clerkCrmSyncDecisionFor(data) : "sync";
      if (decision === "retry") {
        return NextResponse.json({ error: "Temporarily unavailable, retry" }, { status: 503 });
      }
      if (decision === "sync") after(() => syncClerkUserToAgentCrm(data));
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhooks/clerk] Verification or handler error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "clerk-webhook" });
}
