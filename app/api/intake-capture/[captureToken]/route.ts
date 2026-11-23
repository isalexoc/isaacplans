import { NextRequest, NextResponse } from "next/server";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { getIntakeConfig } from "@/lib/intake-configs";
import { sanitizeIntakeData } from "@/lib/intake-core/schema";
import { planIntakePatch } from "@/lib/intake-core/patch";
import { decryptIntakeData, encryptIntakeData } from "@/lib/intake-core/sensitive";
import { patchIntakeData, syncIntakeToCrm } from "@/lib/intake-core/server";
import { captureGroups, groupsForKeys } from "@/lib/intake-core/secure-capture-groups";
import {
  getCaptureByToken,
  getIntakeSessionById,
  markCaptureOpened,
  markCaptureSubmitted,
  validateCapture,
} from "@/lib/intake-core/secure-capture";
import type { IntakeData } from "@/lib/intake-core/types";
import { isMaskedValue } from "@/lib/intake-shared/masking";
import { lookupBankByRouting } from "@/lib/iul-intake/ach-directory";
import { ownerAcceptsClientData } from "@/lib/tenancy/context";
import { crmCredsForOwner } from "@/lib/tenancy/crm";

/**
 * The client's side of a secure link — the only intake endpoint an unauthenticated stranger can
 * write to, so it is narrow on purpose: the link's frozen keys only, validated server-side, one
 * write, nothing echoed back. Same rules as the IUL route:
 *
 * 1. Never mint the intake's device cookie here. It would hand this phone the whole application.
 *    The capture token is the only credential.
 * 2. Never return stored values, not even masked: a leaked link must not become a way to read the
 *    last four digits of someone's SSN.
 */

type RouteContext = { params: Promise<{ captureToken: string }> };

const gone = (code: string, error: string) => NextResponse.json({ success: false, code, error }, { status: 410 });
const notFound = () => NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
// No `code`: the page treats a coded error as a dead link and drops what the client typed, while
// this one is worth another tap of the button.
const retryLater = () =>
  NextResponse.json(
    { success: false, error: "Please try again in a moment." },
    { status: 503, headers: { "Retry-After": "5" } }
  );

/** The capture, its line and its session, or the reason the link can't be used. */
async function loadUsable(captureToken: string) {
  const capture = await getCaptureByToken(captureToken);
  if (!capture) return { error: notFound() };
  if (capture.status !== "pending") {
    return {
      error:
        capture.status === "submitted"
          ? gone("already_submitted", "This information has already been sent. Thank you.")
          : gone("cancelled", "This link is no longer active. Please ask your agent for a new one."),
    };
  }
  const config = getIntakeConfig(capture.lob);
  const session = config ? await getIntakeSessionById(capture.lob, capture.sessionId) : null;
  if (!config || !session) return { error: notFound() };
  // An agent's link stops working while that agent is paused or the launch gates are closed, and
  // Isaac's links don't work on the product domain. A failed owner lookup fails closed.
  const flow = await ownerAcceptsClientData(config.lob, session.ownerUserId);
  if (flow === "retry") return { error: retryLater() };
  if (flow === "closed") return { error: notFound() };
  if (session.status === "completed") {
    return { error: gone("completed", "This application is already finished. Nothing more is needed.") };
  }
  return { capture, config, session };
}

/**
 * GET — what the page needs: the line (for its logo and labels), a first name so the client can see
 * the link is theirs, the keys it asks for, and the answers that say which number each one is
 * (SSN or ITIN, which kind of ID). No values, no session token, no contact id.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsable(captureToken);
    if (loaded.error) return loaded.error;
    const { capture, config, session } = loaded;
    if (!capture.openedAt) await markCaptureOpened(capture.id);

    const data = (session.data ?? {}) as IntakeData;
    const asked = new Set(groupsForKeys(config, capture.fieldKeys ?? []));
    const kinds: Record<string, string> = {};
    for (const group of captureGroups(config)) {
      if (asked.has(group.key) && group.requires) kinds[group.requires] = String(data[group.requires] ?? "");
    }

    return NextResponse.json({
      success: true,
      lob: config.lob,
      firstName: String(data.firstName ?? "").trim(),
      fieldKeys: capture.fieldKeys ?? [],
      kinds,
    });
  } catch (error) {
    console.error("[intake-capture/:captureToken] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * A plain-text CRM note naming what arrived, so the agent hears about it even with the form closed.
 * Only in Isaac's CRM, for a session it may serve (lib/tenancy/crm.ts).
 */
async function noteReceived(
  ownerUserId: string,
  contactId: string | null,
  labels: string[],
  lineLabel: string
) {
  if (!contactId) return;
  const creds = await crmCredsForOwner(ownerUserId);
  if (!creds) return;
  try {
    await createContactNote({
      contactId,
      token: creds.token,
      title: `${lineLabel} — Secure details received`,
      body:
        `The client sent ${labels.join(", ")} from their own device on ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} (ET). ` +
        "The values are on the intake and this contact. Nothing was read aloud on the call.",
    });
  } catch (noteError) {
    console.warn("[intake-capture] note failed:", noteError);
  }
}

/** PATCH — the one write. Single use: succeeding closes the link. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const loaded = await loadUsable(captureToken);
    if (loaded.error) return loaded.error;
    const { capture, config, session } = loaded;

    // The frozen snapshot is the whitelist, never the live config: a link already in someone's
    // text messages must not gain new powers because the code changed.
    const allowed = new Set(capture.fieldKeys ?? []);
    if (allowed.size === 0) return NextResponse.json({ success: false, error: "Invalid submission." }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const incoming = sanitizeIntakeData(config.sections, body?.data);
    const patch: IntakeData = {};
    for (const [key, value] of Object.entries(incoming)) {
      if (!allowed.has(key)) continue;
      // The page is never given a mask, so one arriving is a replay or a tampered payload.
      if (isMaskedValue(value)) return NextResponse.json({ success: false, error: "Invalid submission." }, { status: 400 });
      patch[key] = typeof value === "string" ? value.trim() : value;
    }
    if (typeof patch.idDocNumber === "string") patch.idDocNumber = patch.idDocNumber.toUpperCase();

    const errors = validateCapture(patch, allowed);
    if (Object.keys(errors).length) return NextResponse.json({ success: false, errors }, { status: 400 });

    const stored = decryptIntakeData(config, (session.data ?? {}) as IntakeData);
    // The client is the authority on their own numbers, so their values win over the agent's.
    // Only the keys this link wrote (plus a looked-up bank name) are merged into the session, so an
    // answer the agent saved meanwhile is kept.
    const write = planIntakePatch(config.sections, patch, stored);
    // A routing number from the phone names its bank, so the agent isn't left asking for it.
    if (typeof patch.routingNumber === "string" && !String(stored.bankName ?? "").trim()) {
      const bank = lookupBankByRouting(patch.routingNumber);
      if (bank) write.bankName = bank.bankName;
    }

    const updated = await patchIntakeData(session.token, encryptIntakeData(config, write));
    if (!updated) return notFound();
    await markCaptureSubmitted(capture.id);

    await syncIntakeToCrm(config, updated, decryptIntakeData(config, (updated.data ?? {}) as IntakeData));
    const labels = captureGroups(config)
      .filter((g) => groupsForKeys(config, capture.fieldKeys ?? []).includes(g.key))
      .map((g) => g.labelEn);
    await noteReceived(updated.ownerUserId, updated.crmContactId, labels, config.label);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[intake-capture/:captureToken] PATCH", error);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}
