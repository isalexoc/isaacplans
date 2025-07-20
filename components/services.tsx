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
  BriefcaseMedical,
  Hospital,
  TriangleAlert,
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
import Link from "next/link";

export function Services() {
  const { language } = useLanguage();
  const t = translations[language];

  const services = [
    {
      icon: BriefcaseMedical,
      title: t.services.items.aca.title,
      description: t.services.items.aca.description,
      features: t.services.items.aca.features,
      link: "/aca",
    },
    {
      icon: Shield,
      title: t.services.items.dentalVision.title,
      description: t.services.items.dentalVision.description,
      features: t.services.items.dentalVision.features,
    },
    {
      icon: Hospital,
      title: t.services.items.hospitalIndemnity.title,
      description: t.services.items.hospitalIndemnity.description,
      features: t.services.items.hospitalIndemnity.features,
    },
    {
      icon: Users,
      title: t.services.items.lifeInsurance.title,
      description: t.services.items.lifeInsurance.description,
      features: t.services.items.lifeInsurance.features,
    },

    {
      icon: TriangleAlert,
      title: t.services.items.cancerPlans.title,
      description: t.services.items.cancerPlans.description,
      features: t.services.items.cancerPlans.features,
    },
    {
      icon: Heart,
      title: t.services.items.heartStrokePlans.title,
      description: t.services.items.heartStrokePlans.description,
      features: t.services.items.heartStrokePlans.features,
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
              <Card className="h-full flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-4">
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

                <CardContent className="flex flex-col flex-1 justify-between">
                  <div>
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
                  </div>

                  <div className="mt-auto pt-4">
                    <Link href={service.link || ""}>
                      <Button variant="outline" className="w-full">
                        {language === "es" ? "Más Información" : "Learn More"}
                      </Button>
                    </Link>
                  </div>
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
