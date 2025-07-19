"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import ContactForm from "@/components/contact-form";

export default function Contact() {
  const { language } = useLanguage();
  const t = translations[language].contact.info;

  return (
    <>
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {t.description}
          </p>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 space-y-6">
            <div className="flex flex-col items-center">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_150,h_150,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                alt="Isaac Orraiz"
                width={120}
                height={120}
                className="rounded-full shadow-md"
              />
              <h3 className="text-xl font-semibold mt-3 text-gray-800 dark:text-white">
                Isaac Orraiz
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t.role}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-white font-medium">
              <a
                href="tel:5404261804"
                className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
              >
                📞 {t.call}
              </a>
              <a
                href="mailto:info@isaacplans.com"
                className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
              >
                ✉️ Email
              </a>
              <a
                href="https://wa.me/15406813507?text=Hola,%20quiero%20una%20cotización"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-whatsapp hover:bg-whatsapp/90 rounded-lg py-3"
              >
                🟢 WhatsApp: 540-681-3507
              </a>
              <a
                href="/isaac-orraiz.vcf"
                download
                className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 rounded-lg py-3"
              >
                📲 {t.addContact}
              </a>
              <a
                href="https://www.isaacplans.com"
                target="_blank"
                className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 rounded-lg py-3"
              >
                🌐 Website
              </a>
              <a
                href="https://link.agent-crm.com/widget/bookings/facebookad-b140f360-1a9d-4b4b-9fb1-0359979187d4-4c57e0d9-1b03-4305-935e-1369bd466bc1"
                target="_blank"
                className="flex items-center justify-center gap-2 bg-brand hover:bg-brand/90 rounded-lg py-3"
              >
                📅 Schedule
              </a>
            </div>

            <div className="flex justify-center gap-6 mt-4 text-brand dark:text-accent">
              <Link href="https://www.facebook.com/@isaacagent" target="_blank">
                <Facebook className="w-6 h-6 hover:scale-110 transition" />
              </Link>
              <Link href="https://www.instagram.com/isalexoc" target="_blank">
                <Instagram className="w-6 h-6 hover:scale-110 transition" />
              </Link>
              <Link href="https://www.youtube.com/@isaacplans" target="_blank">
                <Youtube className="w-6 h-6 hover:scale-110 transition" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/isaacplans"
                target="_blank"
              >
                <Linkedin className="w-6 h-6 hover:scale-110 transition" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactForm />
    </>
  );
}
