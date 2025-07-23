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
        src="https://link.agent-crm.com/widget/form/0YWpgL7LJqEK7sp84O3z"
        id="inline-0YWpgL7LJqEK7sp84O3z"
        title="Dental & Vision Insurance - Lead Intake"
        className="w-full min-h-[603px] border-none"
        /* Agent-CRM data-attributes */
        data-layout='{"id":"INLINE"}'
        data-trigger-type="alwaysShow"
        data-activation-type="alwaysActivated"
        data-deactivation-type="neverDeactivate"
        data-form-name="Dental & Vision Insurance - Lead Intake"
        data-height="603"
        data-layout-iframe-id="inline-0YWpgL7LJqEK7sp84O3z"
        data-form-id="0YWpgL7LJqEK7sp84O3z"
      />
    </>
  );
}
