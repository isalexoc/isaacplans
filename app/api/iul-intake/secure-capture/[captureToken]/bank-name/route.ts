import { NextRequest, NextResponse } from "next/server";
import { lookupBankByRouting } from "@/lib/iul-intake/ach-directory";
import { getCaptureByToken, getIntakeById } from "@/lib/iul-intake/secure-capture";

/**
 * GET …/bank-name?routing=021000021 — name the bank behind a routing number, for the client page.
 *
 * Gated by the capture token rather than left open. The lookup itself is harmless — a routing
 * number is public, the response says nothing about a person, and since the directory moved
 * in-process there is no third-party allowance left to burn. The gate stays anyway: an open
 * endpoint that echoes a bank name is a free oracle for testing stolen numbers against, and
 * requiring a live capture link keeps it to people actually filling a form.
 *
 * Reads nothing from the session and returns nothing about it: this endpoint only ever answers
 * "which bank is this number", never "what do you have on file".
 */

type RouteContext = { params: Promise<{ captureToken: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { captureToken } = await context.params;

    const capture = await getCaptureByToken(captureToken);
    if (!capture || capture.status !== "pending") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }
    const session = await getIntakeById(capture.sessionId);
    if (!session || session.status === "completed") {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const routing = new URL(request.url).searchParams.get("routing") ?? "";
    const bank = lookupBankByRouting(routing);

    // `bank: null` is a normal answer, not an error — the directory's coverage is partial and a
    // real number can legitimately be missing from it.
    return NextResponse.json({ success: true, bank });
  } catch (error) {
    console.error("[iul-intake/secure-capture/:captureToken/bank-name] GET", error);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }
}
