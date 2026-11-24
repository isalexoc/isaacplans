import "server-only";

/**
 * Base URL for the few server-side calls to our own public routes (Release replaying a funnel's
 * step-2 saves). Same resolution the lead actions always used.
 */
export function leadGuardSiteBaseUrl(): string {
  if (process.env.NODE_ENV === "development") return `http://localhost:${process.env.PORT || 3000}`;
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000"
  );
}
