import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general";

function ContactForm() {
  const { language } = useLanguage();
  const t = translations[language].contact.form;
  return (
    <section id="contact-form" className="bg-gray-50">
      <div className="container max-w-3xl mx-auto px-4">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {translations[language].contact.title}
          </h2>
          <p className="text-lg text-gray-600">
            {translations[language].contact.subtitle}
          </p>
        </div>
      </div>
      <ContactFormIFrameGeneral />
    </section>
  );
}

export default ContactForm;
