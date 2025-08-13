"use client";

import Script from "next/script";

const ContactFormIFrameGeneral = () => (
  <>
    <Script
      id="agent-crm-embed"
      src="https://link.agent-crm.com/js/form_embed.js"
      strategy="afterInteractive"
    />

    <iframe
      src="https://link.agent-crm.com/widget/form/mPN7YcIHFwUOipERfwfH"
      id="inline-mPN7YcIHFwUOipERfwfH"
      title="ACA - Lead Intake - Isaac Plans - Spanish"
      className="w-full h-full min-h-[603px] border-none"
      data-layout='{"id":"INLINE"}'
      data-trigger-type="alwaysShow"
      data-activation-type="alwaysActivated"
      data-deactivation-type="neverDeactivate"
      data-form-name="ACA - Lead Intake - Isaac Plans - Spanish"
      data-height="603"
      data-layout-iframe-id="inline-mPN7YcIHFwUOipERfwfH"
      data-form-id="mPN7YcIHFwUOipERfwfH"
    />
  </>
);

export default ContactFormIFrameGeneral;
