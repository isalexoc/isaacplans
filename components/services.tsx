// components/Services.tsx  – server component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BriefcaseMedical,
  Shield,
  Hospital,
  Users,
  TriangleAlert,
  Heart,
} from "lucide-react";
import CTAButton from "@/components/cta-button"; // client island
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

/* icon / slug config ------------------------------------------------------- */
const serviceMap = [
  { key: "aca", icon: BriefcaseMedical, link: "/aca" },
  { key: "dentalVision", icon: Shield, link: "/dental-vision" },
  { key: "hospitalIndemnity", icon: Hospital, link: "/hospital-indemnity" },
  { key: "lifeInsurance", icon: Users, link: "" },
  { key: "cancerPlans", icon: TriangleAlert, link: "" },
  { key: "heartStrokePlans", icon: Heart, link: "" },
] as const;

/* ------------------------------------------------------------------------- */
export default async function Services() {
  /* points to messages/en|es/services.json */
  const t = await getTranslations("HomePage.services");

  return (
    <section id="services" className="py-16 lg:py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center mb-12 lg:mb-16 animate-fadeUp">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
            {t("subtitle")}
          </p>
        </div>

        {/* Service cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {serviceMap.map(({ key, icon: Icon, link }, idx) => {
            const base = `items.${key}` as const;

            /* next-intl can return non-string values via `.raw`  */
            const features = t.raw(`${base}.features`);

            return (
              <div
                key={key}
                className="animate-fadeUp"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <Card className="h-full flex flex-col justify-between hover:shadow-lg transition-shadow duration-300">
                  <CardHeader className="pb-4">
                    <div className="w-10 h-10 lg:w-12 lg:h-12 bg-custom/10 rounded-lg flex items-center justify-center mb-3 lg:mb-4">
                      <Icon
                        className="w-5 h-5 lg:w-6 lg:h-6 text-custom"
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="text-lg lg:text-xl">
                      {t(`${base}.title`)}
                    </CardTitle>
                    <CardDescription className="text-gray-600 text-sm lg:text-base">
                      {t(`${base}.description`)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 justify-between">
                    <ul className="space-y-2 mb-4 lg:mb-6">
                      {features.map((feature: string) => (
                        <li
                          key={feature}
                          className="flex items-center text-sm text-gray-600"
                        >
                          <span className="w-1.5 h-1.5 bg-custom rounded-full mr-3 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {link && (
                      <div className="mt-auto pt-4">
                        <Button asChild variant="outline" className="w-full">
                          <Link href={link} aria-label={t(`${base}.title`)}>
                            {t("ctaLearnMore", { defaultValue: "Learn More" })}{" "}
                            {t(`${base}.title`)}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* CTA row */}
        <div
          className="animate-fadeUp mt-12"
          style={{ animationDelay: "0.6s" }}
        >
          <CTAButton />
        </div>
      </div>
    </section>
  );
}
