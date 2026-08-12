// middleware.ts
import { NextResponse } from "next/server";
import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

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
// page navs and API bursts don't re-hit Clerk's API on every request.
const ADMIN_CACHE_TTL_MS = 60_000;
const adminCache = new Map<string, { isAdmin: boolean; expires: number }>();

async function userIsAdmin(userId: string): Promise<boolean> {
  const cached = adminCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.isAdmin;
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const isAdmin = user.publicMetadata?.role === "admin";
  adminCache.set(userId, { isAdmin, expires: Date.now() + ADMIN_CACHE_TTL_MS });
  return isAdmin;
}

export default clerkMiddleware(async (auth, req) => {
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
    req.nextUrl.pathname.startsWith('/api/newsletter')
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

  // Protected agent tools — requires authentication
  if (isProtectedRoute(req)) {
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
  if (
    pathname.includes("/get-health-coverage-fast") ||
    pathname.includes("/cobertura-salud-rapida") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura") ||
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura") ||
    pathname.includes("/aca/get-covered") ||
    pathname.includes("/aca/obtener-cobertura") ||
    pathname.includes("/life-insurance/get-covered") ||
    pathname.includes("/seguro-de-vida/obtener-cobertura") ||
    pathname.includes("/health-alternative/get-covered") ||
    pathname.includes("/alternativa-de-salud/obtener-cobertura") ||
    isAcaIntakeForm ||
    isFeIntakeForm
  ) {
    response.headers.set("x-is-ads-landing", "1");
  }
  // "Bare" funnels (IUL + final expense + ACA get-covered, ACA/FE intake forms) get an even
  // barer footer (logo + copyright only, no links) and a logo-only + phone header.
  if (
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura") ||
    pathname.includes("/aca/get-covered") ||
    pathname.includes("/aca/obtener-cobertura") ||
    pathname.includes("/life-insurance/get-covered") ||
    pathname.includes("/seguro-de-vida/obtener-cobertura") ||
    pathname.includes("/health-alternative/get-covered") ||
    pathname.includes("/alternativa-de-salud/obtener-cobertura") ||
    isAcaIntakeForm ||
    isFeIntakeForm
  ) {
    response.headers.set("x-ads-landing-variant", "iul-bare");
  }
  return response;
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
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
    "/api/admin/:path*",
    "/api/newsletter/:path*",
    "/studio/:path*",
    "/studio",
    "/((?!api|trpc|_next|_vercel|studio|.*\\..*).*)"
  ],
};