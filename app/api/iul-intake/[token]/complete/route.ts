import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getIntakeByToken,
  canAccessIntake,
  buildCrmPayloadFromData,
  markIntakeCompleted,
  toIntakeSummary,
} from "@/lib/iul-intake/server";
import { validateForCompletion, type IntakeData } from "@/lib/iul-intake/schema";
import {
  decryptIntakeData,
  purgeSensitiveData,
} from "@/lib/crypto/field-encryption";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
} from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";

type RouteContext = { params: Promise<{ token: string }> };

const PURGE_AFTER_SYNC = process.env.IUL_INTAKE_PURGE_AFTER_SYNC === "true";

// POST /api/iul-intake/[token]/complete — validate, sync to CRM, mark completed
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (!canAccessIntake(row, userId).allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const decrypted = decryptIntakeData((row.data ?? {}) as IntakeData);
    const check = validateForCompletion(decrypted);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.message, missing: check.missing },
        { status: 400 }
      );
    }

    // Sync to the CRM contact (native + custom fields), then add a note.
    const creds = agentCrmGetBaseCredentials();
    let crmSynced = false;
    if (creds && row.crmContactId) {
      const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
      if (skippedSlugs.length > 0) {
        console.warn(
          "[iul-intake] Custom fields not provisioned yet (run scripts/create-iul-intake-fields.ts):",
          skippedSlugs.join(", ")
        );
      }
      crmSynced = await agentCrmUpdateContact(
        row.crmContactId,
        { native, customFields },
        creds.token,
        "[IUL_INTAKE]"
      );

      try {
        const who = row.contactName || [native.firstName, native.lastName].filter(Boolean).join(" ") || "client";
        await createContactNote({
          contactId: row.crmContactId,
          token: creds.token,
          title: "IUL Intake Completed",
          body: `IUL application intake completed for ${who} via the online form on ${new Date().toLocaleString()}. Fields synced to the contact.`,
        });
      } catch (noteError) {
        console.warn("[iul-intake] Failed to post completion note:", noteError);
      }
    } else if (!row.crmContactId) {
      console.warn("[iul-intake] Session has no linked CRM contact; skipping sync.");
    }

    const dataToStore =
      PURGE_AFTER_SYNC && crmSynced
        ? purgeSensitiveData((row.data ?? {}) as IntakeData)
        : ((row.data ?? {}) as IntakeData);

    const updated = await markIntakeCompleted(token, dataToStore);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      crmSynced,
      session: toIntakeSummary(updated),
    });
  } catch (error) {
    console.error("[iul-intake/:token/complete] POST", error);
    return NextResponse.json({ success: false, error: "Failed to complete intake" }, { status: 500 });
  }
}
