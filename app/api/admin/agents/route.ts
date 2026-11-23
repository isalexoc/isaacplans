import { NextResponse, type NextRequest } from "next/server";
import { adminAgentViewOf, createAgent, listAgentsForAdmin, requireAdminCaller } from "@/lib/tenancy/agent-admin";

/**
 * The agent platform's agents: list + create. Admin only (middleware gates /api/admin, re-checked
 * here). Agent metadata only, never an agent's clients: the list carries each agent's status,
 * test flag, address, whether a sign-in is linked, the agreements, and a COUNT of applications.
 */

export async function GET() {
  const denied = await requireAdminCaller();
  if (denied) return denied;
  try {
    return NextResponse.json({ success: true, agents: await listAgentsForAdmin() });
  } catch (error) {
    console.error("[admin/agents] GET", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to load agents" }, { status: 500 });
  }
}

/** Create: `{ email, slug, firstName, lastName, isTest, defaultLocale }`. A new agent is "invited". */
export async function POST(request: NextRequest) {
  const denied = await requireAdminCaller();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Send the agent's details." }, { status: 400 });
  }
  try {
    const result = await createAgent(body as Record<string, unknown>);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, fields: result.fields }, { status: result.status });
    }
    return NextResponse.json({ success: true, agent: await adminAgentViewOf(result.value) });
  } catch (error) {
    console.error("[admin/agents] POST", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to create the agent" }, { status: 500 });
  }
}
