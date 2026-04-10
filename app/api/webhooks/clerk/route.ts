import { NextResponse, after, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { syncClerkUserToAgentCrm } from "@/lib/clerk-agent-crm-sync";

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
 */

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req);

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const data = evt.data as unknown as Record<string, unknown>;
      after(() => syncClerkUserToAgentCrm(data));
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
