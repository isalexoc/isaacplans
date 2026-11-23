/**
 * Which deployment this code is running as.
 *
 * One repo and one database serve two Vercel projects:
 *  - "main" (isaacplans.com, the default): Isaac's site, his CRM, his trackers, the agent area.
 *  - "product" (`APP_SURFACE=product`, the neutral product domain): only agents' client pages. That
 *    project runs without Clerk keys, trackers or any `AGENT_CRM_*` env, so a code path that was
 *    missed still cannot reach Isaac's CRM.
 *
 * Anything other than the exact word "product" is "main", so a typo can never switch Isaac's site
 * into the product shell. Server config: `APP_SURFACE` is not a NEXT_PUBLIC_ variable, so in a
 * browser bundle this always reads "main".
 *
 * Pure (one env read, no server-only import) so the offline tests can import it.
 */

export type AppSurface = "main" | "product";

export function parseAppSurface(value: string | null | undefined): AppSurface {
  return typeof value === "string" && value.trim().toLowerCase() === "product" ? "product" : "main";
}

export function appSurface(): AppSurface {
  return parseAppSurface(process.env.APP_SURFACE);
}

export function isProductSurface(): boolean {
  return appSurface() === "product";
}
