/**
 * The one save path behind the shared intake form's autosave. Two routes call it:
 *
 *  - `POST /api/intake/[lob]/[token]/patch` with `{ patch }`: today's form, which sends only the
 *    answers it changed;
 *  - `PATCH /api/intake/[lob]/[token]` with `{ data }`: tabs still running a bundle from before
 *    the patch endpoint, which send the whole form.
 *
 * Both MERGE. Only the keys in the body are written, in one statement (`patchIntakeData`), so a key
 * a save doesn't carry is never dropped and a stale tab can't erase what another tab typed. The
 * patch endpoint is a new path rather than a new PATCH body so a rollback can't turn new bundles'
 * saves into wipes: the old build answers it with a 404 and the form keeps those answers unsaved.
 *
 * Server-only.
 */

import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { sensitiveMasked, withoutPlatformKeys } from "@/lib/tenancy/agent-data";
import { alertAgentOnFirstClientSave } from "@/lib/tenancy/agent-jobs";
import {
  alreadySubmitted,
  isResponse,
  loadAuthorizedSession,
  notFound,
  type AuthorizedSession,
} from "./route-helpers";
import {
  clientCanEdit,
  patchIntakeData,
  syncIntakeToCrm,
  toIntakeSession,
  type IntakeSessionRow,
} from "./server";
import { sanitizeIntakeData } from "./schema";
import { decryptIntakeData, encryptIntakeData, maskSensitiveForClient } from "./sensitive";
import { planIntakePatch, withoutUnchanged } from "./patch";
import { captureFieldKeys } from "./secure-capture-groups";
import { CAPTURE_GRACE_MS, recentlyCapturedKeys } from "./secure-capture";
import type { IntakeData, IntakeLobConfig } from "./types";
import type { IntakeRole } from "@/lib/intake-shared/access";

/**
 * Grace window after a client sends numbers through a secure link.
 *
 * Once the agent's next poll lands, their form holds masks and `planIntakePatch` turns those saves
 * into no-ops. The exposure is the few seconds before: a value the agent was half-way through
 * typing is neither a mask nor empty, so it would quietly replace the client's. For a short window
 * the stored values win: the key is taken out of the patch. The lookup only runs when this save
 * would actually change a value a link can capture, so ordinary autosaves cost nothing extra; and a
 * failure (the table not migrated yet, say) just skips the window rather than failing the save.
 */
async function keepFreshCapture(
  config: IntakeLobConfig,
  sessionId: string,
  patch: IntakeData,
  stored: IntakeData
): Promise<void> {
  const changing = captureFieldKeys(config).filter((key) => {
    if (!(key in patch)) return false;
    const previous = stored[key];
    return typeof previous === "string" && previous !== "" && patch[key] !== previous;
  });
  if (!changing.length) return;
  try {
    const fresh = new Set(await recentlyCapturedKeys(sessionId, CAPTURE_GRACE_MS));
    for (const key of changing) if (fresh.has(key)) delete patch[key];
  } catch (error) {
    console.warn("[intake] secure-capture grace check skipped:", error);
  }
}

/**
 * The answers as this caller may see them (lib/tenancy/agent-data.ts `sensitiveMasked`): Isaac's
 * owner view gets the real values, as always; the client's browser gets masks, and so does an agent
 * working their own client's application, who reveals one value at a time (`POST …/reveal`,
 * audited). The client's browser never gets the platform's own keys either.
 */
export function sessionDataForCaller(
  config: IntakeLobConfig,
  caller: { role: IntakeRole; ownerIsAgent: boolean },
  decrypted: IntakeData
): IntakeData {
  const shown = caller.role === "client" ? withoutPlatformKeys(decrypted) : decrypted;
  return sensitiveMasked(caller) ? maskSensitiveForClient(config, shown) : shown;
}

/** The session as the caller may see it (see `sessionDataForCaller`). */
function sessionResponse(
  config: IntakeLobConfig,
  loaded: Pick<AuthorizedSession, "access" | "ownerAgent">,
  row: IntakeSessionRow,
  decrypted: IntakeData
): NextResponse {
  const role = loaded.access.role;
  const data = sessionDataForCaller(config, { role, ownerIsAgent: loaded.ownerAgent !== null }, decrypted);
  return NextResponse.json({ success: true, session: toIntakeSession(row, role, data) });
}

/**
 * Authorize (claiming an unclaimed link, like every write), read `body[field]`, merge it, push the
 * result to the CRM, and answer with the session. Throws on unexpected errors; the route logs them.
 */
export async function saveIntakeAnswers(
  request: NextRequest,
  lob: string,
  token: string,
  field: "patch" | "data"
): Promise<NextResponse> {
  // JSON only, checked before anything else. Another site can send a POST without a preflight
  // only as a form or plain text, so this keeps such a request out even if a browser ever sent the
  // cookies with it. The form (and the bundle before it) always sends application/json.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ success: false, error: "Expected JSON" }, { status: 415 });
  }

  const loaded = await loadAuthorizedSession(lob, token, { claim: true });
  if (isResponse(loaded)) return loaded;
  const { config, row, access } = loaded;

  // A client cannot edit a submitted form unless the admin re-opened it (admin always can).
  if (access.role === "client" && !clientCanEdit(row)) return alreadySubmitted();

  const body = await request.json().catch(() => ({}));
  // The platform's own keys (alerts sent, "entered in Impact", erased) are the server's to write.
  const incoming = withoutPlatformKeys(sanitizeIntakeData(config.sections, body?.[field]));
  const stored = decryptIntakeData(config, (row.data ?? {}) as IntakeData);
  // Values equal to what is stored change nothing (a mask the planner turned back into the number on
  // file, the untouched answers of a legacy whole-form save), so they are left out.
  const patch = withoutUnchanged(planIntakePatch(config.sections, incoming, stored), stored);
  if (access.role === "owner") await keepFreshCapture(config, row.id, patch, stored);

  // Nothing to write: answer with the session as stored, with no write and no CRM push.
  if (Object.keys(patch).length === 0) return sessionResponse(config, loaded, row, stored);

  const updated = await patchIntakeData(token, encryptIntakeData(config, patch));
  if (!updated) return notFound();

  const decrypted = decryptIntakeData(config, (updated.data ?? {}) as IntakeData);
  // Progressive CRM sync of the whole merged record (best-effort — never blocks the save).
  await syncIntakeToCrm(config, updated, decrypted);
  // An agent's application: the client's first save that identifies them tells the agent, once.
  if (loaded.ownerAgent) await alertAgentOnFirstClientSave(updated, access.role, decrypted);
  return sessionResponse(config, loaded, updated, decrypted);
}
