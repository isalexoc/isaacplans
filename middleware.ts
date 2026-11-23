// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, clerkClient, createRouteMatcher, type ClerkMiddlewareAuth } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { isPrivatePagePath } from "./lib/private-pages";
import {
  AGENT_AREA_PATH_RE,
  isAgentInvitationLanding,
  shellHeadersForPath,
} from "./lib/tenancy/agent-area-routes";
import { isPlatformAdminMetadata } from "./lib/tenancy/agent-linking";
import {
  PRODUCT_RESPONSE_HEADERS,
  productNotFoundHtml,
  productRoute,
  type ProductLocale,
} from "./lib/tenancy/product-routes";
import { appSurface } from "./lib/tenancy/surface";

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/presentations(.*)',
  '/en/presentations(.*)',
  '/es/presentations(.*)',
  '/admin(.*)',
  '/en/admin(.*)',
  '/es/admin(.*)',
  // IUL intake: the AGENT surfaces only. The client form at /iul/intake/<token> authenticates with
  // the unguessable token plus a device cookie instead of an account. Matching the dashboard
  // exactly (no trailing wildcard) is what leaves the token path open.
  '/iul/intake',
  '/iul/admision',
  '/en/iul/intake',
  '/es/iul/admision',
  '/iul/intake/:token/view',
  '/iul/admision/:token/view',
  '/en/iul/intake/:token/view',
  '/es/iul/admision/:token/view',
  // ACA intake: the AGENT surfaces only. The client form at /aca/intake/<token> authenticates
  // with the unguessable token plus a device cookie instead of an account, so a prospect never
  // hits a sign-in wall. Matching the dashboard exactly (no trailing wildcard) is what leaves the
  // token path open; the read-only summary stays protected.
  '/aca/intake',
  '/aca/admision',
  '/en/aca/intake',
  '/es/aca/admision',
  '/aca/intake/:token/view',
  '/aca/admision/:token/view',
  '/en/aca/intake/:token/view',
  '/es/aca/admision/:token/view',
  // Final Expense intake: the AGENT surfaces only. The client form at
  // /final-expense/intake/<token> is deliberately public — it authenticates with the unguessable
  // token plus a device cookie instead of an account, so a prospect never hits a sign-in wall.
  // Matching the dashboard exactly (no trailing wildcard) is what leaves the token path open.
  '/final-expense/intake',
  '/gastos-finales/admision',
  '/en/final-expense/intake',
  '/es/gastos-finales/admision',
  // The read-only summary is agent-facing and stays protected.
  '/final-expense/intake/:token/view',
  '/gastos-finales/admision/:token/view',
  '/en/final-expense/intake/:token/view',
  '/es/gastos-finales/admision/:token/view',
  // Lines of business on the shared intake engine (lib/intake-core). Same rule as the three
  // above: the AGENT dashboard and read-only summary are matched exactly, which is precisely what
  // leaves each client form at /<lob>/intake/<token> public for its token + device cookie.
  '/short-term-medical/intake',
  '/cobertura-a-corto-plazo/admision',
  '/en/short-term-medical/intake',
  '/es/cobertura-a-corto-plazo/admision',
  '/short-term-medical/intake/:token/view',
  '/cobertura-a-corto-plazo/admision/:token/view',
  '/en/short-term-medical/intake/:token/view',
  '/es/cobertura-a-corto-plazo/admision/:token/view',
  '/dental-vision/intake',
  '/dental-vision/admision',
  '/en/dental-vision/intake',
  '/es/dental-vision/admision',
  '/dental-vision/intake/:token/view',
  '/dental-vision/admision/:token/view',
  '/en/dental-vision/intake/:token/view',
  '/es/dental-vision/admision/:token/view',
  '/hospital-indemnity/intake',
  '/indemnizacion-hospitalaria/admision',
  '/en/hospital-indemnity/intake',
  '/es/indemnizacion-hospitalaria/admision',
  '/hospital-indemnity/intake/:token/view',
  '/indemnizacion-hospitalaria/admision/:token/view',
  '/en/hospital-indemnity/intake/:token/view',
  '/es/indemnizacion-hospitalaria/admision/:token/view',
  '/life-insurance/intake',
  '/seguro-de-vida/admision',
  '/en/life-insurance/intake',
  '/es/seguro-de-vida/admision',
  '/life-insurance/intake/:token/view',
  '/seguro-de-vida/admision/:token/view',
  '/en/life-insurance/intake/:token/view',
  '/es/seguro-de-vida/admision/:token/view',
  '/health-alternative/intake',
  '/alternativa-de-salud/admision',
  '/en/health-alternative/intake',
  '/es/alternativa-de-salud/admision',
  '/health-alternative/intake/:token/view',
  '/alternativa-de-salud/admision/:token/view',
  '/en/health-alternative/intake/:token/view',
  '/es/alternativa-de-salud/admision/:token/view',
  // The agent platform's agent area: /agent (es /agente) and every page under it, in any spelling
  // that reaches here. One expression (lib/tenancy/agent-area-routes.ts, tested offline) so that
  // Isaac's public /agent-crm page is never caught by a loose "/agent(.*)" pattern. Its one
  // signed-out request, a Clerk invitation landing with its ticket, is let through below.
  AGENT_AREA_PATH_RE,
]);
// NOTE: /partner and /socio are deliberately NOT protected. The page is the partner portal: it
// renders a public marketing landing with a sign-in button when signed out, and the dashboard
// once signed in — the same shape as the sale-sticker and leave-behind agent tools. Gating it in
// middleware would bounce a partner who just wants to find the sign-in button, and there is no
// /sign-in route in this app to bounce them to. Authorization still happens in the page: the
// signed-in email must match a partner record, or they get the "not linked" screen.

// Admin-only surfaces: the /admin dashboard + tools, Sanity Studio, and every
// /api/admin route. (Agent tools like sale-sticker/leave-behind stay open to
// any signed-in user; IUL intake keeps its own token-scoped auth.)
const isAdminPageRoute = createRouteMatcher([
  '/admin(.*)',
  '/en/admin(.*)',
  '/es/admin(.*)',
]);

// Role lives in Clerk publicMetadata (same convention as /presentations), which is
// not in the session token — fetch the user, with a short in-memory cache so admin
// page navs and API bursts don't re-hit Clerk's API on every request. An account that
// carries the agent platform's marker is never an admin, whatever its role says
// (lib/tenancy/agent-linking.ts `isPlatformAdminMetadata`; agents are never admins).
const ADMIN_CACHE_TTL_MS = 60_000;
const adminCache = new Map<string, { isAdmin: boolean; expires: number }>();

async function userIsAdmin(userId: string): Promise<boolean> {
  const cached = adminCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.isAdmin;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAdmin = isPlatformAdminMetadata(user.publicMetadata);
  adminCache.set(userId, { isAdmin, expires: Date.now() + ADMIN_CACHE_TTL_MS });
  return isAdmin;
}

/**
 * isaacplans.com (APP_SURFACE unset): Clerk, next-intl, the admin gates and the page flags below,
 * exactly as before the agent platform.
 */
async function mainMiddleware(auth: ClerkMiddlewareAuth, req: NextRequest) {
  // Legacy blog category slug → renamed category
  const legacyCategory = req.nextUrl.pathname.match(
    /^\/(en|es)\/blog\/category\/short-term-medical\/?$/
  );
  if (legacyCategory) {
    const url = req.nextUrl.clone();
    url.pathname = `/${legacyCategory[1]}/blog/category/temporary-health-insurance`;
    return NextResponse.redirect(url, 308);
  }

  // Removed Allstate seniors/individual product pages → carrier hub
  const removedAllstateProduct = req.nextUrl.pathname.match(
    /^\/(en|es)\/carriers\/allstate\/(?:seniors|individual)(?:\/.*)?$/
  );
  if (removedAllstateProduct) {
    const url = req.nextUrl.clone();
    url.pathname = `/${removedAllstateProduct[1]}/carriers/allstate`;
    return NextResponse.redirect(url, 308);
  }

  // /api/admin/*: admin role required (401 signed-out, 403 non-admin)
  if (req.nextUrl.pathname.startsWith('/api/admin')) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await userIsAdmin(userId))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    return;
  }

  // API routes: Clerk context only — do not run next-intl (would return HTML)
  if (
    req.nextUrl.pathname.startsWith('/api/blog') ||
    req.nextUrl.pathname.startsWith('/api/leave-behind') ||
    req.nextUrl.pathname.startsWith('/api/sale-sticker') ||
    req.nextUrl.pathname.startsWith('/api/iul-intake') ||
    req.nextUrl.pathname.startsWith('/api/aca-intake') ||
    req.nextUrl.pathname.startsWith('/api/fe-intake') ||
    req.nextUrl.pathname.startsWith('/api/intake') ||
    req.nextUrl.pathname.startsWith('/api/crankwheel') ||
    req.nextUrl.pathname.startsWith('/api/newsletter') ||
    // The agent area's own API (profile, agreements): each route checks the signed-in agent.
    req.nextUrl.pathname === '/api/agent' ||
    req.nextUrl.pathname.startsWith('/api/agent/')
  ) {
    return;
  }

  // Sanity Studio: admin role required (no next-intl — Studio lives outside locales)
  if (req.nextUrl.pathname.startsWith('/studio')) {
    await auth.protect();
    const { userId } = await auth();
    if (!userId || !(await userIsAdmin(userId))) {
      return NextResponse.redirect(new URL('/en/unauthorized', req.url));
    }
    return NextResponse.next();
  }

  // Protected agent tools — requires authentication. The exception: a Clerk invitation to the agent
  // platform lands on the agent dashboard with its ticket before the invited person has an account;
  // that page then shows only Clerk's sign-up for the ticket (app/[locale]/agent/page.tsx).
  if (isProtectedRoute(req) && !isAgentInvitationLanding(req.nextUrl.pathname, req.nextUrl.searchParams)) {
    await auth.protect();
  }

  // /admin dashboard + tools: admin role required
  if (isAdminPageRoute(req)) {
    const { userId } = await auth();
    if (!userId || !(await userIsAdmin(userId))) {
      const locale = req.nextUrl.pathname.startsWith('/es') ? 'es' : 'en';
      return NextResponse.redirect(new URL(`/${locale}/unauthorized`, req.url));
    }
  }
  
  // All other routes are public for now - no auth.protect() call
  // Just pass through to next-intl middleware for locale handling
  const response = intlMiddleware(req);
  const pathname = req.nextUrl.pathname;
  // The ACA intake CLIENT form only — the token segment rules out the agent dashboard
  // (/aca/intake) and the summary view (/aca/intake/<token>/view), which keep full chrome.
  const isAcaIntakeForm = /^(?:\/(?:en|es))?\/aca\/(?:intake|admision)\/[^/]+$/i.test(pathname);
  // Same rule for the Final Expense intake CLIENT form — its one-question-per-screen wizard
  // has its own header/progress bar and expects a bare page, not the full site chrome.
  const isFeIntakeForm =
    /^(?:\/(?:en|es))?\/(?:final-expense\/intake|gastos-finales\/admision)\/[^/]+$/i.test(
      pathname
    );

  // The IUL secure-capture page asks a client for their Social Security number on their phone.
  // The full marketing footer — newsletter signup, service links — sitting under that request
  // reads badly and buries the one button that matters, so it renders bare like the intake forms.
  const isIulSecureCapture =
    /^(?:\/(?:en|es))?\/iul\/(?:secure|seguro)\/[^/]+$/i.test(pathname);

  // The ACA application-review signing page (the CMS e-signature link a client opens from email).
  // Bare chrome like the secure-capture page, and private: it shows the client's name and email
  // and its URL is a live credential, so x-private-page keeps Meta Pixel, GA and the CRM
  // chat/tracking scripts off it (they would report the tokenized URL to third parties).
  const isAcaConfirmation =
    /^(?:\/(?:en|es))?\/aca\/(?:confirmation|confirmacion)\/[^/]+$/i.test(pathname);

  // The Impact sales presentation. Agent-only, but its tab is on the client's phone through
  // CrankWheel: an ads landing for the slim header and no chat bubble (private via the rule below).
  const isImpactPresentation =
    /^(?:\/(?:en|es))?\/(?:health-alternative\/intake|alternativa-de-salud\/admision)\/[^/]+\/(?:presentation|presentacion)$/i.test(
      pathname
    );

  // A client's secure link for the shared intake engine (/secure/<token>, es /seguro/<token>):
  // bare like the ACA signing page (private via the rule below).
  const isIntakeSecureCapture = /^(?:\/(?:en|es))?\/(?:secure|seguro)\/[^/]+$/i.test(pathname);

  // The self-serve Impact presentation: public (Pixel and GA stay), but no CRM chat bubble, which
  // would sit on its Next button, and the slim header.
  const isImpactGuide = /^(?:\/(?:en|es))?\/(?:impact|impacto)\/?$/i.test(pathname);

  // Every page with a client's data on it — every line's intake (dashboard, form, summary, the
  // Impact deck), secure and document links, the ACA signing page, /admin. See lib/private-pages.ts.
  // x-private-page keeps Meta Pixel, GA and the CRM's chat, tracking and form capture off it (they
  // would report the tokenized URL, and the CRM script captures forms). Only this site may frame
  // it (clickjacking), and it is never indexed.
  if (isPrivatePagePath(pathname)) {
    response.headers.set("x-private-page", "1");
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  // The LegalShield funnel — both the opt-in and the self-enrollment page. These are the only
  // routes on the site that must NOT show the Isaac Plans logo: LegalShield's advertising rules
  // for Independent Associates require the page not read as an official LegalShield property, and
  // showing an insurance agency's mark over a legal-plan offer confuses both brands at once.
  const isLegalShield = /^(?:\/(?:en|es))?\/legal-shield\//i.test(pathname);
  if (
    pathname.includes("/get-health-coverage-fast") ||
    pathname.includes("/cobertura-salud-rapida") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura") ||
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura") ||
    pathname.includes("/iul/guia") ||
    pathname.includes("/aca/get-covered") ||
    pathname.includes("/aca/obtener-cobertura") ||
    pathname.includes("/life-insurance/get-covered") ||
    pathname.includes("/seguro-de-vida/obtener-cobertura") ||
    pathname.includes("/health-alternative/get-covered") ||
    pathname.includes("/alternativa-de-salud/obtener-cobertura") ||
    isAcaIntakeForm ||
    isFeIntakeForm ||
    isIulSecureCapture ||
    isAcaConfirmation ||
    isImpactPresentation ||
    isIntakeSecureCapture ||
    isImpactGuide ||
    isLegalShield
  ) {
    response.headers.set("x-is-ads-landing", "1");
  }
  // LegalShield gets its own variant rather than joining "iul-bare": the footer has to swap the
  // Isaac Plans logo for the LegalShield lockup and carry the Independent Associate / not-insurance
  // disclosure. Checked before the iul-bare block so it wins.
  if (isLegalShield) {
    response.headers.set("x-ads-landing-variant", "legal-shield-bare");
  }
  // "Bare" funnels (IUL + final expense + ACA get-covered, ACA/FE intake forms) get an even
  // barer footer (logo + copyright only, no links) and a logo-only + phone header.
  if (
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura") ||
    pathname.includes("/iul/guia") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura") ||
    pathname.includes("/aca/get-covered") ||
    pathname.includes("/aca/obtener-cobertura") ||
    pathname.includes("/life-insurance/get-covered") ||
    pathname.includes("/seguro-de-vida/obtener-cobertura") ||
    pathname.includes("/health-alternative/get-covered") ||
    pathname.includes("/alternativa-de-salud/obtener-cobertura") ||
    isAcaIntakeForm ||
    isFeIntakeForm ||
    isIulSecureCapture ||
    isAcaConfirmation ||
    isIntakeSecureCapture
  ) {
    response.headers.set("x-ads-landing-variant", "iul-bare");
  }

  // The page frame: the agent area's own ("agent", "agent-present" for the deck a client watches)
  // or Isaac's ("site"). Set on EVERY page response, so the value a browser sends under the same
  // name is always overwritten (Next.js copies these onto the request the layout reads).
  for (const [key, value] of Object.entries(shellHeadersForPath(pathname))) {
    response.headers.set(key, value);
  }
  return response;
}

/** Every product-domain answer is private, unindexed, unframeable and sends no Referer. */
function withProductHeaders<T extends NextResponse>(response: T): T {
  for (const [key, value] of Object.entries(PRODUCT_RESPONSE_HEADERS)) response.headers.set(key, value);
  return response;
}

function productNotFound(api: boolean, locale: ProductLocale | null): NextResponse {
  const response = api
    ? NextResponse.json({ success: false, error: "Not found" }, { status: 404 })
    : new NextResponse(productNotFoundHtml(locale), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
  return withProductHeaders(response);
}

/**
 * The product domain (APP_SURFACE=product): agents' client pages only, and no Clerk at all — no
 * clerkMiddleware, no auth() — so nothing here can reach Isaac's sign-in or his session cookies.
 * The address book is lib/tenancy/product-routes.ts: anything it doesn't serve is a 404 straight
 * away (next-intl never sees it: its redirects would spell out Isaac's page names); next-intl runs
 * for the rest (locale prefix and its redirects), then an agent's /{l}/{slug}[/apply|/privacy] is
 * rewritten to /{l}/a/{slug}… (next-intl's documented rewrite-after-routing pattern), the client's
 * token pages pass through, and the application's own API calls go straight through.
 */
function productMiddleware(req: NextRequest): NextResponse {
  const route = productRoute(req.nextUrl.pathname);
  if (route.kind === "api") return withProductHeaders(NextResponse.next());
  if (route.kind === "not_found") return productNotFound(route.api, route.locale);

  const response = intlMiddleware(req);
  // next-intl's own redirects (a missing or miscased locale prefix, a token page in the other
  // language's words, e.g. /es/secure/… → /es/seguro/…) stand as they are; their target comes
  // back here.
  if (!response.ok) return withProductHeaders(response);
  if (route.kind === "rewrite") {
    const target = new URL(`${route.to}${req.nextUrl.search}`, req.url);
    return withProductHeaders(NextResponse.rewrite(target, { headers: response.headers }));
  }
  if (route.kind === "pass") return withProductHeaders(response);
  // "intl": next-intl was expected to redirect it to a page that exists.
  return productNotFound(false, null);
}

// Chosen once, from the deployment's env: the product project never even creates Clerk's
// middleware. (APP_SURFACE is server config, set per Vercel project.)
export default appSurface() === "product" ? productMiddleware : clerkMiddleware(mainMiddleware);

export const config = {
  // Match all pathnames except for
  // - … if they start with `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`); on the product domain, next.config.mjs
  //   answers those with a 404 unless they are files its pages use
  // Include /api/blog routes for Clerk auth (but exclude other /api routes)
  // /studio documents are matched so the Studio can be admin-gated.
  matcher: [
    "/api/blog/:path*",
    "/api/leave-behind/:path*",
    "/api/sale-sticker/:path*",
    "/api/iul-intake/:path*",
    "/api/aca-intake/:path*",
    "/api/fe-intake/:path*",
    "/api/intake/:path*",
    // Only the admin-facing meeting routes need Clerk context. The CrankWheel callback at
    // /api/crankwheel/hook/* is deliberately left out: it is an unauthenticated GET from
    // CrankWheel's servers, and its unguessable path secret is what authorizes it.
    "/api/crankwheel/meetings/:path*",
    "/api/admin/:path*",
    "/api/newsletter/:path*",
    // The agent area's API (Clerk context for the signed-in agent).
    "/api/agent/:path*",
    "/studio/:path*",
    "/studio",
    "/((?!api|trpc|_next|_vercel|studio|.*\\..*).*)"
  ],
};