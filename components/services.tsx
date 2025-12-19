// components/Services.tsx  – server component
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BriefcaseMedical,
  Shield,
  Hospital,
  Users,
  TriangleAlert,
  Heart,
  ArrowRight,
} from "lucide-react";
import CTAButton from "@/components/cta-button"; // client island
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import Image from "next/image";

/* icon / slug config ------------------------------------------------------- */
const serviceMap = [
  { 
    key: "aca", 
    icon: BriefcaseMedical, 
    link: "/aca",
    imagePublicId: "tmpfs1tzoqj_1_qqzvsx"
  },
  { 
    key: "dentalVision", 
    icon: Shield, 
    link: "/dental-vision",
    imagePublicId: "tmp48ylol1v_1_ig0hto"
  },
  { 
    key: "hospitalIndemnity", 
    icon: Hospital, 
    link: "/hospital-indemnity",
    imagePublicId: "pexels-rdne-6129237_vbgahf_1_gfwx1z"
  },
  { 
    key: "iul", 
    icon: Users, 
    link: "/iul",
    imagePublicId: "pexels-victor-l-19338-2790434_1_pr9bng"
  },
  { 
    key: "finalExpense", 
    icon: TriangleAlert, 
    link: "/final-expense",
    imagePublicId: "feh2_orkuxu"
  },
  { 
    key: "shortTermMedical", 
    icon: Heart, 
    link: "/short-term-medical",
    imagePublicId: "pexels-chokniti-khongchum-1197604-3938022_bujifm"
  },
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
          {serviceMap.map(({ key, icon: Icon, link, imagePublicId }, idx) => {
            const base = `items.${key}` as const;
            const serviceTitle = t(`${base}.title`);

            /* next-intl can return non-string values via `.raw`  */
            const features = t.raw(`${base}.features`);

            // Cloudinary image URL with optimized settings
            const imageUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,h_400,c_fill,g_auto/${imagePublicId}`;

            return (
              <article
                key={key}
                className="animate-fadeUp"
                style={{ animationDelay: `${idx * 0.1}s` }}
                role="listitem"
              >
                <Link
                  href={link}
                  className="block h-full focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom))] focus:ring-offset-2 rounded-lg"
                  aria-label={`Learn more about ${serviceTitle}`}
                >
                  <Card
                    className="h-full flex flex-col justify-between bg-white/95 backdrop-blur-sm
                               border border-gray-200/60 shadow-lg hover:shadow-2xl
                               transition-all duration-300 hover:-translate-y-2 hover:border-[hsl(var(--custom)/0.3)]
                               overflow-hidden group cursor-pointer"
                  >
                  {/* Image Section */}
                  <div className="relative w-full h-48 lg:h-56 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
                    <Image
                      src={imageUrl}
                      alt={serviceTitle}
                      fill
                      className="object-cover object-center group-hover:scale-110 transition-transform duration-500 ease-out"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      priority={idx < 3}
                    />
                    {/* Gradient overlay for better text readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {/* Icon badge overlay */}
                    <div className="absolute top-4 right-4">
                      <div
                        className="w-12 h-12 lg:w-14 lg:h-14 bg-white/95 backdrop-blur-sm
                                   rounded-xl flex items-center justify-center
                                   shadow-lg shadow-black/20 border border-white/50
                                   group-hover:scale-110 transition-transform duration-300"
                      >
                        <Icon
                          className="w-6 h-6 lg:w-7 lg:h-7 text-[hsl(var(--custom))]"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  <CardHeader className="pb-4">
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

                    <div className="mt-auto pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-sm font-semibold text-[hsl(var(--custom))] group-hover:gap-2 transition-all duration-300">
                        <span>{t("ctaLearnMore", { defaultValue: "Learn More" })}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" aria-hidden="true" />
                      </div>
                    </div>
                  </CardContent>
                  </Card>
                </Link>
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
