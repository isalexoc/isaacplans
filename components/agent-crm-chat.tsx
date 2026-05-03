"use client";

import { useLayoutEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import {
  AGENT_CRM_NO_SWEEP_HTML_ATTR,
  isAgentCrmBookingCalendarPathname,
} from "@/lib/agent-crm-calendar-route";
import {
  AGENT_CRM_CHAT_CONFIG,
  AGENT_CRM_CHAT_SCRIPT_ID,
} from "@/lib/agent-crm-chat-config";
import { isAdsLandingPathResolved } from "@/lib/ads-landing";

/**
 * Loads exactly one LeadConnector chat widget for the current locale.
 * On locale change (client navigation), removes the previous loader + injected UI
 * before loading the next widget — avoids duplicate bubbles / wrong language.
 */
export default function AgentCrmChat() {
  const locale = useLocale();
  const pathname = usePathname();
  const generationRef = useRef(0);

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    function removeLeadConnectorChatArtifacts() {
      document
        .querySelectorAll(
          `#${AGENT_CRM_CHAT_SCRIPT_ID}, script[src*="leadconnectorhq.com"][src*="loader.js"]`
        )
        .forEach((el) => el.remove());

      const widgetSelectors = [
        '[id*="leadconnector"]',
        '[id*="agentcrm"]',
        '[id*="chat-widget"]',
        '[class*="leadconnector"]',
        '[class*="agentcrm"]',
        '[class*="chat-widget"]',
        '[class*="lc-chat"]',
        '[class*="lc_text-widget"]',
        'iframe[src*="leadconnector"]',
        'iframe[src*="widgets.leadconnectorhq.com"]',
        'iframe[src*="beta.leadconnectorhq.com"]',
        "div[data-widget-id]",
        'div[data-resources-url*="leadconnector"]',
        'div[data-resources-url*="agent-crm"]',
      ].join(", ");

      document.querySelectorAll(widgetSelectors).forEach((el) => {
        el.remove();
      });
    }

    /** Client: real URL is authoritative (next-intl pathname can lag one frame). */
    const path =
      typeof window !== "undefined"
        ? window.location.pathname
        : pathname ?? "";

    /** Booking embed sets this in useLayoutEffect (tree order) — extra guard. */
    if (document.documentElement.hasAttribute(AGENT_CRM_NO_SWEEP_HTML_ATTR)) {
      return;
    }
    if (isAgentCrmBookingCalendarPathname(path)) {
      return;
    }
    /** Paid landing routes — strip widget if user SPA-navigated here from another page. */
    if (isAdsLandingPathResolved(path)) {
      removeLeadConnectorChatArtifacts();
      return;
    }

    const gen = ++generationRef.current;

    removeLeadConnectorChatArtifacts();

    const config = AGENT_CRM_CHAT_CONFIG[locale] ?? AGENT_CRM_CHAT_CONFIG.en;
    const t = window.setTimeout(() => {
      if (generationRef.current !== gen) return;

      removeLeadConnectorChatArtifacts();

      const script = document.createElement("script");
      script.id = AGENT_CRM_CHAT_SCRIPT_ID;
      script.src = config.src;
      script.async = true;
      script.setAttribute("data-resources-url", config.resourcesUrl);
      script.setAttribute("data-widget-id", config.widgetId);
      document.body.appendChild(script);
    }, 0);

    return () => {
      window.clearTimeout(t);
      if (generationRef.current === gen) {
        removeLeadConnectorChatArtifacts();
      }
    };
  }, [locale, pathname]);

  return null;
}
