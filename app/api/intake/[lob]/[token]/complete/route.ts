import { NextRequest, NextResponse } from "next/server";
import {
  alreadySubmitted,
  isResponse,
  loadAuthorizedSession,
  notFound,
} from "@/lib/intake-core/route-helpers";
import {
  buildCrmPayloadFromData,
  clientCanEdit,
  ensureCrmContactForSession,
  getIntakeByToken,
  intakeTags,
  markIntakeCompleted,
  toIntakeSummary,
} from "@/lib/intake-core/server";
import { validateForCompletion } from "@/lib/intake-core/schema";
import { decryptIntakeData, purgeIntakeSensitiveData } from "@/lib/intake-core/sensitive";
import { agentCrmUpdateContact, agentCrmAddContactTags } from "@/lib/agent-crm-contacts";
import { crmCredsForOwner } from "@/lib/tenancy/crm";
import { createContactNote } from "@/lib/agent-crm-call-summary";
import { allRepeaterFields, isRowFilled, sensitiveScalarKeys } from "@/lib/intake-core/fields";
import { diffIntakeData } from "@/lib/intake-core/diff";
import type { IntakeData, IntakeLobConfig, RepeaterRow } from "@/lib/intake-core/types";

type RouteContext = { params: Promise<{ lob: string; token: string }> };

const PURGE_AFTER_SYNC = process.env.INTAKE_PURGE_AFTER_SYNC === "true";

/** "2 people to cover, 3 medications" — a one-line shape summary for the completion note. */
function repeaterSummary(config: IntakeLobConfig, data: IntakeData): string {
  const parts: string[] = [];
  for (const field of allRepeaterFields(config.sections)) {
    const rows = data[field.key];
    if (!Array.isArray(rows)) continue;
    const filled = (rows as RepeaterRow[]).filter((r) => isRowFilled(field, r ?? {})).length;
    if (filled > 0) parts.push(`${field.labelEn}: ${filled}`);
  }
  return parts.join(", ");
}

// POST /api/intake/[lob]/[token]/complete — validate, sync to CRM, mark completed
export async function POST(_request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    // `claim: false` — by submission time the client already holds the cookie; minting one here
    // would let a fresh browser with the link claim a session at the last moment.
    const loaded = await loadAuthorizedSession(lob, token, { claim: false });
    if (isResponse(loaded)) return loaded;
    const { config, row, access } = loaded;

    // A client cannot re-submit a locked (already-completed) form; the admin re-opens it first.
    if (access.role === "client" && !clientCanEdit(row)) return alreadySubmitted();

    const decrypted = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
    const check = validateForCompletion(config.sections, decrypted);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, error: check.message, missing: check.missing },
        { status: 400 }
      );
    }

    const logTag = `[${config.slugPrefix.toUpperCase()}_INTAKE]`;
    // Isaac's CRM only for sessions it may serve; an agent's session syncs nowhere (lib/tenancy/crm.ts).
    const creds = await crmCredsForOwner(row.ownerUserId);
    // A session that started anonymously has no contact until the client supplies an email or
    // phone — by submission time they have, so create it now if the autosaves somehow missed it.
    await ensureCrmContactForSession(config, row, decrypted);

    let crmSynced = false;
    if (creds && row.crmContactId) {
      const { native, customFields, skippedSlugs } = buildCrmPayloadFromData(config, decrypted);
      if (skippedSlugs.length > 0) {
        console.warn(
          `[${config.lob}-intake] Custom fields not provisioned yet (run pnpm intake:fields ${config.lob}):`,
          Array.from(new Set(skippedSlugs)).join(", ")
        );
      }
      crmSynced = await agentCrmUpdateContact(
        row.crmContactId,
        { native, customFields },
        creds.token,
        logTag
      );
      // Documents are attached to their FILE_UPLOAD fields at upload time by the files route —
      // nothing to re-sync here.

      // Tag so a GHL workflow can notify the agent that the form came back.
      await agentCrmAddContactTags(
        row.crmContactId,
        [intakeTags(config).completed],
        creds.token,
        logTag
      );

      try {
        const who =
          row.contactName ||
          [native.firstName, native.lastName].filter(Boolean).join(" ") ||
          "client";
        const shape = repeaterSummary(config, decrypted);
        await createContactNote({
          contactId: row.crmContactId,
          token: creds.token,
          title: `${config.label} Intake Completed`,
          body:
            `${config.label} intake completed for ${who} via the online form on ` +
            `${new Date().toLocaleString()}.` +
            (shape ? ` ${shape}.` : "") +
            ` Fields synced to the contact; any uploaded documents are on the ${config.label} document fields.`,
        });
      } catch (noteError) {
        console.warn(`[${config.lob}-intake] Failed to post completion note:`, noteError);
      }
    } else if (!row.crmContactId) {
      console.warn(`[${config.lob}-intake] Session has no linked CRM contact; skipping sync.`);
    }

    // The answers stay as stored: writing back the copy read above would undo any save that landed
    // during the CRM calls. A purge writes only the sensitive values it blanks, worked out from the
    // row as stored now so an edit made during those calls isn't reverted; and it nulls every
    // sensitive scalar, so one saved after even that read doesn't stay at rest (null merges safely).
    let purge: IntakeData | null = null;
    if (PURGE_AFTER_SYNC && crmSynced) {
      const latest = await getIntakeByToken(config, token);
      const storedNow = ((latest ?? row).data ?? {}) as IntakeData;
      purge = diffIntakeData(storedNow, purgeIntakeSensitiveData(config, storedNow));
      for (const key of sensitiveScalarKeys(config.sections)) purge[key] = null;
    }

    const updated = await markIntakeCompleted(token, purge);
    if (!updated) return notFound();

    return NextResponse.json({ success: true, crmSynced, session: toIntakeSummary(updated) });
  } catch (error) {
    console.error(`[intake/${lob}/:token/complete] POST`, error);
    return NextResponse.json(
      { success: false, error: "Failed to complete intake" },
      { status: 500 }
    );
  }
}
