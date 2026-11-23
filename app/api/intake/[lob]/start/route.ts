import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { LOBS, isLobSlug } from "@/lib/lob/registry";
import { resolveConfig } from "@/lib/intake-core/route-helpers";
import { ensureIntakeDeviceId } from "@/lib/intake-core/device";
import { selfStartIntakeForClient } from "@/lib/intake-core/server";
import { buildIntakeShareUrl } from "@/lib/intake-core/share-url";
import { getAgentBySlug } from "@/lib/tenancy/agents";
import { isListedPlatformOwner } from "@/lib/tenancy/crm";
import { agentTakesApplications, isAgentLob, readTenancyGates } from "@/lib/tenancy/gates";
import { normalizeAgentSlug, SLUG_PATTERN } from "@/lib/tenancy/slug-format";
import { isProductSurface } from "@/lib/tenancy/surface";

/**
 * Public "Apply now" handoff — no account required.
 *
 * A Route Handler rather than a page because this has to *set* the device cookie that claims the
 * new session, which Server Components can't do. Creates (or resumes) the caller's application
 * and redirects into the form.
 *
 * Clerk is consulted but never required: if the visitor happens to be signed in we reuse their
 * profile for prefill, otherwise the session is purely device-bound.
 *
 * Agents' "Apply" (`?agent=<slug>`) exists only on the product surface (`APP_SURFACE=product`):
 * there the slug must name an agent who takes applications right now (active, and a test agent
 * while the launch gates are off), that agent owns the new application, and anything else is a
 * 404 that never falls back to Isaac. Agents work the Health Coverage line only. On isaacplans.com
 * the parameter is refused with a 400, so an application can't be claimed on the wrong host.
 */

const notFound = () => NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

type AgentOwner = { ownerUserId: string; slug: string };

/** The agent behind `?agent=`, or why not: "none" (404) or "error" (the lookup failed). */
async function agentOwner(lob: string, param: string | null): Promise<AgentOwner | "none" | "error"> {
  if (!isAgentLob(lob)) return "none";
  const slug = normalizeAgentSlug(param);
  if (!SLUG_PATTERN.test(slug)) return "none";
  try {
    const agent = await getAgentBySlug(slug);
    if (!agent?.clerkUserId || !agentTakesApplications(agent, readTenancyGates())) return "none";
    // A row linked to one of Isaac's own ids is a misconfiguration: never start his applications
    // here (everything else treats a listed id as his, never as an agent).
    if (isListedPlatformOwner(agent.clerkUserId)) return "none";
    return { ownerUserId: agent.clerkUserId, slug };
  } catch (error) {
    console.error(`[intake/${lob}/start] agent lookup failed:`, error);
    return "error";
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ lob: string }> }) {
  const { lob } = await context.params;
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "es" ? "es" : "en";
  const origin = new URL(request.url).origin;

  const config = resolveConfig(lob);
  if (!config) return notFound();

  const product = isProductSurface();
  const agentParam = searchParams.get("agent");
  if (!product && agentParam !== null) {
    return NextResponse.json({ success: false, error: "Bad request" }, { status: 400 });
  }

  let agent: AgentOwner | null = null;
  if (product) {
    const found = await agentOwner(config.lob, agentParam);
    if (found === "none") return notFound();
    if (found === "error") {
      const slug = normalizeAgentSlug(agentParam);
      return NextResponse.redirect(new URL(`/${locale}/${slug}?error=start`, origin), 307);
    }
    agent = found;
  }

  // Bounce back to the page this came from if anything goes wrong.
  const applyPath = agent
    ? `/${locale}/${agent.slug}`
    : isLobSlug(lob)
      ? `/${locale}${LOBS[lob].applyPath[locale]}`
      : `/${locale}`;

  try {
    const deviceId = await ensureIntakeDeviceId(config);

    let userId: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;
    // The product surface has no sign-in: its visitors are always anonymous.
    if (!product) {
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
    }

    const row = await selfStartIntakeForClient(config, {
      clientDeviceId: deviceId,
      clientUserId: userId,
      email,
      firstName,
      lastName,
      phone,
      locale,
      ownerUserId: agent?.ownerUserId ?? null,
    });

    return NextResponse.redirect(buildIntakeShareUrl(config, row.token, locale, origin), 307);
  } catch (error) {
    console.error(`[intake/${lob}/start] failed to start application:`, error);
    return NextResponse.redirect(new URL(`${applyPath}?error=start`, origin), 307);
  }
}
