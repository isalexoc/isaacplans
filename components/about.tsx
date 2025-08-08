// components/About.tsx  – server component
import Image from "next/image";
import { Award, Users, Clock, GraduationCap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";

/* Achievements + icons map --------------------------------------------- */
const ACHIEVEMENTS = [
  { slug: "states", Icon: Award },
  { slug: "clients", Icon: Users },
  { slug: "experience", Icon: Clock },
  { slug: "education", Icon: GraduationCap },
] as const;

/* ---------------------------------------------------------------------- */
export default async function About() {
  const t = await getTranslations("HomePage.profile");
  const states = process.env.NEXT_PUBLIC_STATES ?? "9";

  const certs: string[] = t.raw("certs");
  const subtitle1 = t("description1", { states });
  const subtitle2 = t("description2");

  return (
    <section id="about" className="py-16 lg:py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* ── Text column ───────────────────────────────────────────── */}
          <div className="space-y-6 lg:space-y-8 order-1 animate-fadeUp">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 lg:mb-6">
                {t("title")}
              </h2>

              <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
                {subtitle1}
              </p>
              <p className="text-base lg:text-lg text-gray-700 leading-relaxed">
                {subtitle2}
              </p>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-3 lg:mb-4">
                {t("certifications")}
              </h3>

              <div className="flex flex-wrap gap-2">
                {certs.map((cert) => (
                  <Badge
                    key={cert}
                    variant="secondary"
                    className="bg-custom-light text-custom-dark"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* ── Images & achievements ────────────────────────────────── */}
          <div
            className="space-y-6 order-2 animate-fadeUp"
            style={{ animationDelay: "0.15s" }}
          >
            <div className="relative mb-6 lg:mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6 place-items-center">
              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_350/ChatGPT_Image_Jul_11_2025_12_32_22_AM_ym5ioh.png"
                alt="Isaac Plans logo"
                width={350}
                height={350}
                className="rounded-xl shadow-lg w-full max-w-xs object-contain"
                priority
              />

              <Image
                src="https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_350,h_350,c_crop/pexels-pavel-danilyuk-8112186_epgbrd.png"
                alt="Healthcare concept"
                width={350}
                height={350}
                className="rounded-xl shadow-lg w-full max-w-xs object-cover"
                priority
              />
            </div>

            {/* Achievement cards */}
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              {ACHIEVEMENTS.map(({ slug, Icon }, idx) => (
                <div
                  key={slug}
                  className="animate-fadeUp"
                  style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
                >
                  <Card className="p-3 lg:p-4 text-center hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <Icon className="w-6 h-6 lg:w-8 lg:h-8 text-custom mx-auto mb-2 lg:mb-3" />
                      <h4 className="font-semibold text-xs lg:text-sm mb-1 lg:mb-2">
                        {t(`achievements.${slug}.title`, { states })}
                      </h4>
                      <p className="text-xs text-gray-700">
                        {t(`achievements.${slug}.description`)}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
