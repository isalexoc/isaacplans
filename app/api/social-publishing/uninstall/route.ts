import { NextRequest, NextResponse } from "next/server";

/**
 * Meta/Threads uninstall callback.
 * Called when a user deauthorizes the app from their Threads settings.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.formData().catch(() => null);
    void body; // parse signed_request here if you need to act on it
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process uninstall" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Uninstall callback endpoint is active." });
}
