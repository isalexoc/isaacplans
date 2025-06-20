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
import { useLanguage } from "@/hooks/useLanguage"
import { translations } from "@/lib/translations"

export function Contact() {
  const { language } = useLanguage()
  const t = translations[language]

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
      title: t.contact.info.phone.title,
      details: t.contact.info.phone.details,
      description: t.contact.info.phone.description,
    },
    {
      icon: Mail,
      title: t.contact.info.email.title,
      details: t.contact.info.email.details,
      description: t.contact.info.email.description,
    },
    {
      icon: MapPin,
      title: t.contact.info.coverage.title,
      details: t.contact.info.coverage.details,
      description: t.contact.info.coverage.description,
    },
    {
      icon: Clock,
      title: t.contact.info.hours.title,
      details: t.contact.info.hours.details,
      description: t.contact.info.hours.description,
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
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">{t.contact.title}</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">{t.contact.subtitle}</p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, x: -50 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">{t.contact.form.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t.contact.form.name}</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t.contact.form.email}</Label>
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
                      <Label htmlFor="phone">{t.contact.form.phone}</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance-type">{t.contact.form.insuranceType}</Label>
                      <Select onValueChange={(value) => setFormData({ ...formData, insuranceType: value })}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={language === "es" ? "Seleccione tipo de seguro" : "Select insurance type"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aca">{t.contact.form.types.aca}</SelectItem>
                          <SelectItem value="medicare">{t.contact.form.types.medicare}</SelectItem>
                          <SelectItem value="family">{t.contact.form.types.family}</SelectItem>
                          <SelectItem value="individual">{t.contact.form.types.individual}</SelectItem>
                          <SelectItem value="other">{t.contact.form.types.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">{t.contact.form.message}</Label>
                    <Textarea
                      id="message"
                      placeholder={t.contact.form.messagePlaceholder}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-lg py-3">
                    <Send className="w-5 h-5 mr-2" />
                    {t.contact.form.submit}
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
              <h3 className="text-2xl font-bold text-gray-900 mb-6">{t.contact.info.title}</h3>
              <p className="text-gray-600 mb-8">{t.contact.info.description}</p>
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
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <info.icon className="w-6 h-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1">{info.title}</h4>
                        <p className="text-lg font-medium text-green-600 mb-1">{info.details}</p>
                        <p className="text-sm text-gray-600">{info.description}</p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Call to Action */}
            <Card className="bg-green-600 text-white p-6">
              <CardContent className="p-0">
                <h4 className="text-xl font-bold mb-2">{t.contact.info.cta.title}</h4>
                <p className="mb-4 opacity-90">{t.contact.info.cta.description}</p>
                <Button variant="secondary" className="bg-white text-green-600 hover:bg-gray-100">
                  <Phone className="w-4 h-4 mr-2" />
                  {t.contact.info.cta.button}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
