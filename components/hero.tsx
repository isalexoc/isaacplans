"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Users, Award } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

export function Hero() {
  return (
    <section id="home" className="pt-16 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen flex items-center">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center space-x-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium"
              >
                <Award className="w-4 h-4" />
                <span>Certified in 35+ States</span>
              </motion.div>

              <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Your Trusted
                <span className="text-blue-600 block">Insurance Partner</span>
              </h1>

              <p className="text-xl text-gray-600 leading-relaxed">
                Specializing in ACA and Medicare insurance solutions. Get personalized coverage that fits your needs and
                budget with expert guidance every step of the way.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-3">
                Get Free Quote
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 py-3">
                Schedule Consultation
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">35+</div>
                <div className="text-sm text-gray-600">States Certified</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">1000+</div>
                <div className="text-sm text-gray-600">Clients Served</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">98%</div>
                <div className="text-sm text-gray-600">Satisfaction Rate</div>
              </div>
            </div>
          </motion.div>

          {/* Right Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="relative">
              <Image
                src="/placeholder.svg?height=600&width=500"
                alt="Professional Insurance Agent"
                width={500}
                height={600}
                className="rounded-2xl shadow-2xl"
              />

              {/* Floating Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute -left-6 top-20"
              >
                <Card className="p-4 bg-white shadow-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-8 h-8 text-green-600" />
                    <div>
                      <div className="font-semibold text-sm">ACA Certified</div>
                      <div className="text-xs text-gray-600">Expert Coverage</div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -right-6 bottom-20"
              >
                <Card className="p-4 bg-white shadow-lg">
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8 text-blue-600" />
                    <div>
                      <div className="font-semibold text-sm">Medicare Specialist</div>
                      <div className="text-xs text-gray-600">All Plans Available</div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
