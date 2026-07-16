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
  // IUL intake (form + dashboard) requires login for both agent and client.
  '/iul/intake(.*)',
  '/iul/admision(.*)',
  '/en/iul/intake(.*)',
  '/es/iul/admision(.*)',
]);

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
  if (
    pathname.includes("/get-health-coverage-fast") ||
    pathname.includes("/cobertura-salud-rapida") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura") ||
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura")
  ) {
    response.headers.set("x-is-ads-landing", "1");
  }
  // IUL get-covered gets an even barer footer (logo + copyright only, no links).
  if (
    pathname.includes("/iul/get-covered") ||
    pathname.includes("/iul/obtener-cobertura")
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
    "/api/admin/:path*",
    "/api/newsletter/:path*",
    "/studio/:path*",
    "/studio",
    "/((?!api|trpc|_next|_vercel|studio|.*\\..*).*)"
  ],
};