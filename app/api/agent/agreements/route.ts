import { NextResponse, type NextRequest } from "next/server";
import { requireAgentApiCaller } from "@/lib/tenancy/agent-area";
import { acceptanceMatchesCurrent, currentAgreementRefs } from "@/lib/tenancy/agreements";
import { recordAgreementAcceptance } from "@/lib/tenancy/agreements-store";

/**
 * POST /api/agent/agreements — the signed-in agent accepts the current Terms of Service and Data
 * Processing Agreement: `{ accepted: [{ doc, version, sha256 }, …] }`, exactly the current set
 * (lib/tenancy/agreements.ts). A page opened before a text changed gets 409 "changed" and reloads.
 *
 * A linked agent only, never an impersonated session (lib/tenancy/agent-area.ts); recorded with
 * the time, IP and browser, once per version.
 */
export async function POST(request: NextRequest) {
  const caller = await requireAgentApiCaller({ agreements: false });
  if (caller instanceof NextResponse) return caller;

  const body = (await request.json().catch(() => null)) as { accepted?: unknown } | null;
  if (!acceptanceMatchesCurrent(body?.accepted)) {
    return NextResponse.json(
      { success: false, error: "These documents changed. Reload the page.", code: "changed" },
      { status: 409 }
    );
  }
  try {
    await recordAgreementAcceptance(caller.agent.id, currentAgreementRefs());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[agent/agreements] POST", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Couldn't save. Try again." }, { status: 500 });
  }
}
