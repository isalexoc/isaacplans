/**
 * The two public origins and the platform's name, read from env. Pure (env reads only, no
 * server-only import) so the offline tests can import it; lib/tenancy/urls.ts picks one origin per
 * session owner.
 *
 *  - Isaac's site: `NEXT_PUBLIC_SITE_URL`, else https://www.isaacplans.com. Every client link pointed
 *    there before the platform, and Isaac's still do.
 *  - The product domain: `PRODUCT_PUBLIC_URL` (the second Vercel project's address, e.g.
 *    https://<product>.com), where agents' clients open their guide, application and secure links.
 *    Only an https URL counts (plain http only for a machine's own names, localhost or *.local, in
 *    local testing: these links carry credentials); its origin is used (any path is dropped). Unset
 *    or malformed reads as "not configured" (null), and callers fail closed on that.
 *  - `PLATFORM_NAME`: the product's name in its footer and page titles, else "Health sharing guide".
 */

type Env = Record<string, string | undefined>;

export const DEFAULT_SITE_URL = "https://www.isaacplans.com";
export const DEFAULT_PLATFORM_NAME = "Health sharing guide";

/** Isaac's site, without a trailing slash. */
export function mainSiteUrl(env: Env = process.env): string {
  return (env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL).replace(/\/+$/, "");
}

/** A machine's own name, where plain http is fine for local testing. */
function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "[::1]"
  );
}

/** The product domain's origin ("https://example.com"), or null when it isn't configured. */
export function productPublicOrigin(env: Env = process.env): string | null {
  const raw = env.PRODUCT_PUBLIC_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const secure = url.protocol === "https:" || (url.protocol === "http:" && isLocalHostname(url.hostname));
    if (!secure) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** "guide.example.com" from an origin, URL or Host header: lower case, without "www.", port kept. */
function siteKey(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = raw.includes("://") ? new URL(raw).host : new URL(`https://${raw}`).host;
    return host.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/**
 * The product origin isaacplans.com may send an agent's client to (the token pages' 307), or null:
 * never the site that is answering (a product domain pointed at itself, or at a deployment that
 * isn't running as the product, would redirect forever) and never Isaac's own site. The request's
 * Host only ever refuses.
 */
export function productRedirectOrigin(ctx: { requestHost: string | null | undefined; env?: Env }): string | null {
  const env = ctx.env ?? process.env;
  const origin = productPublicOrigin(env);
  if (!origin) return null;
  const target = siteKey(origin);
  const refused = [ctx.requestHost ?? "", mainSiteUrl(env), DEFAULT_SITE_URL].map(siteKey);
  return target && !refused.includes(target) ? origin : null;
}

/**
 * Where a session's client links point: Isaac's site for his own sessions (`platformOwner`), the
 * product domain for an agent's. Without a product domain an agent's links fall back to Isaac's
 * site, whose token pages then answer 404 for them (they can't send the client anywhere).
 */
export function publicOriginFor(platformOwner: boolean, env: Env = process.env): string {
  if (platformOwner) return mainSiteUrl(env);
  return productPublicOrigin(env) ?? mainSiteUrl(env);
}

/**
 * The whole of lib/tenancy/urls.ts `publicOriginForOwner`, with the CRM's owner rule passed in
 * (`isPlatformOwner` from lib/tenancy/crm.ts there, a stand-in in the offline tests): an owner who
 * may use Isaac's CRM gets his site, anyone else the product domain.
 */
export async function publicOriginForOwnerWith<Options>(
  ownerUserId: string | null | undefined,
  opts: Options,
  isPlatformOwner: (ownerUserId: string | null | undefined, opts: Options) => Promise<boolean>,
  env: Env = process.env
): Promise<{ origin: string; platformOwner: boolean }> {
  const platformOwner = await isPlatformOwner(ownerUserId, opts);
  return { origin: publicOriginFor(platformOwner, env), platformOwner };
}

/** The product's name, for its footer and titles. */
export function platformName(env: Env = process.env): string {
  return env.PLATFORM_NAME?.trim().slice(0, 80) || DEFAULT_PLATFORM_NAME;
}

/** "example.com" for display (no scheme, no "www."), or null without a product domain. */
export function productHostLabel(env: Env = process.env): string | null {
  const origin = productPublicOrigin(env);
  return origin ? new URL(origin).host.replace(/^www\./, "") : null;
}
