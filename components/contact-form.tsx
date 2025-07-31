// components/contact-form.tsx  – server component
import { getTranslations, getLocale } from "next-intl/server";

import ContactFormIFrameGeneral from "@/components/contact-form-iframe-general"; // EN
import ContactFormIFrameGeneralSpanish from "@/components/contact-form-iframe-general-spanish"; // ES

export default async function ContactForm() {
  /* i18n ---------------------------------------------------------- */
  const t = await getTranslations("contactPage.info.form");
  const locale = await getLocale(); // 'en', 'es', …

  /* Pick the correct client iframe once on the server ------------- */
  const Form = locale.startsWith("es")
    ? ContactFormIFrameGeneralSpanish
    : ContactFormIFrameGeneral;

  /* Mark-up -------------------------------------------------------- */
  return (
    <section id="contact-form" className="bg-gray-50 py-16">
      <div className="container max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {t("heading")}
        </h2>
        <p className="text-lg  text-gray-600">{t("sub")}</p>
      </div>

      {/* client-only iframe embed */}
      <div className="mt-10 px-4">
        <Form />
      </div>
    </section>
  );
}
