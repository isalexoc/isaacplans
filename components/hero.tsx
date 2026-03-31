// components/hero/Hero.tsx
import Image from "next/image";
import { Shield, Users, Award, Sparkles, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import CTAButton from "@/components/cta-button"; // already client
import HeroRotatingCards from "@/components/hero-rotating-cards";
import { getLicensedStateCount } from "@/lib/licensed-states";

export default async function Hero() {
  const states = String(await getLicensedStateCount());
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

            <div className="animate-fadeLeft-d4 pt-6">
              <div
                className="relative max-w-xl overflow-hidden rounded-2xl border border-[hsl(var(--custom)/0.22)] bg-gradient-to-br from-white via-white/95 to-[hsl(var(--custom)/0.07)] p-5 shadow-[0_8px_30px_-8px_rgba(14,165,233,0.2),0_0_0_1px_rgba(255,255,255,0.8)_inset] backdrop-blur-sm transition-shadow duration-300 hover:shadow-[0_12px_40px_-10px_rgba(14,165,233,0.28)] dark:border-[hsl(var(--custom)/0.28)] dark:from-slate-900/95 dark:via-slate-900/85 dark:to-[hsl(var(--custom)/0.12)] dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.35)] sm:p-6"
              >
                <div
                  className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-gradient-to-b from-[hsl(var(--custom))] via-sky-500 to-blue-600 opacity-90"
                  aria-hidden
                />
                <div className="relative flex flex-col gap-4 pl-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pl-5">
                  <div className="flex gap-4">
                    <span
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.06)] text-[hsl(var(--custom))] shadow-inner ring-1 ring-[hsl(var(--custom)/0.15)] dark:from-[hsl(var(--custom)/0.22)] dark:to-[hsl(var(--custom)/0.08)] dark:ring-[hsl(var(--custom)/0.2)]"
                      aria-hidden
                    >
                      <Sparkles className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--custom))] sm:text-xs">
                        {t("hero.getCoveredFast.kicker")}
                      </p>
                      <p className="mt-1.5 text-base font-medium leading-snug text-gray-800 dark:text-gray-100 sm:text-lg">
                        {t("hero.getCoveredFast.label")}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/get-covered-fast"
                    className="group/cta inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[hsl(var(--custom)/0.25)] transition-all duration-200 hover:from-[hsl(var(--custom)/0.92)] hover:to-blue-600/95 hover:shadow-lg hover:shadow-[hsl(var(--custom)/0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2 sm:w-auto sm:min-w-[11rem]"
                  >
                    {t("hero.getCoveredFast.cta")}
                    <ChevronRight
                      className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </div>
              </div>
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
              <Stat value={t("hero.stats.experienceValue")} label={t("hero.stats.experience")} />
              <Stat value={t("hero.stats.bilingualValue")} label={t("hero.stats.bilingual")} />
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

