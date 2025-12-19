// components/hero/Hero.tsx
import Image from "next/image";
import { Shield, Users, Award } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import CTAButton from "@/components/cta-button"; // already client
import HeroRotatingCards from "@/components/hero-rotating-cards";

export default async function Hero() {
  const states = process.env.NEXT_PUBLIC_STATES ?? "12";
  const t = await getTranslations("HomePage");

  return (
    <section
      id="home"
      className="relative bg-gradient-to-br from-[hsl(var(--custom)/0.08)] via-[hsl(var(--custom)/0.04)] to-[hsl(var(--custom)/0.12)] min-h-screen flex items-center overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-10 w-72 h-72 bg-[hsl(var(--custom)/0.1)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center py-12 lg:py-20">
          {/* ── Left column ───────────────────────────────────────────── */}
          <div className="space-y-6 lg:space-y-8 order-2 lg:order-1">
            {/* badge */}
            <div
              className="inline-flex items-center space-x-2 bg-white/90 backdrop-blur-sm text-[hsl(var(--custom))] 
                            px-5 py-2.5 rounded-full text-sm font-semibold
                            shadow-lg shadow-[hsl(var(--custom)/0.2)] border border-[hsl(var(--custom)/0.2)]
                            animate-fadeUp hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)] transition-all duration-300
                            focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
              role="status"
              aria-label={t("hero.badge", { states })}
            >
              <Award className="w-4 h-4" aria-hidden="true" />
              <span>{t("hero.badge", { states })}</span>
            </div>

            {/* headline */}
            <h1
              className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 leading-[1.1] tracking-tight
                           animate-fadeLeft"
            >
              <span className="text-[hsl(var(--custom))] block text-2xl sm:text-3xl lg:text-6xl mb-3 font-extrabold">
                {t("hero.name")}
              </span>
              <span className="block mb-2">{t("hero.title")}</span>
              <span className="text-[hsl(var(--custom))] block text-2xl sm:text-3xl lg:text-6xl">
                {t("hero.subtitle")}
              </span>
            </h1>

            {/* description */}
            <p
              className="text-lg sm:text-xl lg:text-2xl text-gray-700 leading-relaxed max-w-2xl
                          animate-fadeLeft-d2"
            >
              {t("hero.description")}
            </p>

            {/* CTA island (client) */}
            <div className="animate-fadeLeft-d4 pt-2">
              <CTAButton />
            </div>

            {/* mobile portrait & feature cards */}
            <div className="lg:hidden flex justify-center animate-fadeLeft-d4 pt-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent rounded-full blur-2xl -z-10" />
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_500,c_thumb,g_face,r_max/isaacpic_c8kca5.jpg"
                  alt={t("hero.name")}
                  width={280}
                  height={280}
                  className="rounded-full border-4 border-white shadow-2xl object-cover"
                  priority
                  fetchPriority="high"
                />
              </div>
            </div>

            <div className="lg:hidden mt-8 grid grid-cols-2 gap-4 animate-fadeLeft-d4">
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
              className="grid grid-cols-3 gap-6 py-8 border-t border-gray-200/60
                            animate-fadeLeft-d4"
              role="region"
              aria-label={t("hero.stats.label")}
            >
              <Stat value={`${states}+`} label={t("hero.stats.states")} />
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
              {/* Decorative gradient behind image */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] via-transparent to-[hsl(var(--custom)/0.1)] rounded-3xl blur-3xl -z-10 transform scale-110"
                aria-hidden="true"
              />

              <div className="hidden lg:block relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-[hsl(var(--custom)/0.3)] to-transparent rounded-3xl blur-2xl opacity-50" />
                <Image
                  src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_500,h_600,c_fill,g_face/isaacpic_c8kca5.png"
                  alt={`${t("hero.name")} – ${t("hero.subtitle")}`}
                  width={500}
                  height={600}
                  className="relative rounded-3xl shadow-2xl w-full h-auto object-cover border-4 border-white/50"
                  priority
                  fetchPriority="high"
                />
              </div>

              {/* rotating floating cards */}
              <HeroRotatingCards
                side="left"
                top="-top-10"
                delay="animate-fadeUp-d2"
              />
              <HeroRotatingCards
                side="right"
                top="bottom-20"
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
    <div className="text-center group">
      <div
        className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[hsl(var(--custom))] mb-1 
                     transition-transform duration-300 group-hover:scale-110"
      >
        {value}
      </div>
      <div className="text-xs sm:text-sm text-gray-600 font-medium">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Card
      className="p-4 bg-white/95 backdrop-blur-sm shadow-lg hover:shadow-xl 
                   transition-all duration-300 hover:-translate-y-1 border border-gray-100
                   focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
    >
      <div className="flex items-start space-x-3">
        <div className="p-2 bg-[hsl(var(--custom)/0.1)] rounded-lg shrink-0">
          <Icon className="w-5 h-5 text-[hsl(var(--custom))]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-gray-900 mb-1">{title}</div>
          <div className="text-xs text-gray-600 leading-relaxed">{desc}</div>
        </div>
      </div>
    </Card>
  );
}

