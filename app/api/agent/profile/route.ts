import { NextResponse, type NextRequest } from "next/server";
import { updateAgentProfile } from "@/lib/tenancy/agent-admin";
import { requireAgentApiCaller } from "@/lib/tenancy/agent-area";
import { agentProfileForm } from "@/lib/tenancy/agent-profile-input";

/**
 * PATCH /api/agent/profile — the signed-in agent edits their own profile. Only the profile fields
 * (lib/tenancy/agent-profile-input.ts checks each: https photo on a public host, E.164 WhatsApp,
 * Impact's own hosts for the referral link, US state codes…); never the login email, address,
 * status or test flag, which are Isaac's (/admin/agents).
 *
 * A linked agent who accepted the agreements; never an impersonated session.
 */
export async function PATCH(request: NextRequest) {
  const caller = await requireAgentApiCaller({ agreements: true });
  if (caller instanceof NextResponse) return caller;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ success: false, error: "Send the profile fields." }, { status: 400 });
  }
  try {
    const result = await updateAgentProfile(caller.agent, body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, fields: result.fields }, { status: result.status });
    }
    return NextResponse.json({ success: true, profile: agentProfileForm(result.value) });
  } catch (error) {
    console.error("[agent/profile] PATCH", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Couldn't save. Try again." }, { status: 500 });
  }
}
