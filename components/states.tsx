"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MapPin, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";

export function Coverage() {
  const { language } = useLanguage();
  const t = translations[language];

  const features = [
    language === "es"
      ? "Licenciado en más de 20 estados"
      : "Licensed in 20+ states",
    language === "es"
      ? "Licencia ACA (Salud, Obama Care)"
      : "ACA License (Health, Obama Care)",
    language === "es" ? "Especialista en Medicare" : "Medicare Specialist",
    language === "es" ? "Licencia en Seguro de Vida" : "Life Insurance License",
    language === "es"
      ? "Licencia en Seguro Dental"
      : "Dental Insurance License",
    language === "es"
      ? "Licencia en Seguro de Visión"
      : "Vision Insurance License",
    language === "es"
      ? "Más de 8 años de experiencia"
      : "Over 8 years of experience",
    language === "es"
      ? "Servicio personalizado en español"
      : "Personalized service in Spanish",
    language === "es" ? "Consultas gratuitas" : "Free consultations",
    language === "es" ? "Soporte continuo" : "Ongoing support",
  ];

  return (
    <section id="coverage" className="py-20 bg-white overflow-x-hidden">
      <div className="container mx-auto px-4 max-w-full">
        {/* ───────── Section Header ───────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 overflow-x-hidden"
        >
          <div className="flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-custom mr-3" />
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              {t.coverage.title}
            </h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {t.coverage.subtitle}
          </p>
        </motion.div>

        {/* ───────── Feature Grid ───────── */}
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="
              bg-gradient-to-br
              from-[hsl(var(--custom)/0.06)]
              to-[hsl(var(--custom)/0.16)]
              rounded-2xl
              p-6 sm:p-8
              mb-12
              overflow-x-hidden
            "
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Isaac Orraiz
              </h3>
              <p className="text-lg text-gray-600">{t.coverage.description}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-full">
              {features.map((feature, index) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <CheckCircle className="w-5 h-5 text-custom mr-3 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-700 break-words">
                    {feature}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* ───────── Contact CTA ───────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center px-2 overflow-x-hidden"
          >
            <Card className="bg-custom text-custom-foreground p-6 sm:p-8 max-w-full overflow-hidden">
              <CardContent className="p-0">
                <h4 className="text-2xl font-bold mb-4">
                  {language === "es" ? "¿Necesita Seguro?" : "Need Insurance?"}
                </h4>
                <p className="text-lg mb-6 opacity-90">
                  {language === "es"
                    ? "¡Está en el lugar correcto! Obtenga una cotización gratuita hoy."
                    : "You're in the right place! Get a free quote today."}
                </p>

                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 justify-center items-center max-w-full">
                  <a
                    href={`tel:${process.env.NEXT_PUBLIC_PHONE_NUMBER}`}
                    className="
                      bg-white text-custom
                      hover:bg-gray-100
                      px-6 py-3 rounded-lg font-semibold
                      transition-colors
                      text-center w-full sm:w-auto truncate
                    "
                  >
                    {process.env.NEXT_PUBLIC_PHONE_NUMBER}
                  </a>

                  <a
                    href="mailto:info@isaacplans.com"
                    className="
                      bg-custom/90 hover:bg-custom
                      text-custom-foreground
                      px-6 py-3 rounded-lg font-semibold
                      transition-colors
                      text-center w-full sm:w-auto truncate
                    "
                  >
                    Email Me
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
