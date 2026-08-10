import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureAcaDeviceId } from "@/lib/aca-intake/device";
import { selfStartAcaIntakeForClient } from "@/lib/aca-intake/server";
import { buildAcaIntakeShareUrl } from "@/lib/aca-intake/share-url";

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
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "es" ? "es" : "en";
  const applyPath = locale === "es" ? "/es/aca/aplicar" : "/en/aca/apply";

  try {
    const deviceId = await ensureAcaDeviceId();

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
        email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
        phone = user?.primaryPhoneNumber?.phoneNumber ?? user?.phoneNumbers?.[0]?.phoneNumber ?? null;
        firstName = user?.firstName ?? null;
        lastName = user?.lastName ?? null;
      }
    } catch {
      // Signed out is the normal case now — carry on anonymously.
    }

    const row = await selfStartAcaIntakeForClient({
      clientDeviceId: deviceId,
      clientUserId: userId,
      email,
      firstName,
      lastName,
      phone,
      locale,
    });

    const origin = new URL(request.url).origin;
    return NextResponse.redirect(buildAcaIntakeShareUrl(row.token, locale, origin), 307);
  } catch (error) {
    console.error("[aca-intake/start] failed to start application:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL(`${applyPath}?error=start`, origin), 307);
  }
}
