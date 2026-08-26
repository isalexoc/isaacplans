import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getIsAdmin } from "@/lib/auth/admin";
import { getIntakeByToken } from "@/lib/iul-intake/server";
import { buildDocumentCaptureUrl } from "@/lib/iul-intake/share-url";
import {
  createDocumentCapture,
  cancelPendingDocumentCaptures,
  getLatestDocumentCapture,
  toDocumentCaptureView,
} from "@/lib/iul-intake/document-capture";

/**
 * The agent's side of the document-upload link: create one, poll it, revoke it.
 *
 * All three are admin-only AND owner-scoped. Nothing here is reachable from the client's phone —
 * the client talks to `/api/iul-intake/document-capture/[captureToken]`, a different tree with a
 * different credential.
 *
 * The poll returns counters, never file contents or URLs. The agent's Documents step already
 * lists the files themselves, because an upload writes into the session's `attachmentOther` like
 * any other document; this route only answers "has anything arrived yet".
 */

type RouteContext = { params: Promise<{ token: string }> };

/** Clerk admin + owns this session. Returns the row, or a response to send back. */
async function requireOwner(token: string) {
  const { userId } = await auth();
  if (!userId) {
    return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await getIsAdmin())) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  const row = await getIntakeByToken(token);
  if (!row) {
    return { error: NextResponse.json({ success: false, error: "Not found" }, { status: 404 }) };
  }
  if (row.ownerUserId !== userId) {
    return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  }
  return { row };
}

/** POST — issue a link. Cancels any previous live one so only one is ever outstanding. */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;
    const row = guard.row!;

    if (row.status === "completed") {
      return NextResponse.json(
        { success: false, error: "This application is already submitted." },
        { status: 400 }
      );
    }

    const capture = await createDocumentCapture({
      sessionId: row.id,
      ownerUserId: row.ownerUserId,
    });

    return NextResponse.json({
      success: true,
      capture: toDocumentCaptureView(capture),
      url: buildDocumentCaptureUrl(capture.token, row.locale ?? "en"),
    });
  } catch (error) {
    console.error("[iul-intake/:token/document-capture] POST", error);
    return NextResponse.json({ success: false, error: "Failed to create link" }, { status: 500 });
  }
}

/** GET — the agent's poll: link status and how many documents have arrived. */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;
    const row = guard.row!;

    const capture = await getLatestDocumentCapture(row.id);

    return NextResponse.json({
      success: true,
      capture: capture ? toDocumentCaptureView(capture) : null,
      url: capture ? buildDocumentCaptureUrl(capture.token, row.locale ?? "en") : null,
    });
  } catch (error) {
    console.error("[iul-intake/:token/document-capture] GET", error);
    return NextResponse.json({ success: false, error: "Failed to load" }, { status: 500 });
  }
}

/**
 * DELETE — revoke. The link stops accepting uploads immediately.
 *
 * This is the only way a document link ends before the application completes, which is the price
 * of it staying open for repeat visits. Documents already received are untouched: they live in
 * the session and on the CRM contact, not in the link.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const guard = await requireOwner(token);
    if (guard.error) return guard.error;

    const cancelled = await cancelPendingDocumentCaptures(guard.row!.id);
    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    console.error("[iul-intake/:token/document-capture] DELETE", error);
    return NextResponse.json({ success: false, error: "Failed to revoke" }, { status: 500 });
  }
}
