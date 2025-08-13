// components/contact-form-iframe.tsx
"use client";

import Script from "next/script";

const ContactFormIFrame = () => (
  <>
    {/* Agent‑CRM helper script – loaded once */}
    <Script
      id="agent-crm-embed"
      src="https://link.agent-crm.com/js/form_embed.js"
      strategy="afterInteractive"
    />

    {/* NEW form */}
    <iframe
      src="https://link.agent-crm.com/widget/form/z3BuLLWvo2JRqrtkElq8"
      id="inline-z3BuLLWvo2JRqrtkElq8"
      title="ACA - Lead Intake - Isaac Plans"
      className="w-full min-h-[603px] border-none"
      /* Agent‑CRM data‑ attributes */
      data-layout='{"id":"INLINE"}'
      data-trigger-type="alwaysShow"
      data-activation-type="alwaysActivated"
      data-deactivation-type="neverDeactivate"
      data-form-name="ACA - Lead Intake - Isaac Plans"
      data-height="603"
      data-layout-iframe-id="inline-z3BuLLWvo2JRqrtkElq8"
      data-form-id="z3BuLLWvo2JRqrtkElq8"
    />
  </>
);

export default ContactFormIFrame;
