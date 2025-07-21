"use client";

const ContactFormIFrame = () => (
  /* 2️⃣ The iframe fills the modal & carries the single scrollbar */
  <iframe
    src="https://link.agent-crm.com/widget/form/R7X4k5dTsAORoIyMq6Kz"
    className="w-full h-full border-none"
    id="inline-R7X4k5dTsAORoIyMq6Kz"
    data-layout='{"id":"INLINE"}'
    data-trigger-type="alwaysShow"
    data-activation-type="alwaysActivated"
    data-deactivation-type="neverDeactivate"
    data-form-name="A2P General Optin"
    data-layout-iframe-id="inline-R7X4k5dTsAORoIyMq6Kz"
    data-form-id="R7X4k5dTsAORoIyMq6Kz"
    title="A2P General Optin"
    /* leave scrolling default/auto so the user can scroll inside */
  />
);

export default ContactFormIFrame;
