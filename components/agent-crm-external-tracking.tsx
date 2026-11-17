"use client";

import Script from "next/script";
import { usePathname } from "@/i18n/navigation";
import { isAgentCrmBookingCalendarPathname } from "@/lib/agent-crm-calendar-route";
import { isAdsLandingPathResolved, isPartnerLandingPath } from "@/lib/ads-landing";
import { isPrivatePagePath } from "@/lib/private-pages";

type Props = {
  trackingId: string;
  src: string;
  debug?: boolean;
};

/**
 * Agent CRM external tracking can interfere with booking iframe embeds after a few seconds.
 * Omit on appointment calendar routes and paid-landing URLs (SPA from other pages uses pathname).
 */
export default function AgentCrmExternalTracking({
  trackingId,
  src,
  debug,
}: Props) {
  const pathname = usePathname();
  const path =
    typeof window !== "undefined"
      ? window.location.pathname
      : pathname ?? "";

  if (isAgentCrmBookingCalendarPathname(path)) {
    return null;
  }

  // Paid landings, and pages with a client's data on them (their form capture must never run there).
  if (isAdsLandingPathResolved(path) || isPrivatePagePath(path)) {
    return null;
  }

  // Referral partner pages own their lead capture; this script's form capture would create a
  // second, blank contact off the same submit. See isPartnerLandingPath.
  if (isPartnerLandingPath(path)) {
    return null;
  }

  return (
    <Script
      id="agentcrm-external-tracking"
      src={src}
      strategy="afterInteractive"
      data-tracking-id={trackingId}
      {...(debug ? { "data-debug": "true" } : {})}
    />
  );
}
