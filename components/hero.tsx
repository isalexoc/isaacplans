"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, Users, Award } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { useLanguage } from "@/hooks/useLanguage";
import { translations } from "@/lib/translations";

export function Hero() {
  const { language } = useLanguage();
  const t = translations[language];

  return (
    <section
      id="home"
      /* subtle brand-tinted backdrop */
      className="
        pt-16
        bg-gradient-to-br
        from-[hsl(var(--custom)/0.06)]
        to-[hsl(var(--custom)/0.16)]
        min-h-screen
        flex items-center
      "
    >
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* ─────────── Text Content ─────────── */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6 lg:space-y-8 order-1"
          >
            {/* badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="
                inline-flex items-center space-x-2
                bg-custom/10 text-custom
                px-4 py-2 rounded-full text-sm font-medium
              "
            >
              <Award className="w-4 h-4" />
              <span>{t.hero.badge}</span>
            </motion.div>

            {/* hero headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              <span className="text-custom block text-2xl sm:text-3xl lg:text-5xl mb-2">
                {t.hero.name}
              </span>
              {t.hero.title}
              <span className="text-custom block">{t.hero.subtitle}</span>
            </h1>

            {/* description */}
            <p className="text-lg lg:text-xl text-gray-600 leading-relaxed">
              {t.hero.description}
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-custom text-custom-foreground hover:bg-custom/90 text-lg px-8 py-3"
                onClick={() => {
                  const el = document.getElementById("contact");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {t.hero.cta1}
              </Button>
            </div>

            {/* stats */}
            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-gray-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-custom">9+</div>
                <div className="text-sm text-gray-600">
                  {t.hero.stats.states}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-custom">100%</div>
                <div className="text-sm text-gray-600">
                  {t.hero.stats.clients}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-custom">100%</div>
                <div className="text-sm text-gray-600">
                  {t.hero.stats.satisfaction}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─────────── Image / Badges ─────────── */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative order-2"
          >
            <div className="relative max-w-md mx-auto">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_600,c_fill,g_face/isaacpic_c8kca5.png"
                alt="Isaac Orraiz - Agente de Seguros Profesional"
                width={500}
                height={600}
                className="rounded-2xl shadow-2xl w-full h-auto object-cover"
                priority
              />

              {/* desktop floating cards */}
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

              {/* mobile badges */}
              <div className="lg:hidden mt-6 grid grid-cols-2 gap-3">
                <Card className="p-3 bg-white shadow-md">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5 text-custom" />
                    <div>
                      <div className="font-semibold text-xs">
                        ACA Certificado
                      </div>
                      <div className="text-xs text-gray-600">
                        Cobertura Experta
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="p-3 bg-white shadow-md">
                  <div className="flex items-center space-x-2">
                    <Users className="w-5 h-5 text-custom" />
                    <div>
                      <div className="font-semibold text-xs">
                        Especialista Medicare
                      </div>
                      <div className="text-xs text-gray-600">
                        Todos los Planes
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
