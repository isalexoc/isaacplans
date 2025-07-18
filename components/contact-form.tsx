import Script from "next/script";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import ContactFormIFrame from "@/components/contact-form-iframe";

function ContactForm() {
  const { language } = useLanguage();
  const t = translations[language].contact.form;
  return (
    <section id="contact-form" className="py-16 lg:py-20 bg-gray-50">
      <div className="container mx-auto px-4 mt-3">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {translations[language].contact.title}
          </h2>
          <p className="text-lg text-gray-600">
            {translations[language].contact.subtitle}
          </p>
        </div>

        <ContactFormIFrame />

        <Script
          src="https://link.agent-crm.com/js/form_embed.js"
          strategy="lazyOnload"
        />
      </div>
    </section>
  );
}

export default ContactForm;
