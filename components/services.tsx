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
  { key: "iul", icon: Users, link: "/iul" },
  { key: "finalExpense", icon: TriangleAlert, link: "/final-expense" },
  { key: "shortTermMedical", icon: Heart, link: "/short-term-medical" },
] as const;

/* ------------------------------------------------------------------------- */
export default async function Services() {
  /* points to messages/en|es/services.json */
  const t = await getTranslations("HomePage.services");

  return (
    <section
      id="services"
      className="relative py-16 lg:py-24 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Heading */}
        <div className="text-center mb-12 lg:mb-16 animate-fadeUp">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            {t("title")}
          </h2>
          <p className="text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Service cards */}
        <div
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
          role="list"
          aria-label="Insurance services list"
        >
          {serviceMap.map(({ key, icon: Icon, link }, idx) => {
            const base = `items.${key}` as const;
            const serviceTitle = t(`${base}.title`);

            /* next-intl can return non-string values via `.raw`  */
            const features = t.raw(`${base}.features`);

            return (
              <article
                key={key}
                className="animate-fadeUp"
                style={{ animationDelay: `${idx * 0.1}s` }}
                role="listitem"
              >
                <Card
                  className="h-full flex flex-col justify-between bg-white/95 backdrop-blur-sm
                             border border-gray-200/60 shadow-lg hover:shadow-2xl
                             transition-all duration-300 hover:-translate-y-2 hover:border-[hsl(var(--custom)/0.3)]
                             focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
                >
                  <CardHeader className="pb-4">
                    <div
                      className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)]
                                 rounded-xl flex items-center justify-center mb-4 lg:mb-5
                                 shadow-md shadow-[hsl(var(--custom)/0.2)]"
                    >
                      <Icon
                        className="w-6 h-6 lg:w-7 lg:h-7 text-[hsl(var(--custom))]"
                        aria-hidden="true"
                      />
                    </div>
                    <CardTitle className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                      {serviceTitle}
                    </CardTitle>
                    <CardDescription className="text-gray-700 text-sm lg:text-base leading-relaxed">
                      {t(`${base}.description`)}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col flex-1 justify-between">
                    <ul
                      className="space-y-3 mb-6 lg:mb-8"
                      aria-label={`${serviceTitle} features`}
                    >
                      {features.map((feature: string, featureIdx: number) => (
                        <li
                          key={`${key}-feature-${featureIdx}`}
                          className="flex items-start text-sm lg:text-base text-gray-700"
                        >
                          <span
                            className="w-2 h-2 bg-[hsl(var(--custom))] rounded-full mr-3 mt-2 shrink-0
                                       shadow-sm shadow-[hsl(var(--custom)/0.3)]"
                            aria-hidden="true"
                          />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {link && (
                      <div className="mt-auto pt-4 border-t border-gray-100">
                        <Button
                          asChild
                          variant="outline"
                          className="w-full border-2 border-[hsl(var(--custom)/0.3)] 
                                     text-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.1)]
                                     hover:border-[hsl(var(--custom))] transition-all duration-300
                                     font-semibold"
                        >
                          <Link
                            href={link}
                            title={`Learn more about ${serviceTitle}`}
                            aria-label={`Learn more about ${serviceTitle}`}
                          >
                            {t("ctaLearnMore", { defaultValue: "Learn More" })}
                            <span className="sr-only">: {serviceTitle}</span>
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </article>
            );
          })}
        </div>

        {/* CTA row */}
        <div
          className="animate-fadeUp mt-12 lg:mt-16"
          style={{ animationDelay: "0.6s" }}
        >
          <CTAButton />
        </div>
      </div>
    </section>
  );
}
