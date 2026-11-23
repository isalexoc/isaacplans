/**
 * Which public origin a session's client links use. Server-only (it asks lib/tenancy/crm.ts, which
 * may ask Clerk). The pure half is lib/tenancy/site-urls.ts (`publicOriginForOwnerWith`, tested
 * offline with a stand-in for the CRM rule).
 *
 * The rule follows the CRM's: an owner who may use Isaac's CRM (`isPlatformOwner`: listed in env,
 * a vouched-for admin caller, or a Clerk admin) is Isaac's side, so their clients' links point at
 * his site, exactly as before. Everyone else is an agent, whose clients only ever use the product
 * domain (`PRODUCT_PUBLIC_URL`). On the product surface nobody is a platform owner, so it is always
 * the product domain there.
 */

import "server-only";
import { isPlatformOwner, type CrmOwnerOptions } from "./crm";
import { productPublicOrigin, publicOriginForOwnerWith } from "./site-urls";

let warnedMissingProduct = false;

export async function publicOriginForOwner(
  ownerUserId: string | null | undefined,
  opts: CrmOwnerOptions = {}
): Promise<string> {
  const { origin, platformOwner } = await publicOriginForOwnerWith(ownerUserId, opts, isPlatformOwner);
  if (!platformOwner && !productPublicOrigin() && !warnedMissingProduct) {
    warnedMissingProduct = true;
    console.warn("[tenancy] PRODUCT_PUBLIC_URL is not set: an agent's client links point at the main site, which answers 404 for them.");
  }
  return origin;
}
