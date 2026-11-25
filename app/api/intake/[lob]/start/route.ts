import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { LOBS, isLobSlug } from "@/lib/lob/registry";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { ensureIntakeDeviceId } from "@/lib/intake-core/device";
import { selfStartIntakeForClient } from "@/lib/intake-core/server";
import { buildIntakeShareUrl } from "@/lib/intake-core/share-url";
import { selfStartPresetsFrom } from "@/lib/intake-core/self-start";

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
  const origin = new URL(request.url).origin;

  const config = resolveConfig(lob);
  // A line with no public "apply" has no self-start either, so nobody can create sessions or CRM
  // contacts through this URL.
  if (!config || config.selfStart === false) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  // A one-language line (Legal Shield: Spanish) starts in its language whatever the link says.
  const locale = config.fixedLocale ?? (searchParams.get("locale") === "es" ? "es" : "en");

  // Bounce back to the marketing page this came from if anything goes wrong.
  const applyPath = isLobSlug(lob)
    ? `/${locale}${LOBS[lob].applyPath[locale]}`
    : config.selfStartFallbackPath
      ? `/${locale}${config.selfStartFallbackPath[locale]}`
      : `/${locale}`;

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
      // Only the line's whitelisted answers (Legal Shield: the billing picked on its presentation).
      presets: selfStartPresetsFrom(config, searchParams),
    });

    return NextResponse.redirect(buildIntakeShareUrl(config, row.token, locale, origin), 307);
  } catch (error) {
    console.error(`[intake/${lob}/start] failed to start application:`, error);
    return NextResponse.redirect(new URL(`${applyPath}?error=start`, origin), 307);
  }
}
