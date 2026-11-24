/**
 * What Lead Guard reads from the visitor's request headers. Works with NextRequest.headers in a
 * route and with `await headers()` in a server action. No PII is logged from here.
 */

export type VisitorContext = {
  ip?: string;
  ua?: string;
  origin: string | null;
  host: string | null;
  /** React's client sends `Next-Action` when it invokes a server action; a native form post does not. */
  hasNextActionHeader: boolean;
};

type HeaderSource = { get(name: string): string | null };

export function visitorFromHeaders(h: HeaderSource): VisitorContext {
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = xff || h.get("x-real-ip")?.trim() || undefined;
  const ua = h.get("user-agent")?.slice(0, 400) || undefined;
  return {
    ip,
    ua,
    origin: h.get("origin"),
    host: h.get("x-forwarded-host") || h.get("host"),
    hasNextActionHeader: Boolean(h.get("next-action")),
  };
}

/** A browser POST from another site. Absent Origin is not "foreign" (old clients, server calls). */
export function isForeignOrigin(v: VisitorContext): boolean {
  if (!v.origin || v.origin === "null") return false;
  let originHost: string;
  try {
    originHost = new URL(v.origin).host.toLowerCase();
  } catch {
    return true;
  }
  const host = v.host?.split(",")[0]?.trim().toLowerCase();
  if (host && originHost === host) return false;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) {
    try {
      const siteHost = new URL(site).host.toLowerCase();
      const bare = (x: string) => x.replace(/^www\./, "");
      if (bare(originHost) === bare(siteHost)) return false;
    } catch {
      /* ignore */
    }
  }
  if (process.env.NODE_ENV === "development" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(originHost)) return false;
  return true;
}
