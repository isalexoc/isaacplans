"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Award, GraduationCap, Users, Clock } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

export function About() {
  const certifications = [
    "Licensed Insurance Agent",
    "ACA Certified Professional",
    "Medicare Specialist",
    "Health Insurance Marketplace Expert",
    "AHIP Certified",
    "State Insurance Commissioner Approved",
  ]

  const achievements = [
    {
      icon: Award,
      title: "35+ State Certifications",
      description: "Licensed to serve clients across the majority of US states",
    },
    {
      icon: Users,
      title: "1000+ Satisfied Clients",
      description: "Helping individuals and families find the right coverage",
    },
    {
      icon: Clock,
      title: "10+ Years Experience",
      description: "Decade of expertise in health insurance industry",
    },
    {
      icon: GraduationCap,
      title: "Continuous Education",
      description: "Staying current with latest regulations and plans",
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
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-6">
                Your Dedicated Insurance Professional
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                With over a decade of experience in the health insurance industry, I specialize in helping individuals
                and families navigate the complex world of ACA and Medicare insurance. My commitment is to provide
                personalized service and find the coverage that best fits your unique needs and budget.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                Being certified in more than 35 states allows me to serve clients nationwide, ensuring you receive
                expert guidance regardless of your location. I stay current with all regulatory changes and new plan
                offerings to provide you with the most up-to-date information and options.
              </p>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Certifications & Credentials</h3>
              <div className="flex flex-wrap gap-2">
                {certifications.map((cert) => (
                  <Badge key={cert} variant="secondary" className="text-sm">
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
                src="/placeholder.svg?height=400&width=400"
                alt="Insurance Professional"
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
                      <achievement.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
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
