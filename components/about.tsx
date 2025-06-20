"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award, GraduationCap, Users, Clock } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/translations"

export function About() {
  const { language } = useLanguage()
  const t = translations[language]

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
  ]

  return (
    <section id="about" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">{t.about.title}</h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">{t.about.description1}</p>
              <p className="text-lg text-gray-600 leading-relaxed">{t.about.description2}</p>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{t.about.certifications}</h3>
              <div className="flex flex-wrap gap-2">
                {t.about.certs.map((cert) => (
                  <Badge key={cert} variant="secondary" className="text-sm bg-green-100 text-green-800">
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <div className="relative mb-8">
              <Image
                src="/images/daniel-orraiz.jfif"
                alt="Daniel Orraiz - Profesional de Seguros"
                width={400}
                height={400}
                className="rounded-2xl shadow-lg mx-auto"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {achievements.map((achievement, index) => (
                <motion.div
                  key={achievement.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-4 text-center hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <achievement.icon className="w-8 h-8 text-green-600 mx-auto mb-3" />
                      <h4 className="font-semibold text-sm mb-2">{achievement.title}</h4>
                      <p className="text-xs text-gray-600">{achievement.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
