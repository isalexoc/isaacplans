"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import {
  AGENT_CRM_CHAT_CONFIG,
  AGENT_CRM_CHAT_SCRIPT_ID,
} from "@/lib/agent-crm-chat-config";

/**
 * Loads exactly one LeadConnector chat widget for the current locale.
 * On locale change (client navigation), removes the previous loader + injected UI
 * before loading the next widget — avoids duplicate bubbles / wrong language.
 */
export default function AgentCrmChat() {
  const locale = useLocale();
  const generationRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const gen = ++generationRef.current;

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
        'iframe[src*="agent-crm"]',
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
  }, [locale]);

  return null;
}
