import { NextResponse, type NextRequest } from "next/server";
import { adminAgentViewOf, requireAdminCaller, setAgentStatus } from "@/lib/tenancy/agent-admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/agents/[id]/status — `{ status: "active" | "paused" }`: Isaac's switch, the only
 * way an agent's status changes (linking a sign-in never does). Admin only.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const denied = await requireAdminCaller();
  if (denied) return denied;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null;
  try {
    const result = await setAgentStatus(id, body?.status);
    if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, agent: await adminAgentViewOf(result.value) });
  } catch (error) {
    console.error("[admin/agents/:id/status] POST", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Failed to change the status" }, { status: 500 });
  }
}
