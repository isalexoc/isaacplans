import { NextRequest, NextResponse } from "next/server";
import { readRequestEvidence } from "@/lib/aca-confirmation/evidence";
import { acaConfirmationSignSchema } from "@/lib/aca-confirmation/format";
import { NO_STORE } from "@/lib/aca-confirmation/route-helpers";
import { loadAcaConfirmationView, signAcaConfirmation } from "@/lib/aca-confirmation/server";
import type {
  AcaConfirmationInvalidResponse,
  AcaConfirmationPublicViewResponse,
  AcaConfirmationServerErrorResponse,
  AcaConfirmationSignInput,
  AcaConfirmationSignResponse,
} from "@/lib/aca-confirmation/types";

/**
 * The client's side of the confirmation link. Public: the token is the only credential.
 *
 * ─── What this route must never do ───
 *  - Call auth(), or mint any cookie. The /api/aca-confirmation prefix is deliberately outside the
 *    Clerk middleware matcher; the client is not a user of this site.
 *  - Return display text or anything about the contact beyond their own form. Unusable links get
 *    a code ("not_found" | "signed" | "cancelled" | "expired") that the page localizes.
 *  - Be cached anywhere: every response is `no-store`.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RouteContext = { params: Promise<{ token: string }> };

const serverError = () =>
  NextResponse.json({ success: false, code: "error" } satisfies AcaConfirmationServerErrorResponse, {
    status: 500,
    headers: NO_STORE,
  });

// GET — the form to sign. Called by the page's own fetch in the browser, which is what stamps
// "viewed": a link preview or mail scanner that runs no JavaScript never gets here.
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const result = await loadAcaConfirmationView(token, readRequestEvidence(request));
    if (!result.ok) return NextResponse.json(result.dead.body, { status: result.dead.status, headers: NO_STORE });
    const body: AcaConfirmationPublicViewResponse = { success: true, view: result.view };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/:token] GET", error);
    return serverError();
  }
}

// POST — the signature. Single use: succeeding closes the link.
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;
    const parsed = acaConfirmationSignSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const body: AcaConfirmationInvalidResponse = {
        success: false,
        code: "invalid",
        issue: parsed.error.issues[0]?.message ?? null,
      };
      return NextResponse.json(body, { status: 400, headers: NO_STORE });
    }

    const outcome = await signAcaConfirmation({
      token,
      input: parsed.data as AcaConfirmationSignInput,
      evidence: readRequestEvidence(request),
      requestOrigin: request.nextUrl.origin,
    });
    if (outcome.ok) {
      const body: AcaConfirmationSignResponse = { success: true, result: outcome.result };
      return NextResponse.json(body, { headers: NO_STORE });
    }
    if ("dead" in outcome) {
      return NextResponse.json(outcome.dead.body, { status: outcome.dead.status, headers: NO_STORE });
    }
    const body: AcaConfirmationInvalidResponse = { success: false, code: "invalid", issue: outcome.invalid };
    return NextResponse.json(body, { status: 400, headers: NO_STORE });
  } catch (error) {
    console.error("[aca-confirmation/:token] POST", error);
    return serverError();
  }
}
