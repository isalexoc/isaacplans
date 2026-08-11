import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  agentCrmGetBaseCredentials,
  agentCrmGetContactNative,
  agentCrmSearchContacts,
} from "@/lib/agent-crm-contacts";

/**
 * Look up prospects in Agent CRM so a label can be built from a contact that already exists —
 * which is nearly always the case. Pulling the contact this way also links `crmContactId`, which
 * is what lets the letter draft from their call summaries.
 */

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

/** GET ?q=… — matches on name, email, or phone. */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) {
      return NextResponse.json({ success: true, contacts: [] });
    }

    const creds = agentCrmGetBaseCredentials();
    if (!creds) {
      return NextResponse.json(
        { success: false, error: "Agent CRM isn't configured on this environment." },
        { status: 503 }
      );
    }

    const contacts = await agentCrmSearchContacts(q, creds.locationId, creds.token);
    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("[admin/mailing-labels/crm-search] GET", error);
    return NextResponse.json({ success: false, error: "CRM search failed" }, { status: 502 });
  }
}

/** POST { contactId } — full native fields for the picked contact, to prefill the form. */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const contactId = typeof body?.contactId === "string" ? body.contactId.trim() : "";
    if (!contactId) {
      return NextResponse.json({ success: false, error: "No contact selected" }, { status: 400 });
    }

    const creds = agentCrmGetBaseCredentials();
    if (!creds) {
      return NextResponse.json(
        { success: false, error: "Agent CRM isn't configured on this environment." },
        { status: 503 }
      );
    }

    const contact = await agentCrmGetContactNative(contactId, creds.token);
    if (!contact) {
      return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, contact });
  } catch (error) {
    console.error("[admin/mailing-labels/crm-search] POST", error);
    return NextResponse.json({ success: false, error: "Could not load the contact" }, { status: 502 });
  }
}
