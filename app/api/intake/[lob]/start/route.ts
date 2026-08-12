import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { LOBS, isLobSlug } from "@/lib/lob/registry";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { ensureIntakeDeviceId } from "@/lib/intake-core/device";
import { selfStartIntakeForClient } from "@/lib/intake-core/server";
import { buildIntakeShareUrl } from "@/lib/intake-core/share-url";

/**
 * Public "Apply now" handoff — no account required.
 *
 * A Route Handler rather than a page because this has to *set* the device cookie that claims the
 * new session, which Server Components can't do. Creates (or resumes) the caller's application
 * and redirects into the form.
 *
 * Clerk is consulted but never required: if the visitor happens to be signed in we reuse their
 * profile for prefill, otherwise the session is purely device-bound.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ lob: string }> }) {
  const { lob } = await context.params;
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "es" ? "es" : "en";
  const origin = new URL(request.url).origin;

  const config = resolveConfig(lob);
  if (!config) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  // Bounce back to the marketing page this came from if anything goes wrong.
  const applyPath = isLobSlug(lob) ? `/${locale}${LOBS[lob].applyPath[locale]}` : `/${locale}`;

  try {
    const deviceId = await ensureIntakeDeviceId(config);

    let userId: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    try {
      const session = await auth();
      userId = session.userId ?? null;
      if (userId) {
        const user = await currentUser();
        email =
          user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
        phone = user?.primaryPhoneNumber?.phoneNumber ?? user?.phoneNumbers?.[0]?.phoneNumber ?? null;
        firstName = user?.firstName ?? null;
        lastName = user?.lastName ?? null;
      }
    } catch {
      // Signed out is the normal case — carry on anonymously.
    }

    const row = await selfStartIntakeForClient(config, {
      clientDeviceId: deviceId,
      clientUserId: userId,
      email,
      firstName,
      lastName,
      phone,
      locale,
    });

    return NextResponse.redirect(buildIntakeShareUrl(config, row.token, locale, origin), 307);
  } catch (error) {
    console.error(`[intake/${lob}/start] failed to start application:`, error);
    return NextResponse.redirect(new URL(`${applyPath}?error=start`, origin), 307);
  }
}
