"use client";

import { useTranslations } from "next-intl";
import ContactLeadForm from "@/components/contact-lead-form";

/** About page (and anywhere else): same contact form as /contact — private integration. */
export default function ContactForm() {
  const t = useTranslations("contactPage.info.form");

  return (
    <section id="contact-form" className="bg-gray-50 dark:bg-gray-900/50 py-16">
      <div className="container max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          {t("heading")}
        </h2>
        <p className="text-lg text-gray-700 dark:text-gray-300">{t("sub")}</p>
      </div>

      <div className="mx-auto mt-10 w-full max-w-md px-4 pb-8">
        <ContactLeadForm />
      </div>
    </section>
  );
}
