import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  agentCrmFindContactByEmail,
  agentCrmFindContactByPhone,
  agentCrmGetBaseCredentials,
} from "@/lib/agent-crm-contacts";
import { getFeIntakeByToken } from "@/lib/fe-intake/server";
import { generateProspectLetter } from "@/lib/mailing-labels/letter";
import {
  getMailingLabelById,
  saveEditedLetter,
  saveGeneratedLetter,
  setLetterKind,
  setMailingLabelCrmContactId,
} from "@/lib/mailing-labels/server";
import { LETTER_KINDS, type LetterKind } from "@/lib/mailing-labels/types";
import { resolveMailingLabelAgent } from "@/lib/mailing-labels/agent";

// The model call can take a few seconds; Node runtime for the OpenAI SDK.
export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

// Security: /api/admin/* is enforced by middleware; auth() here is defense-in-depth.

/**
 * Best-effort link to a CRM contact so the draft can use past call summaries. Manual rows never
 * have one, but Isaac usually has the prospect's phone — and the phone is how GHL dedupes.
 */
async function ensureCrmContactId(
  label: NonNullable<Awaited<ReturnType<typeof getMailingLabelById>>>
): Promise<string | null> {
  if (label.crmContactId) return label.crmContactId;

  let found: string | null = null;

  // Rows queued before crm_contact_id existed still know their intake session, which has it.
  if (label.source === "fe_intake" && label.sourceRef) {
    try {
      found = (await getFeIntakeByToken(label.sourceRef))?.crmContactId ?? null;
    } catch (error) {
      console.warn("[mailing-labels/letter] Intake lookup failed:", error);
    }
  }

  if (!found) {
    const creds = agentCrmGetBaseCredentials();
    if (!creds) return null;
    try {
      if (label.phone) {
        found =
          (await agentCrmFindContactByPhone(label.phone, creds.locationId, creds.token))?.id ?? null;
      }
      if (!found && label.email) {
        found =
          (await agentCrmFindContactByEmail(label.email, creds.locationId, creds.token))?.id ?? null;
      }
    } catch (error) {
      console.warn("[mailing-labels/letter] CRM lookup failed:", error);
      return null;
    }
  }

  if (found) await setMailingLabelCrmContactId(label.id, found);
  return found;
}

/** POST — draft (or redraft) the letter from scratch. */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const label = await getMailingLabelById(id);
    if (!label) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const agent = await resolveMailingLabelAgent(userId);
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Set the name that signs your letters in Settings (or fill in the Leave-Behind agent profile).",
          code: "agent_profile_missing",
        },
        { status: 400 }
      );
    }

    const crmContactId = await ensureCrmContactId(label);
    const generated = await generateProspectLetter({
      record: { ...label, crmContactId },
      agent,
    });

    const saved = await saveGeneratedLetter(id, generated.body, generated.context);
    return NextResponse.json({ success: true, label: saved });
  } catch (error) {
    console.error("[admin/mailing-labels/:id/letter] POST", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Could not draft the letter",
      },
      { status: 502 }
    );
  }
}

/** PATCH — save the agent's hand edits. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();

    // Flipping the prospect/client switch comes through here too, on its own.
    if (typeof body?.letterKind === "string") {
      if (!(LETTER_KINDS as readonly string[]).includes(body.letterKind)) {
        return NextResponse.json({ success: false, error: "Unknown letter kind" }, { status: 400 });
      }
      const updated = await setLetterKind(id, body.letterKind as LetterKind);
      if (!updated) {
        return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, label: updated });
    }

    const letterBody = typeof body?.letterBody === "string" ? body.letterBody.trim() : "";
    if (!letterBody) {
      return NextResponse.json(
        { success: false, error: "The letter can't be empty." },
        { status: 400 }
      );
    }

    const saved = await saveEditedLetter(id, letterBody);
    if (!saved) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, label: saved });
  } catch (error) {
    console.error("[admin/mailing-labels/:id/letter] PATCH", error);
    return NextResponse.json({ success: false, error: "Could not save the letter" }, { status: 500 });
  }
}
