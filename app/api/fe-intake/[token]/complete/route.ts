import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getFeIntakeByToken,
  canAccessFeIntake,
  feClientCanEdit,
  buildCrmPayloadFromData,
  markFeIntakeCompleted,
  toFeIntakeSummary,
  isFeIntakeExpired,
  ensureCrmContactForSession,
  FE_INTAKE_COMPLETED_TAG,
} from "@/lib/fe-intake/server";
import { readFeDeviceId } from "@/lib/fe-intake/device";
import { validateForCompletion, type FeIntakeData } from "@/lib/fe-intake/schema";
import {
  decryptFeIntakeData,
  purgeFeSensitiveData,
} from "@/lib/fe-intake/encryption";
import {
  agentCrmGetBaseCredentials,
  agentCrmUpdateContact,
  agentCrmAddContactTags,
} from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { upsertMailingLabelFromLead } from "@/lib/mailing-labels/server";

type RouteContext = { params: Promise<{ token: string }> };

const PURGE_AFTER_SYNC = process.env.FE_INTAKE_PURGE_AFTER_SYNC === "true";

// POST /api/fe-intake/[token]/complete — validate, sync to CRM, mark completed
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const row = await getFeIntakeByToken(token);
    if (!row) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const { userId } = await auth();
    const deviceId = await readFeDeviceId();

    const access = canAccessFeIntake(row, { userId, deviceId });
    if (!access.allowed) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (access.role === "client" && isFeIntakeExpired(row)) {
      return NextResponse.json(
        { success: false, error: "This link has expired. Please call us for a new one.", code: "expired" },
        { status: 410 }
      );
    }
    // A client cannot re-submit a locked (already-completed) form; the admin re-opens it first.
    if (access.role === "client" && !feClientCanEdit(row)) {
      return NextResponse.json({ success: false, error: "This form has already been submitted." }, { status: 403 });
    }

    const decrypted = decryptFeIntakeData((row.data ?? {}) as FeIntakeData);
    const check = validateForCompletion(decrypted);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.message, missing: check.missing },
        { status: 400 }
      );
    }

    const creds = agentCrmGetBaseCredentials();
    // A session that started anonymously has no contact until the client supplies an email or
    // phone — by submission time they have, so create it now if the autosaves somehow missed it.
    await ensureCrmContactForSession(row, decrypted);
    let crmSynced = false;
    if (creds && row.crmContactId) {
      const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(decrypted);
      if (skippedSlugs.length > 0) {
        console.warn(
          "[fe-intake] Custom fields not provisioned yet (run pnpm fe-intake:fields):",
          Array.from(new Set(skippedSlugs)).join(", ")
        );
      }
      crmSynced = await agentCrmUpdateContact(
        row.crmContactId,
        { native, customFields },
        creds.token,
        "[FE_INTAKE]"
      );

      // Tag so a GHL workflow can notify the agent that the form came back.
      await agentCrmAddContactTags(
        row.crmContactId,
        [FE_INTAKE_COMPLETED_TAG],
        creds.token,
        "[FE_INTAKE]"
      );

      try {
        const who = row.contactName || [native.firstName, native.lastName].filter(Boolean).join(" ") || "client";
        await createContactNote({
          contactId: row.crmContactId,
          token: creds.token,
          title: "Final Expense Intake Completed",
          body:
            `Final Expense intake completed for ${who} via the online form on ${new Date().toLocaleString()}. ` +
            `Fields synced to the contact.`,
        });
      } catch (noteError) {
        console.warn("[fe-intake] Failed to post completion note:", noteError);
      }
    } else if (!row.crmContactId) {
      console.warn("[fe-intake] Session has no linked CRM contact; skipping sync.");
    }

    const dataToStore =
      PURGE_AFTER_SYNC && crmSynced
        ? purgeFeSensitiveData((row.data ?? {}) as FeIntakeData)
        : ((row.data ?? {}) as FeIntakeData);

    const updated = await markFeIntakeCompleted(token, dataToStore);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Queue a printable mailing label (see /admin/mailing-labels). Read from `decrypted`, not
    // `row.data` — intake data is encrypted at rest, and FE_INTAKE_PURGE_AFTER_SYNC may have
    // just wiped the stored copy. Errors are swallowed inside the helper.
    const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    await upsertMailingLabelFromLead({
      source: "fe_intake",
      sourceRef: token,
      crmContactId: row.crmContactId ?? undefined,
      firstName: str(decrypted.firstName),
      lastName: str(decrypted.lastName),
      addressLine1: str(decrypted.address1),
      addressLine2: str(decrypted.address2),
      city: str(decrypted.city),
      state: str(decrypted.state),
      postalCode: str(decrypted.postalCode),
      language: row.locale === "es" ? "es" : "en",
      phone: str(decrypted.phone),
      email: str(decrypted.email),
    });

    return NextResponse.json({
      success: true,
      crmSynced,
      session: toFeIntakeSummary(updated),
    });
  } catch (error) {
    console.error("[fe-intake/:token/complete] POST", error);
    return NextResponse.json({ success: false, error: "Failed to complete intake" }, { status: 500 });
  }
}
