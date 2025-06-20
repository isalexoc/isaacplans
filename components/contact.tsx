"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react"
import { motion } from "framer-motion"

export function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    insuranceType: "",
    message: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Handle form submission here
    console.log("Form submitted:", formData)
  }

  const contactInfo = [
    {
      icon: Phone,
      title: "Phone",
      details: "(555) 123-4567",
      description: "Call for immediate assistance",
    },
    {
      icon: Mail,
      title: "Email",
      details: "info@insureadvantage.com",
      description: "Send us your questions",
    },
    {
      icon: MapPin,
      title: "Service Area",
      details: "35+ States Nationwide",
      description: "Licensed across the US",
    },
    {
      icon: Clock,
      title: "Hours",
      details: "Mon-Fri 8AM-6PM",
      description: "Weekend appointments available",
    },
  ]

  return (
    <section id="contact" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Get Your Free Insurance Quote</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Ready to find the perfect insurance coverage? Contact me today for a personalized consultation and free
            quote tailored to your specific needs.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">Request Your Quote</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance-type">Insurance Type *</Label>
                      <Select onValueChange={(value) => setFormData({ ...formData, insuranceType: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select insurance type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aca">ACA Health Insurance</SelectItem>
                          <SelectItem value="medicare">Medicare Plans</SelectItem>
                          <SelectItem value="family">Family Coverage</SelectItem>
                          <SelectItem value="individual">Individual Plans</SelectItem>
                          <SelectItem value="other">Other / Not Sure</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell me about your insurance needs, current situation, or any specific questions you have..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3">
                    <Send className="w-5 h-5 mr-2" />
                    Get My Free Quote
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Get In Touch</h3>
              <p className="text-gray-600 mb-8">
                I'm here to help you navigate the insurance marketplace and find the coverage that's right for you.
                Don't hesitate to reach out with any questions.
              </p>
            </div>

            <div className="grid gap-6">
              {contactInfo.map((info, index) => (
                <motion.div
                  key={info.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <info.icon className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">{info.title}</h4>
                        <p className="text-lg font-medium text-blue-600 mb-1">{info.details}</p>
                        <p className="text-sm text-gray-600">{info.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Call to Action */}
            <Card className="bg-blue-600 text-white p-6">
              <CardContent className="p-0">
                <h4 className="text-xl font-bold mb-2">Ready to Get Started?</h4>
                <p className="mb-4 opacity-90">
                  Call now for immediate assistance or to schedule your free consultation.
                </p>
                <Button variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100">
                  <Phone className="w-4 h-4 mr-2" />
                  Call (555) 123-4567
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
