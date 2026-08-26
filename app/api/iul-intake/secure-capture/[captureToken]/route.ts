import { NextRequest, NextResponse } from "next/server";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { agentCrmGetBaseCredentials } from "@/lib/agent-crm-contacts";
import { decryptIntakeData, encryptIntakeData } from "@/lib/crypto/field-encryption";
import { isMaskedValue } from "@/lib/intake-shared/masking";
import { mergePreservedIulSensitive } from "@/lib/iul-intake/masking";
import { updateIntakeData, syncIntakeToCrm } from "@/lib/iul-intake/server";
import { sanitizeIntakeData, type IntakeData } from "@/lib/iul-intake/schema";
import { isValidSsn, isValidRouting } from "@/lib/iul-intake/validation";
import {
  getCaptureByToken,
  getIntakeById,
  markCaptureOpened,
  markCaptureSubmitted,
  markSensitiveCaptured,
} from "@/lib/iul-intake/secure-capture";

/**
 * The client's side of the secure capture link.
 *
 * This is the ONLY endpoint in the IUL feature an unauthenticated stranger can write to, so it is
 * deliberately narrow: it accepts four whitelisted keys, validates each one server-side, writes
 * once, and echoes nothing back.
 *
 * ─── Two things this route must never do ───
 *
 * 1. **Never call `ensureIulDeviceId()`.** That mints the `iul_intake_device` cookie, and
 *    `resolveIntakeAccess` grants a claim to any device on an unclaimed session — so minting it
 *    on the client's phone would silently hand that phone the whole intake session, and the
 *    client's laptop would later be locked out with `claimed_elsewhere`. The capture token is the
 *    only credential here.
 * 2. **Never return stored values, not even masked.** A "we have •••6789 on file" confirmation
 *    would be reassuring and would also turn a leaked link into a read oracle for the last four
 *    digits of someone's SSN.
 */

type RouteContext = { params: Promise<{ captureToken: string }> };

/** Resolve the capture + its session, or the reason this link is not usable. */
async function loadUsableCapture(captureToken: string) {
  const capture = await getCaptureByToken(captureToken);
  if (!capture) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (capture.status !== "pending") {
    return {
      error: NextResponse.json(
        {
          success: false,
          code: capture.status === "submitted" ? "already_submitted" : "cancelled",
          error:
            capture.status === "submitted"
              ? "This information has already been sent. Thank you."
              : "This link is no longer active. Please ask your agent for a new one.",
        },
        { status: 410 }
      ),
    };
  }

  const session = await getIntakeById(capture.sessionId);
  if (!session) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  // "Valid until the application is completed", enforced on the request rather than by a date.
  if (session.status === "completed") {
    return {
      error: NextResponse.json(
        {
          success: false,
          code: "completed",
          error: "This application is already finished — nothing more is needed.",
        },
        { status: 410 }
      ),
    };
  }
  return { capture, session };
}

/**
 * GET — what the phone needs to render the page: the language, a first name so the client can see
 * the link is genuinely theirs, and which fields this link asks for. Nothing else. No values, no
 * session token, no contact id.
 *
 * `fieldKeys` is the link's frozen snapshot, so the page renders exactly what the write endpoint
 * will accept. Sending the live constant instead would show a client an SSN box on a bank-only
 * link and then reject it on submit.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsableCapture(captureToken);
    if (loaded.error) return loaded.error;

    const { capture, session } = loaded;
    // Stamped once so the agent's panel can distinguish "sent" from "they opened it".
    if (!capture!.openedAt) await markCaptureOpened(capture!.id);

    const firstName =
      typeof session!.data === "object" && session!.data
        ? String((session!.data as IntakeData).firstName ?? "").trim()
        : "";

    return NextResponse.json({
      success: true,
      locale: session!.locale === "es" ? "es" : "en",
      firstName,
      fieldKeys: capture!.fieldKeys ?? [],
    });
  } catch (error) {
    console.error("[iul-intake/secure-capture/:captureToken] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * Server-side format checks. The client page validates too, but that is a courtesy, not a gate.
 *
 * Only the keys this link asks for are required. A bank-only link that demanded an SSN would be
 * unsubmittable, and — worse — the obvious fix of "validate whatever turns up" would let a link
 * through having collected nothing at all.
 */
function validate(patch: IntakeData, allowed: Set<string>): Record<string, string> {
  const errors: Record<string, string> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (allowed.has("ssn")) {
    const ssn = str(patch.ssn);
    if (!ssn || !isValidSsn(ssn)) errors.ssn = "invalid";
  }

  if (allowed.has("routingNumber")) {
    const routing = str(patch.routingNumber);
    if (!routing || !isValidRouting(routing)) errors.routingNumber = "invalid";
  }

  if (allowed.has("accountNumber")) {
    const account = str(patch.accountNumber).replace(/\D/g, "");
    if (account.length < 4 || account.length > 17) errors.accountNumber = "invalid";
  }

  if (allowed.has("accountType")) {
    const type = str(patch.accountType);
    if (type !== "Checking" && type !== "Savings") errors.accountType = "invalid";
  }

  return errors;
}

/** PATCH — the one write. Single use: succeeding closes the link. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsableCapture(captureToken);
    if (loaded.error) return loaded.error;

    const { capture, session } = loaded;

    const body = await request.json().catch(() => ({}));
    const incoming = sanitizeIntakeData(body?.data);

    // The whitelist is the frozen snapshot on the row, not the live constant — an already-issued
    // link must not gain new powers because the code changed after it was sent.
    const allowed = new Set(capture!.fieldKeys ?? []);
    const patch: IntakeData = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!allowed.has(key)) continue;
      // The page is never given a mask, so one arriving is a replay or a tampered payload.
      if (isMaskedValue(value)) {
        return NextResponse.json(
          { success: false, error: "Invalid submission." },
          { status: 400 }
        );
      }
      patch[key] = value;
    }

    // A link whose snapshot is somehow empty must not be submittable: with nothing required,
    // every check below would pass and the link would close having collected nothing.
    if (allowed.size === 0) {
      return NextResponse.json({ success: false, error: "Invalid submission." }, { status: 400 });
    }

    const errors = validate(patch, allowed);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    const stored = decryptIntakeData((session!.data ?? {}) as IntakeData);
    // The client is the more authoritative source for their own numbers, so their values win over
    // anything the agent had typed. `mergePreserved` can only protect stored data here — masks and
    // empties are already rejected above — so it is belt and braces, not the mechanism.
    const merged = mergePreservedIulSensitive({ ...stored, ...patch }, stored);
    const encrypted = encryptIntakeData(merged);

    // Preserve status: sending bank details must never flip a form's state on its own.
    const updated = await updateIntakeData(
      session!.token,
      encrypted,
      session!.status === "completed" ? "completed" : "in_progress"
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    await markSensitiveCaptured(session!.id);
    await markCaptureSubmitted(capture!.id);

    // Requirement: the full numbers land in the CRM as well as the encrypted DB row.
    const decrypted = decryptIntakeData((updated.data ?? {}) as IntakeData);
    await syncIntakeToCrm(updated, decrypted);

    // Best effort — the agent may not have the form open, and a lead they never hear about is
    // the failure this note exists to prevent.
    const creds = agentCrmGetBaseCredentials();
    if (creds && updated.crmContactId) {
      try {
        // Name what actually arrived. A note claiming an SSN was received on a bank-only link
        // is worse than no note — the agent stops chasing the one thing still missing.
        const FIELD_LABELS: Record<string, string> = {
          ssn: "SSN",
          routingNumber: "Routing Number",
          accountNumber: "Account Number",
          accountType: "Account Type",
        };
        const received = [...allowed].map((k) => FIELD_LABELS[k] ?? k);
        const summary = allowed.has("ssn")
          ? allowed.size > 1
            ? "their SSN and bank details"
            : "their SSN"
          : "their bank details";

        await createContactNote({
          contactId: updated.crmContactId,
          token: creds.token,
          title: "IUL — Secure Details Received",
          body:
            `The client submitted ${summary} from their own device on ` +
            `${new Date().toLocaleString()}. The values are on this contact's IUL fields ` +
            `(${received.join(", ")}). Nothing was read aloud on the call.`,
        });
      } catch (noteError) {
        console.warn("[iul-secure-capture] note failed:", noteError);
      }
    }

    // Deliberately no echo of what was saved.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[iul-intake/secure-capture/:captureToken] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}
