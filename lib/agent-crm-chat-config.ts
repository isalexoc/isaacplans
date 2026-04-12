/** LeadConnector / Agent CRM chat widget — one loader + widget id per locale */
export const AGENT_CRM_CHAT_CONFIG: Record<
  string,
  { src: string; resourcesUrl: string; widgetId: string }
> = {
  en: {
    src: "https://widgets.leadconnectorhq.com/loader.js",
    resourcesUrl: "https://widgets.leadconnectorhq.com/chat-widget/loader.js",
    widgetId: "687794d4afd5323330f86826",
  },
  es: {
    src: "https://beta.leadconnectorhq.com/loader.js",
    resourcesUrl: "https://beta.leadconnectorhq.com/chat-widget/loader.js",
    widgetId: "69d4000b6ddd01f306170b54",
  },
};

export const AGENT_CRM_CHAT_SCRIPT_ID = "isaacplans-agentcrm-chat-loader";
