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
      src="https://link.agent-crm.com/widget/form/MwmNPpL00pP6SzDz58Eu"
      id="inline-MwmNPpL00pP6SzDz58Eu"
      title="Dental & Vision Insurance - Lead Intake - Spanish"
      className="w-full h-full min-h-[603px] border-none"
      data-layout='{"id":"INLINE"}'
      data-trigger-type="alwaysShow"
      data-activation-type="alwaysActivated"
      data-deactivation-type="neverDeactivate"
      data-form-name="Dental & Vision Insurance - Lead Intake - Spanish"
      data-height="888"
      data-layout-iframe-id="inline-MwmNPpL00pP6SzDz58Eu"
      data-form-id="MwmNPpL00pP6SzDz58Eu"
    />
  </>
);

export default ContactFormIFrameGeneralSpanish;
