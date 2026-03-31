/**
 * Direct “quote all products” / agent links for the /carriers hub when opened from
 * Get Covered Fast (`?from=gcf&path=carriers`) — skip internal carrier landing pages.
 */
import { ALLSTATE_QUICK_QUOTE_URL } from "@/lib/allstate-quick-quote";
import { manhattanDirectQuoteUrl } from "@/lib/manhattan-direct-quote";
import { PIVOT_DIRECT_QUOTE_URL } from "@/lib/pivot-direct-quote";
import { UHONE_ALL_PLANS_CENSUS_URL } from "@/lib/uhone-broker";

export type CarriersHubCardId = "uhone" | "pivot" | "manhattan" | "allstate";

/** UHOne: dedicated “all plans” census (`UHONE_ALL_PLANS_CENSUS_URL`). */
export const GCF_CARRIERS_UHONE_DIRECT_URL = UHONE_ALL_PLANS_CENSUS_URL;

export const GCF_CARRIERS_PIVOT_DIRECT_URL = PIVOT_DIRECT_QUOTE_URL;

/** Manhattan Life: direct “all plans” entry (no product code suffix). */
export const GCF_CARRIERS_MANHATTAN_DIRECT_URL = manhattanDirectQuoteUrl();

/** NatGen quick-quote — all products (same as STM default). */
export const GCF_CARRIERS_ALLSTATE_DIRECT_URL = ALLSTATE_QUICK_QUOTE_URL;

export function gcfCarriersDirectHref(id: CarriersHubCardId): string {
  switch (id) {
    case "uhone":
      return GCF_CARRIERS_UHONE_DIRECT_URL;
    case "pivot":
      return GCF_CARRIERS_PIVOT_DIRECT_URL;
    case "manhattan":
      return GCF_CARRIERS_MANHATTAN_DIRECT_URL;
    case "allstate":
      return GCF_CARRIERS_ALLSTATE_DIRECT_URL;
    default:
      return GCF_CARRIERS_UHONE_DIRECT_URL;
  }
}

/** True when GCF sends users to pick a carrier on /carriers with attribution params. */
export function isGcfCarriersHubQuery(
  from: string | undefined,
  path: string | undefined
): boolean {
  return from === "gcf" && path === "carriers";
}
