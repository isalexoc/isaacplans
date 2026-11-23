import { NextRequest, NextResponse } from "next/server";
import { isResponse, loadAuthorizedSession, notFound } from "@/lib/intake-core/route-helpers";
import { patchIntakeData } from "@/lib/intake-core/server";
import { planSensitivePurge } from "@/lib/intake-core/purge";
import type { IntakeData } from "@/lib/intake-core/types";
import {
  agentOwnerMayActOnSensitive,
  ENTERED_IN_IMPACT_KEY,
  isJsonContentType,
  sameOriginFetch,
  SENSITIVE_PURGED_KEY,
} from "@/lib/tenancy/agent-data";
import { logSensitiveAccess } from "@/lib/tenancy/audit";

/**
 * POST /api/intake/[lob]/[token]/purge: the agent's "Entered in Impact" ("Ya la ingresé en
 * Impact"). Once a completed application is in Impact's own system, its SSN/ITIN, ID number, bank
 * numbers and every added person's SSN have no reason to stay here (ACN P&P §VIII.1: sensitive
 * payment information may not be retained). Erases them all and records `enteredInImpactAt`, in ONE
 * statement (`patchIntakeData`), plus a "purge" row in the access log (the fields' names only).
 * Without this, the 30-day job erases them anyway (app/api/queue/agent-purge), with the daily
 * reconcile as its backstop.
 *
 * Idempotent: once marked, a repeat (a double click, a second tab) with nothing back on file answers
 * the first date with no write and no new row. A number typed again since is erased like the first
 * time, and the first date is kept.
 *
 * The owning agent in person only, on a completed application: the same rule as `…/reveal` (the
 * token route's, then `agentOwnerMayActOnSensitive`), from this site's own pages only (exact JSON
 * media type, `Sec-Fetch-Site`). Isaac's applications never get here.
 */

type RouteContext = { params: Promise<{ lob: string; token: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    // JSON only, from this site's pages: another site can't send that without a preflight, and the
    // browser says where a request came from.
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return NextResponse.json({ success: false, error: "Expected JSON" }, { status: 415 });
    }
    if (!sameOriginFetch(request.headers.get("sec-fetch-site"))) {
      return NextResponse.json({ success: false, error: "Forbidden", code: "forbidden" }, { status: 403 });
    }

    const loaded = await loadAuthorizedSession(lob, token, { claim: false });
    if (isResponse(loaded)) return loaded;
    const { config, row, access, ownerAgent, userId, actor } = loaded;

    if (!agentOwnerMayActOnSensitive({ role: access.role, ownerIsAgent: ownerAgent !== null, impersonated: Boolean(actor) })) {
      // Signed-in callers only, like the token route's own denials: a client's browser (or anyone
      // holding the link) can't fill the log.
      if (userId) {
        await logSensitiveAccess({
          action: "denied",
          actorUserId: userId,
          actorRole: access.role === "owner" ? (ownerAgent ? "agent" : "admin") : "client",
          impersonatorUserId: actor?.sub ?? null,
          ownerUserId: row.ownerUserId,
          sessionId: row.id,
        });
      }
      return NextResponse.json({ success: false, error: "Forbidden", code: "forbidden" }, { status: 403 });
    }
    if (row.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "Only a completed application can be marked as entered.", code: "not_completed" },
        { status: 409 }
      );
    }

    const stored = (row.data ?? {}) as IntakeData;
    const { patch, fields } = planSensitivePurge(config.sections, stored);
    const markedAt = stored[ENTERED_IN_IMPACT_KEY];
    const enteredBefore = typeof markedAt === "string" && markedAt !== "" ? markedAt : null;
    if (enteredBefore && Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, enteredInImpactAt: enteredBefore, erased: [] });
    }

    const at = new Date().toISOString();
    const updated = await patchIntakeData(token, {
      ...patch,
      [ENTERED_IN_IMPACT_KEY]: enteredBefore ?? at,
      ...(fields.length ? { [SENSITIVE_PURGED_KEY]: at } : {}),
    });
    if (!updated) return notFound();

    await logSensitiveAccess({
      action: "purge",
      actorUserId: userId,
      actorRole: "agent",
      ownerUserId: row.ownerUserId,
      sessionId: row.id,
      fields,
    });
    return NextResponse.json({ success: true, enteredInImpactAt: enteredBefore ?? at, erased: fields });
  } catch (error) {
    console.error(`[intake/${lob}/:token/purge] POST`, error);
    return NextResponse.json({ success: false, error: "Failed to erase" }, { status: 500 });
  }
}
