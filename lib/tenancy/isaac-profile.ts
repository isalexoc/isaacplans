/**
 * Isaac's public profile, for his own deck, /impact and quote images. Server-only: the licensed
 * state count comes from Sanity (cached an hour, like every other "{states} states" line on his
 * site) and the IBO number from env (`IMPACT_AGENT_IBO`; never in code, the repo is public).
 *
 * The pure builder and his card are in lib/tenancy/isaac-agent.ts.
 */

import "server-only";
import { getLicensedStateCount } from "@/lib/licensed-states";
import { buildIsaacProfile } from "./isaac-agent";
import type { AgentPublicProfile } from "./profile";
import { mainSiteUrl } from "./site-urls";

/** Sanity down: the line drops its number ("Licensed health agent"), as the pages always did. */
async function licensedStateCount(): Promise<number> {
  try {
    return await getLicensedStateCount();
  } catch {
    return 0;
  }
}

/** His deck and /impact: everything, the Sanity state count included. */
export async function isaacProfile(): Promise<AgentPublicProfile> {
  return buildIsaacProfile({
    licensedStateCount: await licensedStateCount(),
    iboNumber: process.env.IMPACT_AGENT_IBO,
    siteUrl: mainSiteUrl(),
  });
}

/**
 * His quote images: name, photo, WhatsApp and site line only, so no Sanity call (the image never
 * shows the state count or the IBO number).
 */
export function isaacQuoteImageProfile(): AgentPublicProfile {
  return buildIsaacProfile({ licensedStateCount: 0, iboNumber: process.env.IMPACT_AGENT_IBO, siteUrl: mainSiteUrl() });
}
