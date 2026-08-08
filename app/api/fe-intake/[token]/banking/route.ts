import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getFeIntakeByToken,
  canAccessFeIntake,
  syncFeIntakeToCrm,
  updateFeIntakeData,
  isFeIntakeExpired,
  type FeIntakeStatus,
} from "@/lib/fe-intake/server";
import { sanitizeFeIntakeData, type FeIntakeData } from "@/lib/fe-intake/schema";
import { encryptFeIntakeData, decryptFeIntakeData } from "@/lib/fe-intake/encryption";
import { readFeDeviceId } from "@/lib/fe-intake/device";
import { mergePreservedSensitive } from "@/lib/fe-intake/masking";
import { postSubmitFieldKeys } from "@/lib/fe-intake/fields";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { createContactNote } from "@/lib/agent-crm-call-summary";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * PATCH /api/fe-intake/[token]/banking
 *
 * Accepts the optional payment details offered on the completion screen. Separate from the main
 * autosave for two reasons: it has to work on an already-submitted (locked) session, and it may
 * only write post-submission keys — so a stale or replayed request can never touch the answers
 * the client already signed off on.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const body = await request.json().catch(() => ({}));
    const incoming = sanitizeFeIntakeData(body?.data);

    // Whitelist: only banking keys are writable here.
    const allowed = new Set(postSubmitFieldKeys());
    const banking: FeIntakeData = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (allowed.has(key)) banking[key] = value;
    }
    if (Object.keys(banking).length === 0) {
      return NextResponse.json({ success: false, error: "No payment fields supplied." }, { status: 400 });
    }

    const stored = decryptFeIntakeData((row.data ?? {}) as FeIntakeData);
    const merged = mergePreservedSensitive({ ...stored, ...banking }, stored);
    const encrypted = encryptFeIntakeData(merged);

    // Preserve the existing status — adding payment details must not reopen a completed form.
    const updated = await updateFeIntakeData(token, encrypted, row.status as FeIntakeStatus);
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const decrypted = decryptFeIntakeData((updated.data ?? {}) as FeIntakeData);
    await syncFeIntakeToCrm(updated, decrypted);

    // Tell the agent it landed — they're about to call and need to know it's waiting for them.
    const creds = agentCrmGetBaseCredentials();
    if (creds && updated.crmContactId) {
      try {
        await createContactNote({
          contactId: updated.crmContactId,
          token: creds.token,
          title: "Final Expense — Payment Info Added",
          body:
            `The client added their bank draft details from the completion screen on ` +
            `${new Date().toLocaleString()}. Routing and account numbers are on the contact's ` +
            `FE Intake fields. Bank account only — no card was collected.`,
        });
      } catch (noteError) {
        console.warn("[fe-intake/banking] note failed:", noteError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[fe-intake/:token/banking] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save payment information" }, { status: 500 });
  }
}
