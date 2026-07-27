import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  generateCredentialsImage,
  CredentialsShareError,
  type CredentialsShareErrorCode,
} from "@/lib/iul-credentials-share";

/**
 * Public, secret-guarded endpoint that generates a shareable agent-credentials
 * image for a given state and returns its URL. Built for a GoHighLevel workflow
 * ("Webhook" action) to call with a contact's state, then send the returned URL
 * via MMS / email / WhatsApp.
 *
 * This route is NOT under /api/admin, so Clerk middleware does not run — auth is
 * a shared secret (IUL_CREDENTIALS_SHARE_SECRET) sent as a Bearer token, an
 * `x-share-secret` header, or a `secret` query param.
 *
 * See IUL_CREDENTIALS_SHARE_SETUP.md for the GHL wiring.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const ERROR_STATUS: Record<CredentialsShareErrorCode, number> = {
  unknown_state: 404,
  missing_state_image: 404,
  missing_drivers_image: 404,
  render_failed: 500,
};

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.IUL_CREDENTIALS_SHARE_SECRET?.trim();
  if (!expected) return false; // misconfigured — treated as 500 by the caller

  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  const headerSecret = request.headers.get("x-share-secret")?.trim() ?? "";
  const querySecret = request.nextUrl.searchParams.get("secret")?.trim() ?? "";

  return (
    (bearer !== "" && safeEqual(bearer, expected)) ||
    (headerSecret !== "" && safeEqual(headerSecret, expected)) ||
    (querySecret !== "" && safeEqual(querySecret, expected))
  );
}

async function readParams(
  request: NextRequest
): Promise<{ state: string; locale?: string }> {
  const params = request.nextUrl.searchParams;
  let state = params.get("state") ?? params.get("contactState") ?? "";
  let locale = params.get("locale") ?? undefined;

  if (request.method === "POST") {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      state = String(body.state ?? body.contactState ?? state ?? "");
      const bodyLocale = body.locale;
      if (typeof bodyLocale === "string") locale = bodyLocale;
    } catch {
      // No/invalid JSON body — fall back to query params.
    }
  }

  return { state: state.trim(), locale: locale?.trim() };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  if (!process.env.IUL_CREDENTIALS_SHARE_SECRET?.trim()) {
    console.error("[iul/credentials-image] IUL_CREDENTIALS_SHARE_SECRET is not set");
    return NextResponse.json(
      { success: false, error: "Endpoint not configured" },
      { status: 500 }
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { state, locale } = await readParams(request);
  if (!state) {
    return NextResponse.json(
      { success: false, error: "Missing 'state' (2-letter code or full name)" },
      { status: 400 }
    );
  }

  try {
    const result = await generateCredentialsImage({
      stateInput: state,
      locale,
      requestOrigin: request.nextUrl.origin,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      state: result.state,
      locale: result.locale,
      expiresInHours: result.ttlHours,
      autoDelete: result.cleanupScheduled,
    });
  } catch (err) {
    if (err instanceof CredentialsShareError) {
      return NextResponse.json(
        { success: false, error: err.message, code: err.code },
        { status: ERROR_STATUS[err.code] }
      );
    }
    console.error("[iul/credentials-image] unexpected error", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate credentials image" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}

// GET convenience (e.g. browser/manual test): /api/iul/credentials-image?state=FL&secret=…
export async function GET(request: NextRequest): Promise<NextResponse> {
  return handle(request);
}
