// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Create the next-intl middleware
const intlMiddleware = createMiddleware(routing);

export default clerkMiddleware((auth, req) => {
  // Handle API routes that need auth
  if (req.nextUrl.pathname.startsWith('/api/blog')) {
    // API routes are handled by the route handlers themselves
    // Just ensure middleware runs for Clerk context
    return;
  }
  
  // All other routes are public for now - no auth.protect() call
  // Just pass through to next-intl middleware for locale handling
  return intlMiddleware(req);
});

export const config = {
  // Match all pathnames except for
  // - … if they start with `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  // - … `/studio` (Sanity Studio)
  // Include /api/blog routes for Clerk auth (but exclude other /api routes)
  matcher: [
    "/api/blog/:path*",
    "/((?!api|trpc|_next|_vercel|studio|.*\\..*).*)"
  ],
};