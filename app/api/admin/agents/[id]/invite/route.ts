import { NextResponse, type NextRequest } from "next/server";
import { inviteOrLinkAgent } from "@/lib/tenancy/agent-accounts";
import { adminAgentViewOf, requireAdminCaller } from "@/lib/tenancy/agent-admin";
import { agentAreaLocale } from "@/lib/tenancy/agent-area-routes";
import { getAgentById } from "@/lib/tenancy/agents";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/agents/[id]/invite — `{ locale? }`. No Clerk account has the agent's email: a
 * Clerk invitation (with `publicMetadata.agentId`, landing on the agent area in that language).
 * One account has it, verified: linked now. Refused for an admin account, one of Isaac's own ids,
 * an unverified email, or an account that belongs to another agent (lib/tenancy/agent-linking.ts).
 * Admin only.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const denied = await requireAdminCaller();
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  try {
    const agent = await getAgentById(id);
    if (!agent) return NextResponse.json({ success: false, error: "No such agent." }, { status: 404 });
    const locale = agentAreaLocale(typeof body?.locale === "string" ? body.locale : agent.defaultLocale);
    const outcome = await inviteOrLinkAgent(agent, locale);
    switch (outcome.kind) {
      case "invited":
        return NextResponse.json({ success: true, result: "invited", agent: await adminAgentViewOf(agent) });
      case "linked":
        return NextResponse.json({
          success: true,
          result: "linked",
          // Linked either way; the marker is added on the agent's next visit (lib/tenancy/context.ts),
          // and until then the webhook still skips the account by its agent row.
          warning: outcome.marked ? undefined : "Linked. Clerk didn't take the agent marker yet: it's added on the agent's next visit.",
          agent: await adminAgentViewOf(outcome.agent),
        });
      case "refused":
        return NextResponse.json({ success: false, error: outcome.message, code: outcome.reason }, { status: 409 });
      default:
        return NextResponse.json({ success: false, error: outcome.message }, { status: 502 });
    }
  } catch (error) {
    console.error("[admin/agents/:id/invite] POST", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to invite the agent" }, { status: 500 });
  }
}
