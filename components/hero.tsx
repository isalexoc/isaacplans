// components/hero/Hero.tsx
import Image from "next/image";
import { Shield, Users, Award } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import CTAButton from "@/components/cta-button"; // already client

export default async function Hero() {
  const t = await getTranslations("HomePage");

  return (
    <section
      id="home"
      className="bg-gradient-to-br from-[hsl(var(--custom)/0.06)] to-[hsl(var(--custom)/0.16)] min-h-screen flex items-center"
    >
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* ── Left column ───────────────────────────────────────────── */}
          <div className="space-y-6 lg:space-y-8 order-2 lg:order-1">
            {/* badge */}
            <div
              className="inline-flex items-center space-x-2 bg-custom-light text-custom
                            px-4 py-2 rounded-full text-sm font-medium
                            animate-fadeUp"
            >
              <Award className="w-4 h-4" />
              <span>{t("hero.badge")}</span>
            </div>

            {/* headline */}
            <h1
              className="text-3xl sm:text-4xl lg:text-6xl font-bold text-gray-900 leading-tight
                           animate-fadeLeft"
            >
              <span className="text-custom block text-xl sm:text-2xl lg:text-5xl mb-2">
                {t("hero.name")}
              </span>
              {t("hero.title")}
              <span className="text-custom block">{t("hero.subtitle")}</span>
            </h1>

            {/* description */}
            <p
              className="text-base sm:text-lg lg:text-xl text-gray-700 leading-relaxed
                          animate-fadeLeft-d2"
            >
              {t("hero.description")}
            </p>

            {/* CTA island (client) */}
            <div className="animate-fadeLeft-d4">
              <CTAButton />
            </div>

            {/* mobile portrait & feature cards */}
            <div className="lg:hidden flex justify-center animate-fadeLeft-d4">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_250,h_250,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                alt="Isaac Orraiz"
                width={250}
                height={250}
                className="rounded-full border-4 mt-6"
              />
            </div>

            <div className="lg:hidden mt-6 grid grid-cols-2 gap-3 animate-fadeLeft-d4">
              <FeatureCard
                icon={Shield}
                title={t("hero.onPicUp.title")}
                desc={t("hero.onPicUp.des")}
              />
              <FeatureCard
                icon={Users}
                title={t("hero.onPicDown.title")}
                desc={t("hero.onPicDown.des")}
              />
            </div>

            {/* stats */}
            <div
              className="grid grid-cols-3 gap-4 py-8 border-t border-gray-200
                            animate-fadeLeft-d4"
            >
              <Stat value="9+" label={t("hero.stats.states")} />
              <Stat value="100%" label={t("hero.stats.clients")} />
              <Stat value="100%" label={t("hero.stats.satisfaction")} />
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div
            className="relative order-1 lg:order-2
                          animate-fadeRight"
          >
            <div className="relative max-w-md mx-auto">
              <div className="hidden lg:block">
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_600,c_fill,g_face/isaacpic_c8kca5.png"
                  alt="Isaac Orraiz – Insurance Agent"
                  width={500}
                  height={600}
                  className="rounded-2xl shadow-2xl w-full h-auto object-cover"
                  priority
                />
              </div>

              {/* floating cards (no JS, same styles) */}
              <FloatingCard
                side="left"
                top="top-20"
                icon={Shield}
                title={t("hero.onPicUp.title")}
                desc={t("hero.onPicUp.des")}
                delay="animate-fadeUp-d2"
              />
              <FloatingCard
                side="right"
                top="bottom-20"
                icon={Users}
                title={t("hero.onPicDown.title")}
                desc={t("hero.onPicDown.des")}
                delay="animate-fadeUp-d4"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- little helpers (server) ---------- */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl sm:text-2xl font-bold text-custom">{value}</div>
      <div className="text-xs sm:text-sm text-gray-700">{label}</div>
    </div>
  );
}
function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <Card className="p-3 bg-white shadow-md">
      <div className="flex items-center space-x-2">
        <Icon className="w-5 h-5 text-custom" />
        <div>
          <div className="font-semibold text-xs">{title}</div>
          <div className="text-xs text-gray-700">{desc}</div>
        </div>
      </div>
    </Card>
  );
}
function FloatingCard({
  side,
  top,
  icon: Icon,
  title,
  desc,
  delay,
}: {
  side: "left" | "right";
  top: string;
  icon: any;
  title: string;
  desc: string;
  delay: string;
}) {
  const pos =
    side === "left"
      ? `hidden lg:block absolute -left-6 ${top}`
      : `hidden lg:block absolute -right-6 ${top}`;
  return (
    <div className={`${pos} ${delay}`}>
      <Card className="p-4 bg-white shadow-lg">
        <div className="flex items-center space-x-3">
          <Icon className="w-8 h-8 text-custom" />
          <div>
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-xs text-gray-700">{desc}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
