"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-aca";
import CTAButton from "@/components/cta-button";

const ACALandingPage = () => {
  const { language } = useLanguage();
  const content = t[language];

  return (
    <div className="bg-white dark:bg-gray-950 text-gray-900 dark:text-white">
      <section className="py-12 px-6 text-center max-w-3xl mx-auto">
        <span className="text-sm uppercase font-semibold tracking-wider text-blue-600 dark:text-blue-400">
          {content.hero.badge}
        </span>
        <h1 className="text-4xl font-bold mt-4">
          {content.hero.name} <br />
          <span className="text-blue-600 dark:text-blue-400">
            {content.hero.title} {content.hero.subtitle}
          </span>
        </h1>
        <p className="mt-6 text-lg leading-relaxed">
          {content.hero.description}
        </p>
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <CTAButton>{content.hero.cta1}</CTAButton>
          <a
            href="#contact"
            className="inline-flex items-center justify-center rounded-md border border-blue-600 px-6 py-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800"
          >
            {content.hero.cta2}
          </a>
        </div>
      </section>

      <section className="bg-blue-50 dark:bg-gray-900 py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            {content.services.items.aca.title}
          </h2>
          <p className="mb-6 text-lg">
            {content.services.items.aca.description}
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 text-left max-w-xl mx-auto">
            {content.services.items.aca.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400">✔</span>{" "}
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <CTAButton>{content.hero.ctas.cta1.title}</CTAButton>
            <p className="text-sm mt-2 text-gray-500 dark:text-gray-400">
              {content.hero.ctas.cta1.message}
            </p>
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="py-20 px-6 bg-white dark:bg-black text-center"
      >
        <h2 className="text-3xl font-bold mb-4">{content.contact.title}</h2>
        <p className="text-lg mb-6 max-w-2xl mx-auto">
          {content.contact.subtitle}
        </p>
        <CTAButton />
        <p className="text-sm mt-4 text-gray-500 dark:text-gray-400">
          {content.contact.form.smsConsent}
        </p>
      </section>
    </div>
  );
};

export default ACALandingPage;
