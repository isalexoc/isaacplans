"use client";

import Script from "next/script";
import { usePathname } from "@/i18n/navigation";
import { isAgentCrmBookingCalendarPathname } from "@/lib/agent-crm-calendar-route";

type Props = {
  trackingId: string;
  src: string;
  debug?: boolean;
};

/**
 * Agent CRM external tracking can interfere with booking iframe embeds after a few seconds.
 * Do not load it on appointment calendar routes.
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
