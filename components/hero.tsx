"use client";

import { Card } from "@/components/ui/card";
import { Shield, Users, Award } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";
import { QuoteModal } from "@/components/form-modal";
import { useState } from "react";
import CTAButton from "@/components/cta-button";

export default function Hero() {
  const { language } = useLanguage();
  const t = translations[language];
  const [openModal, setOpenModal] = useState(false);

  return (
    <section
      id="home"
      className="bg-gradient-to-br from-[hsl(var(--custom)/0.06)] to-[hsl(var(--custom)/0.16)] min-h-screen flex items-center"
    >
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6 lg:space-y-8 order-2 lg:order-1"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center space-x-2 bg-custom/10 text-custom px-4 py-2 rounded-full text-sm font-medium"
            >
              <Award className="w-4 h-4" />
              <span>{t.hero.badge}</span>
            </motion.div>

            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
              <span className="text-custom block text-xl sm:text-2xl lg:text-5xl mb-2">
                {t.hero.name}
              </span>
              {t.hero.title}
              <span className="text-custom block">{t.hero.subtitle}</span>
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed">
              {t.hero.description}
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <CTAButton />
            </motion.div>

            <div className="lg:hidden flex justify-center">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_150,h_150,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                alt="Isaac Orraiz"
                width={150}
                height={150}
                className="rounded-full border-4 mt-6"
              />
            </div>

            <div className="lg:hidden mt-6 grid grid-cols-2 gap-3">
              <Card className="p-3 bg-white shadow-md">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-custom" />
                  <div>
                    <div className="font-semibold text-xs">
                      {t.hero.onPicUp.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {t.hero.onPicUp.des}
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-3 bg-white shadow-md">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-custom" />
                  <div>
                    <div className="font-semibold text-xs">
                      {t.hero.onPicDown.title}
                    </div>
                    <div className="text-xs text-gray-600">
                      {t.hero.onPicDown.des}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <motion.div
              className="grid grid-cols-3 gap-4 py-8 border-t border-gray-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-custom">
                  {process.env.NEXT_PUBLIC_STATES}+
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {t.hero.stats.states}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-custom">
                  100%
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {t.hero.stats.clients}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-custom">
                  100%
                </div>
                <div className="text-xs sm:text-sm text-gray-600">
                  {t.hero.stats.satisfaction}
                </div>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative order-1 lg:order-2"
          >
            <div className="relative max-w-md mx-auto">
              <div className="hidden lg:block">
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_600,c_fill,g_face/isaacpic_c8kca5.png"
                  alt="Isaac Orraiz - Agente de Seguros Profesional"
                  width={500}
                  height={600}
                  className="rounded-2xl shadow-2xl w-full h-auto object-cover"
                  priority
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="absolute -left-6 top-20 hidden lg:block"
              >
                <Card className="p-4 bg-white shadow-lg">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-8 h-8 text-custom" />
                    <div>
                      <div className="font-semibold text-sm">
                        {t.hero.onPicUp.title}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t.hero.onPicUp.des}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="absolute -right-6 bottom-20 hidden lg:block"
              >
                <Card className="p-4 bg-white shadow-lg">
                  <div className="flex items-center space-x-3">
                    <Users className="w-8 h-8 text-custom" />
                    <div>
                      <div className="font-semibold text-sm">
                        {t.hero.onPicDown.title}
                      </div>
                      <div className="text-xs text-gray-600">
                        {t.hero.onPicDown.des}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
      <QuoteModal open={openModal} setOpen={setOpenModal} />
    </section>
  );
}
