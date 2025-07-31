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
      src="https://link.agent-crm.com/widget/form/R7X4k5dTsAORoIyMq6Kz"
      id="inline-R7X4k5dTsAORoIyMq6Kz"
      title="A2P General Optin"
      className="w-full h-full min-h-[603px] border-none"
      data-layout='{"id":"INLINE"}'
      data-trigger-type="alwaysShow"
      data-activation-type="alwaysActivated"
      data-deactivation-type="neverDeactivate"
      data-form-name="A2P General Optin"
      data-height="603"
      data-layout-iframe-id="inline-R7X4k5dTsAORoIyMq6Kz"
      data-form-id="R7X4k5dTsAORoIyMq6Kz"
    />
  </>
);

export default ContactFormIFrameGeneral;
