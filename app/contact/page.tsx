"use client";

import Script from "next/script";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import { Button } from "@/components/ui/button";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Phone,
  Mail,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import ContactForm from "@/components/contact-form";

export default function Contact() {
  const { language } = useLanguage();
  const t = translations[language].contact.form;

  return (
    <>
      <section id="contact" className="py-16 lg:py-20 bg-gray-50">
        <div className="container mx-auto px-4 mt-3">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {translations[language].contact.info.title}
            </h2>
            <p className="text-lg text-gray-600">
              {translations[language].contact.info.phone.description}
            </p>
          </div>

          <div className="max-w-3xl mx-auto mb-16 bg-white p-6 rounded-xl shadow-lg text-center space-y-6">
            <div className="flex flex-col items-center">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_150,h_150,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                alt="Isaac Orraiz"
                width={150}
                height={150}
                className="rounded-full border-4"
              />
              <h3 className="text-2xl font-bold mt-4 text-gray-800">
                Isaac Orraiz
              </h3>
              <p className="text-sm text-gray-500">
                {translations[language].contact.info.role}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <a
                href={`tel:${t.phone}`}
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90"
              >
                📞 {translations[language].contact.info.call}
              </a>
              <a
                href="mailto:info@isaacplans.com"
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90"
              >
                ✉️ Email
              </a>
              <a
                href="https://wa.me/15406813507?text=Hola,%20quiero%20una%20cotización"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90 flex items-center space-x-2 justify-center"
              >
                <img
                  src="https://res.cloudinary.com/isaacdev/image/upload/w_30,h_30,c_fit,f_auto,q_auto/v1752687249/whatsapphappiness_lezt21_zsxlic.png"
                  alt="WhatsApp"
                  className="w-7 h-7"
                />
                <span>WhatsApp: 540-681-3507</span>
              </a>
              <a
                href="/isaac-orraiz.vcf"
                download
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90"
              >
                📲 {translations[language].contact.info.addContact}
              </a>
              <a
                href="https://www.isaacplans.com"
                target="_blank"
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90"
              >
                🌐 Website
              </a>
              <a
                href="https://link.agent-crm.com/widget/bookings/facebookad-b140f360-1a9d-4b4b-9fb1-0359979187d4-4c57e0d9-1b03-4305-935e-1369bd466bc1"
                target="_blank"
                className="bg-custom text-white py-2 px-4 rounded-lg hover:bg-custom/90"
              >
                📅 Schedule
              </a>
            </div>

            <div className="flex justify-center space-x-6 mt-4">
              <Link href="https://www.facebook.com/@isaacagent" target="_blank">
                <Facebook className="text-custom w-6 h-6" />
              </Link>
              <Link href="https://www.instagram.com/isalexoc" target="_blank">
                <Instagram className="text-custom w-6 h-6" />
              </Link>
              <Link href="https://www.youtube.com/@isaacplans" target="_blank">
                <Youtube className="text-custom w-6 h-6" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/isaacplans"
                target="_blank"
              >
                <Linkedin className="text-custom w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactForm />
    </>
  );
}
