// middleware.ts
import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/presentations(.*)',
  '/en/presentations(.*)',
  '/es/presentations(.*)',
]);

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

  // API routes: Clerk context only — do not run next-intl (would return HTML)
  if (
    req.nextUrl.pathname.startsWith('/api/blog') ||
    req.nextUrl.pathname.startsWith('/api/leave-behind') ||
    req.nextUrl.pathname.startsWith('/api/admin')
  ) {
    return;
  }

  // Protected agent tools — requires authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  
  // All other routes are public for now - no auth.protect() call
  // Just pass through to next-intl middleware for locale handling
  const response = intlMiddleware(req);
  const pathname = req.nextUrl.pathname;
  if (
    pathname.includes("/get-health-coverage-fast") ||
    pathname.includes("/cobertura-salud-rapida") ||
    pathname.includes("/final-expense/get-covered") ||
    pathname.includes("/gastos-finales/obtener-cobertura")
  ) {
    response.headers.set("x-is-ads-landing", "1");
  }
  return response;
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  // - … `/studio` (Sanity Studio)
  // Include /api/blog routes for Clerk auth (but exclude other /api routes)
  matcher: [
    "/api/blog/:path*",
    "/api/leave-behind/:path*",
    "/api/admin/:path*",
    "/((?!api|trpc|_next|_vercel|studio|.*\\..*).*)"
  ],
};