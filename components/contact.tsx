"use client";

import type React from "react";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, MapPin, Clock, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";

export function Contact() {
  const { language } = useLanguage();
  const t = translations[language];

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    insuranceType: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
  };

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
  ];

  return (
    <section
      id="contact"
      className="py-16 lg:py-20 bg-gray-50 overflow-x-hidden"
    >
      <div className="container mx-auto px-4 max-w-full">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 lg:mb-16 overflow-x-hidden"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {t.contact.title}
          </h2>
          <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
            {t.contact.subtitle}
          </p>
        </motion.div>

        {/* Form & Info Grid */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-full">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="overflow-x-hidden"
          >
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl lg:text-2xl">
                  {t.contact.form.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleSubmit}
                  className="space-y-4 lg:space-y-6"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm lg:text-base">
                        {t.contact.form.name}
                      </Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        className="text-sm lg:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm lg:text-base">
                        {t.contact.form.email}
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="text-sm lg:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm lg:text-base">
                        {t.contact.form.phone}
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="text-sm lg:text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="insurance-type"
                        className="text-sm lg:text-base"
                      >
                        {t.contact.form.insuranceType}
                      </Label>
                      <Select
                        onValueChange={(value) =>
                          setFormData({ ...formData, insuranceType: value })
                        }
                      >
                        <SelectTrigger className="text-sm lg:text-base">
                          <SelectValue
                            placeholder={
                              language === "es"
                                ? "Seleccione tipo de seguro"
                                : "Select insurance type"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aca">
                            {t.contact.form.types.aca}
                          </SelectItem>
                          <SelectItem value="medicare">
                            {t.contact.form.types.medicare}
                          </SelectItem>
                          <SelectItem value="family">
                            {t.contact.form.types.family}
                          </SelectItem>
                          <SelectItem value="individual">
                            {t.contact.form.types.individual}
                          </SelectItem>
                          <SelectItem value="other">
                            {t.contact.form.types.other}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-sm lg:text-base">
                      {t.contact.form.message}
                    </Label>
                    <Textarea
                      id="message"
                      placeholder={t.contact.form.messagePlaceholder}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      rows={4}
                      className="text-sm lg:text-base"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-base lg:text-lg py-3"
                  >
                    <Send className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    {t.contact.form.submit}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 lg:space-y-8 overflow-x-hidden"
          >
            <div>
              <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-4 lg:mb-6">
                {t.contact.info.title}
              </h3>
              <p className="text-gray-600 mb-6 lg:mb-8">
                {t.contact.info.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-4 lg:gap-6 justify-center">
              {contactInfo.map((info, index) => (
                <motion.div
                  key={info.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(50%-0.75rem)] xl:w-[calc(45%-0.75rem)] max-w-full"
                >
                  <Card className="p-4 lg:p-6 hover:shadow-md transition-shadow h-full">
                    <div className="flex items-start space-x-3 lg:space-x-4">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <info.icon className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm lg:text-base">
                          {info.title}
                        </h4>
                        <p className="text-base lg:text-lg font-medium text-green-600 mb-1 break-words">
                          {info.details}
                        </p>
                        <p className="text-xs lg:text-sm text-gray-600">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            <Card className="bg-green-600 text-white p-4 lg:p-6">
              <CardContent className="p-0">
                <h4 className="text-lg lg:text-xl font-bold mb-2">
                  {t.contact.info.cta.title}
                </h4>
                <p className="mb-4 opacity-90 text-sm lg:text-base">
                  {t.contact.info.cta.description}
                </p>
                <Button
                  variant="secondary"
                  className="bg-white text-green-600 hover:bg-gray-100 text-sm lg:text-base"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  {t.contact.info.cta.button}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
