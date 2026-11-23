import { NextRequest, NextResponse } from "next/server";
import { decryptString, isEncrypted } from "@/lib/crypto/field-encryption";
import { isResponse, loadAuthorizedSession } from "@/lib/intake-core/route-helpers";
import {
  agentOwnerMayActOnSensitive,
  isJsonContentType,
  parseRevealTarget,
  revealFieldName,
  revealStoredValue,
  sameOriginFetch,
} from "@/lib/tenancy/agent-data";
import { logSensitiveAccess } from "@/lib/tenancy/audit";

/**
 * POST /api/intake/[lob]/[token]/reveal `{ field, rowIndex? }`: one sensitive value of an agent's
 * application, in full, for the agent who owns it. Their view of the application shows masks
 * (lib/intake-core/save.ts `sessionDataForCaller`); this is the one way back to a number, a value at
 * a time, and every reveal is on record (`sensitive_access_log`, action "reveal", the field's name
 * only, never the value). No record, no value: if the row can't be written the answer is a 503.
 *
 * Who: the token route's rule first (lib/intake-core/route-helpers.ts `loadAuthorizedSession`): any
 * other operator, Isaac included, a paused or gated agent, one who hasn't accepted the current
 * agreements, and an impersonated owner get a 403 and a "denied" row there. Here, everyone else who
 * isn't the owning agent in person (the client's browser, Isaac on his own applications, which are
 * never masked) gets the same (the row for signed-in callers only, so a link can't fill the log).
 * Only from this site's own pages (exact JSON media type, `Sec-Fetch-Site`). `field` is a sensitive
 * scalar ("ssn") or "repeater.sub" with the row's index ("dependents.ssn", 1). The answer is never
 * cached.
 */

type RouteContext = { params: Promise<{ lob: string; token: string }> };

const NO_STORE = { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" };

const answer = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(request: NextRequest, context: RouteContext) {
  const { lob, token } = await context.params;
  try {
    // JSON only (the exact media type), from this site's pages: another site can't send that without
    // a preflight, and the browser says where a request came from.
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return answer({ success: false, error: "Expected JSON" }, 415);
    }
    if (!sameOriginFetch(request.headers.get("sec-fetch-site"))) {
      return answer({ success: false, error: "Forbidden", code: "forbidden" }, 403);
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
      return answer({ success: false, error: "Forbidden", code: "forbidden" }, 403);
    }

    const target = parseRevealTarget(config.sections, await request.json().catch(() => null));
    if (!target) return answer({ success: false, error: "Unknown field" }, 400);

    const stored = revealStoredValue(target, (row.data ?? {}) as Record<string, unknown>);
    const value = typeof stored === "string" ? (isEncrypted(stored) ? decryptString(stored) : stored) : "";

    const logged = await logSensitiveAccess({
      action: "reveal",
      actorUserId: userId,
      actorRole: "agent",
      ownerUserId: row.ownerUserId,
      sessionId: row.id,
      fields: [revealFieldName(target)],
    });
    if (!logged) {
      return NextResponse.json(
        { success: false, error: "Please try again in a moment.", code: "retry" },
        { status: 503, headers: { ...NO_STORE, "Retry-After": "5" } }
      );
    }
    return answer({ success: true, value });
  } catch (error) {
    console.error(`[intake/${lob}/:token/reveal] POST`, error);
    return answer({ success: false, error: "Failed to reveal" }, 500);
  }
}
