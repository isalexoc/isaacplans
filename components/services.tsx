"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heart,
  Shield,
  Users,
  FileText,
  Phone,
  Calculator,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import CTAButton from "./cta-button";

export function Services() {
  const { language } = useLanguage();
  const t = translations[language];

  const services = [
    {
      icon: Heart,
      title: t.services.items.aca.title,
      description: t.services.items.aca.description,
      features: t.services.items.aca.features,
    },
    {
      icon: Shield,
      title: t.services.items.medicare.title,
      description: t.services.items.medicare.description,
      features: t.services.items.medicare.features,
    },
    {
      icon: Users,
      title: t.services.items.family.title,
      description: t.services.items.family.description,
      features: t.services.items.family.features,
    },
    {
      icon: FileText,
      title:
        language === "es"
          ? "Seguro de Vida, Dental y Visión"
          : "Life, Dental & Vision Insurance",
      description:
        language === "es"
          ? "Cobertura completa para proteger su salud y bienestar con seguros de vida, dental y visión."
          : "Complete coverage to protect your health and wellbeing with life, dental, and vision insurance.",
      features:
        language === "es"
          ? [
              "Seguro de Vida",
              "Cobertura Dental Completa",
              "Planes de Visión",
              "Opciones Familiares",
            ]
          : [
              "Life Insurance",
              "Complete Dental Coverage",
              "Vision Plans",
              "Family Options",
            ],
    },
    {
      icon: Phone,
      title: t.services.items.support.title,
      description: t.services.items.support.description,
      features: t.services.items.support.features,
    },
    {
      icon: Calculator,
      title: t.services.items.optimization.title,
      description: t.services.items.optimization.description,
      features: t.services.items.optimization.features,
    },
  ];

  return (
    <section id="services" className="py-16 lg:py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {t.services.title}
          </h2>
          <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
            {t.services.subtitle}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-4">
                  {/* ── icon badge ── */}
                  <div className="w-10 h-10 lg:w-12 lg:h-12 bg-custom/10 rounded-lg flex items-center justify-center mb-3 lg:mb-4">
                    <service.icon className="w-5 h-5 lg:w-6 lg:h-6 text-custom" />
                  </div>

                  <CardTitle className="text-lg lg:text-xl">
                    {service.title}
                  </CardTitle>
                  <CardDescription className="text-gray-600 text-sm lg:text-base">
                    {service.description}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-2 mb-4 lg:mb-6">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center text-sm text-gray-600"
                      >
                        <div className="w-1.5 h-1.5 bg-custom rounded-full mr-3 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <br />
          <CTAButton />
        </motion.div>
      </div>
    </section>
  );
}
