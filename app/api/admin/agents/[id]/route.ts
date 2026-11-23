import { NextResponse, type NextRequest } from "next/server";
import { adminAgentViewOf, requireAdminCaller, updateAgentAsAdmin } from "@/lib/tenancy/agent-admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/agents/[id] — Isaac edits an agent: the profile fields (the agent's own form's
 * rules), the test flag, the address (slug rules + unique), and the login email while no sign-in is
 * linked. Admin only.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const denied = await requireAdminCaller();
  if (denied) return denied;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Send the fields to change." }, { status: 400 });
  }
  try {
    const result = await updateAgentAsAdmin(id, body as Record<string, unknown>);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, fields: result.fields }, { status: result.status });
    }
    return NextResponse.json({ success: true, agent: await adminAgentViewOf(result.value) });
  } catch (error) {
    console.error("[admin/agents/:id] PATCH", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to save the agent" }, { status: 500 });
  }
}
