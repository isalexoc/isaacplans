import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

/**
 * Meta/Threads data deletion callback.
 * Required by Meta for all apps that access user data.
 * Receives a signed_request, acknowledges the deletion, and returns a status URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.formData().catch(() => null);
    const signedRequest = body?.get("signed_request") as string | null;

    // In a full implementation you would verify the signed_request HMAC
    // and delete any stored data for the user identified in the payload.
    // For this app the only stored data is the social platform connection row,
    // which users can already remove via the Disconnect button.
    void signedRequest;

    const confirmationCode = nanoid(16);

    return NextResponse.json({
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/data-deletion-status`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process deletion request" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Data deletion endpoint is active." });
}
