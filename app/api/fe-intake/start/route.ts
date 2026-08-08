import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureFeDeviceId } from "@/lib/fe-intake/device";
import { selfStartFeIntakeForClient } from "@/lib/fe-intake/server";
import { buildFeIntakeShareUrl } from "@/lib/fe-intake/share-url";

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
  const applyPath = locale === "es" ? "/es/gastos-finales/aplicar" : "/en/final-expense/apply";

  try {
    const deviceId = await ensureFeDeviceId();

    // Optional: a signed-in visitor gets their profile used for prefill. Never a requirement.
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

    const row = await selfStartFeIntakeForClient({
      clientDeviceId: deviceId,
      clientUserId: userId,
      email,
      firstName,
      lastName,
      phone,
      locale,
    });

    const origin = new URL(request.url).origin;
    return NextResponse.redirect(buildFeIntakeShareUrl(row.token, locale, origin), 307);
  } catch (error) {
    console.error("[fe-intake/start] failed to start application:", error);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(new URL(`${applyPath}?error=start`, origin), 307);
  }
}
