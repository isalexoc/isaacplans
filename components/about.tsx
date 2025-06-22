"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Award, GraduationCap, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";

export function About() {
  const { language } = useLanguage();
  const t = translations[language];

  const achievements = [
    {
      icon: Award,
      title: t.about.achievements.states.title,
      description: t.about.achievements.states.description,
    },
    {
      icon: Users,
      title: t.about.achievements.clients.title,
      description: t.about.achievements.clients.description,
    },
    {
      icon: Clock,
      title: t.about.achievements.experience.title,
      description: t.about.achievements.experience.description,
    },
    {
      icon: GraduationCap,
      title: t.about.achievements.education.title,
      description: t.about.achievements.education.description,
    },
  ];

  return (
    <section id="about" className="py-16 lg:py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Text Content - First on mobile, First on desktop */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 lg:space-y-8 order-1"
          >
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 lg:mb-6">
                {t.about.title}
              </h2>
              <p className="text-base lg:text-lg text-gray-600 leading-relaxed mb-4 lg:mb-6">
                {t.about.description1}
              </p>
              <p className="text-base lg:text-lg text-gray-600 leading-relaxed">
                {t.about.description2}
              </p>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-3 lg:mb-4">
                {t.about.certifications}
              </h3>
              <div className="flex flex-wrap gap-2">
                {t.about.certs.map((cert) => (
                  <Badge
                    key={cert}
                    variant="secondary"
                    className="text-xs lg:text-sm bg-green-100 text-green-800"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Image Content - Second on mobile, Second on desktop */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 order-2"
          >
            <div className="relative mb-6 lg:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6 place-items-center">
              {/* Logo Image */}
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_350/logo-title_c0wkke.png"
                alt="Dorraiz Insurance Logo"
                width={350}
                height={350}
                className="rounded-xl shadow-lg w-full max-w-xs object-contain"
                priority
              />

              {/* Health Image */}
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_350/health_vq9jgj.png"
                alt="Health Insurance Concept"
                width={350}
                height={350}
                className="rounded-xl shadow-lg w-full max-w-xs object-cover"
                priority
              />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-3 lg:p-4 text-center hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <achievement.icon className="w-6 h-6 lg:w-8 lg:h-8 text-green-600 mx-auto mb-2 lg:mb-3" />
                      <h4 className="font-semibold text-xs lg:text-sm mb-1 lg:mb-2">
                        {achievement.title}
                      </h4>
                      <p className="text-xs text-gray-600">
                        {achievement.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
