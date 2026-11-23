import { NextRequest, NextResponse } from "next/server";
import { getCaptureByToken, getIntakeSessionById } from "@/lib/intake-core/secure-capture";
import { lookupBankByRouting } from "@/lib/iul-intake/ach-directory";
import { ownerAcceptsClientData } from "@/lib/tenancy/context";

/**
 * GET …/bank-name?routing=021000021 — name the bank behind a routing number, so the client can
 * see they typed the right one. Gated by a live capture link (as in the IUL route) so it can't
 * become an open oracle for testing numbers. Reads nothing from the session. The link must be
 * usable on this deployment, by the same rule as the capture itself (`ownerAcceptsClientData`).
 */

type RouteContext = { params: Promise<{ captureToken: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;
    const capture = await getCaptureByToken(captureToken);
    if (!capture || capture.status !== "pending") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const session = await getIntakeSessionById(capture.lob, capture.sessionId);
    if (!session || session.status === "completed") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const flow = await ownerAcceptsClientData(capture.lob, session.ownerUserId);
    if (flow === "retry") {
      return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 503 });
    }
    if (flow === "closed") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const routing = new URL(request.url).searchParams.get("routing") ?? "";
    // `bank: null` is a normal answer: the directory's coverage is partial.
    return NextResponse.json({ success: true, bank: lookupBankByRouting(routing) });
  } catch (error) {
    console.error("[intake-capture/:captureToken/bank-name] GET", error);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }
}
