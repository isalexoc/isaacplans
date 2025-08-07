// components/contact-form-iframe.tsx
"use client";

import Script from "next/script";

export default function ContactFormIFrame() {
  return (
    <>
      {/* Agent-CRM helper script – loaded once per page */}
      <Script
        id="agent-crm-embed"
        src="https://link.agent-crm.com/js/form_embed.js"
        strategy="afterInteractive"
      />

      {/* Dental & Vision form */}
      <iframe
        src="https://link.agent-crm.com/widget/form/MAQms9iGbl4F5rReCscp"
        id="inline-MAQms9iGbl4F5rReCscp"
        title="Hospital Indemnity - Lead Intake"
        className="w-full min-h-[603px] border-none"
        /* Agent-CRM data-attributes */
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="Hospital Indemnity - Lead Intake - Spanish"
        data-height="603"
        data-layout-iframe-id="inline-MAQms9iGbl4F5rReCscp"
        data-form-id="MAQms9iGbl4F5rReCscp"
      />
    </>
  );
}
