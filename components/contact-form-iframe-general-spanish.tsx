"use client";
import Script from "next/script";

/** Spanish version of the Agent-CRM embed */
const ContactFormIFrameGeneralSpanish = () => (
  <>
    <Script
      id="agent-crm-embed-es"
      src="https://link.agent-crm.com/js/form_embed.js"
      strategy="afterInteractive"
    />

    <iframe
      src="https://link.agent-crm.com/widget/form/B3YtFv2qtHRnDmdCiQvj"
      id="inline-B3YtFv2qtHRnDmdCiQvj"
      title="A2P General Opt-in – Spanish"
      className="w-full h-full min-h-[603px] border-none"
      data-layout='{"id":"INLINE"}'
      data-trigger-type="alwaysShow"
      data-activation-type="alwaysActivated"
      data-deactivation-type="neverDeactivate"
      data-form-name="A2P General Opt-in – Spanish"
      data-height="888"
      data-layout-iframe-id="inline-B3YtFv2qtHRnDmdCiQvj"
      data-form-id="B3YtFv2qtHRnDmdCiQvj"
    />
  </>
);

export default ContactFormIFrameGeneralSpanish;
