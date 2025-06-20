"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Heart, Shield, Users, FileText, Phone, Calculator } from "lucide-react"
import { motion } from "framer-motion"

export function Services() {
  const services = [
    {
      icon: Heart,
      title: "ACA Health Insurance",
      description: "Comprehensive health insurance plans under the Affordable Care Act with subsidies and tax credits.",
      features: [
        "Premium Tax Credits",
        "Cost-Sharing Reductions",
        "Essential Health Benefits",
        "Pre-existing Conditions Covered",
      ],
    },
    {
      icon: Shield,
      title: "Medicare Plans",
      description: "Complete Medicare solutions including Parts A, B, C, and D with personalized plan selection.",
      features: ["Medicare Advantage", "Medicare Supplements", "Part D Prescription", "Annual Enrollment"],
    },
    {
      icon: Users,
      title: "Family Coverage",
      description: "Tailored insurance solutions for families with children, ensuring comprehensive protection.",
      features: ["Pediatric Care", "Maternity Coverage", "Family Deductibles", "Preventive Care"],
    },
    {
      icon: FileText,
      title: "Plan Comparison",
      description: "Side-by-side plan analysis to help you choose the best coverage for your specific needs.",
      features: ["Cost Analysis", "Network Comparison", "Benefit Review", "Personalized Recommendations"],
    },
    {
      icon: Phone,
      title: "Ongoing Support",
      description: "Year-round assistance with claims, renewals, and any insurance-related questions.",
      features: ["Claims Assistance", "Renewal Guidance", "24/7 Support", "Policy Updates"],
    },
    {
      icon: Calculator,
      title: "Cost Optimization",
      description: "Find the most cost-effective plans while maintaining the coverage you need.",
      features: ["Subsidy Calculation", "Cost Projections", "Savings Analysis", "Budget Planning"],
    },
  ]

  return (
    <section id="services" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Comprehensive Insurance Services</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            From ACA marketplace plans to Medicare coverage, I provide expert guidance to help you navigate the complex
            world of health insurance.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-lg transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <service.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-gray-600">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center text-sm text-gray-600">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-3" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button variant="outline" className="w-full">
                    Learn More
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
