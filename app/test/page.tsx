"use client";

import Script from "next/script";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";

export default function Contact() {
  const { language } = useLanguage();
  const t = translations[language].contact.form;
  return (
    <section id="contact" className="py-16 lg:py-20 bg-gray-50">
      <div className="container mx-auto px-4 mt-3">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {translations[language].contact.title}
          </h2>
          <p className="text-lg text-gray-600">
            {translations[language].contact.subtitle}
          </p>
        </div>

        <div className="max-w-3xl mx-auto shadow-lg rounded-xl overflow-hidden">
          <iframe
            src="https://link.agent-crm.com/widget/form/R7X4k5dTsAORoIyMq6Kz"
            style={{
              width: "100%",
              height: "805px",
              border: "none",
              borderRadius: "8px",
            }}
            id="inline-R7X4k5dTsAORoIyMq6Kz"
            data-layout='{"id":"INLINE"}'
            data-trigger-type="alwaysShow"
            data-trigger-value=""
            data-activation-type="alwaysActivated"
            data-activation-value=""
            data-deactivation-type="neverDeactivate"
            data-deactivation-value=""
            data-form-name="A2P General Optin"
            data-layout-iframe-id="inline-R7X4k5dTsAORoIyMq6Kz"
            data-form-id="R7X4k5dTsAORoIyMq6Kz"
            title="A2P General Optin"
          ></iframe>
        </div>

        <Script
          src="https://link.agent-crm.com/js/form_embed.js"
          strategy="lazyOnload"
        />
      </div>
    </section>
  );
}
