import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getAcaIntakeByToken,
  canAccessAcaIntake,
  acaClientCanEdit,
  buildCrmPayloadFromData,
  markAcaIntakeCompleted,
  toAcaIntakeSummary,
  ACA_INTAKE_COMPLETED_TAG,
} from "@/lib/aca-intake/server";
import { validateForCompletion, type AcaIntakeData } from "@/lib/aca-intake/schema";
import {
  decryptAcaIntakeData,
  purgeAcaSensitiveData,
} from "@/lib/aca-intake/encryption";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmAddContactTags,
} from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { isRowFilled, fieldByKey, type RepeaterRow } from "@/lib/aca-intake/fields";

type RouteContext = { params: Promise<{ token: string }> };

const PURGE_AFTER_SYNC = process.env.ACA_INTAKE_PURGE_AFTER_SYNC === "true";

/** Count household members that actually have data — used in the completion note. */
function householdSize(data: AcaIntakeData): number {
  const field = fieldByKey("householdMembers");
  const rows = data.householdMembers;
  if (!field || !Array.isArray(rows)) return 0;
  return (rows as RepeaterRow[]).filter((r) => isRowFilled(field, r ?? {})).length;
}

// POST /api/aca-intake/[token]/complete — validate, sync to CRM, mark completed
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await context.params;
    const row = await getAcaIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    if (!canAccessAcaIntake(row, userId).allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    // A client cannot re-submit a locked (already-completed) form; the admin re-opens it first.
    if (row.ownerUserId !== userId && !acaClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const decrypted = decryptAcaIntakeData((row.data ?? {}) as AcaIntakeData);
    const check = validateForCompletion(decrypted);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.message, missing: check.missing },
        { status: 400 }
      );
    }

    // Sync to the CRM contact (native + custom fields), then tag + add a note.
    const creds = agentCrmGetBaseCredentials();
    let crmSynced = false;
    if (creds && row.crmContactId) {
      const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
      if (skippedSlugs.length > 0) {
        console.warn(
          "[aca-intake] Custom fields not provisioned yet (run pnpm aca:fields):",
          Array.from(new Set(skippedSlugs)).join(", ")
        );
      }
      crmSynced = await agentCrmUpdateContact(
        row.crmContactId,
        { native, customFields },
        creds.token,
        "[ACA_INTAKE]"
      );
      // Note: documents are attached to their FILE_UPLOAD fields at upload time via the
      // dedicated forms/upload-custom-files endpoint — nothing to re-sync here.

      // Tag so a GHL workflow can notify the agent that the form came back.
      await agentCrmAddContactTags(
        row.crmContactId,
        [ACA_INTAKE_COMPLETED_TAG],
        creds.token,
        "[ACA_INTAKE]"
      );

      try {
        const who = row.contactName || [native.firstName, native.lastName].filter(Boolean).join(" ") || "client";
        const size = householdSize(decrypted);
        await createContactNote({
          contactId: row.crmContactId,
          token: creds.token,
          title: "ACA Intake Completed",
          body:
            `ACA intake completed for ${who} via the online form on ${new Date().toLocaleString()}. ` +
            `Household members: ${size}. Fields synced to the contact; identity documents are on the ` +
            `ACA document fields.`,
        });
      } catch (noteError) {
        console.warn("[aca-intake] Failed to post completion note:", noteError);
      }
    } else if (!row.crmContactId) {
      console.warn("[aca-intake] Session has no linked CRM contact; skipping sync.");
    }

    const dataToStore =
      PURGE_AFTER_SYNC && crmSynced
        ? purgeAcaSensitiveData((row.data ?? {}) as AcaIntakeData)
        : ((row.data ?? {}) as AcaIntakeData);

    const updated = await markAcaIntakeCompleted(token, dataToStore);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      crmSynced,
      session: toAcaIntakeSummary(updated),
    });
  } catch (error) {
    console.error("[aca-intake/:token/complete] POST", error);
    return NextResponse.json({ success: false, error: "Failed to complete intake" }, { status: 500 });
  }
}
