// components/Coverage.tsx  (server – no "use client")
import { MapPin, CheckCircle, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";
const STATES = process.env.NEXT_PUBLIC_STATES ?? "12";

export default async function Coverage() {
  const t = await getTranslations("HomePage.coverage");

  /* hydrate placeholders */
  const subtitle = t("subtitle", { states: STATES });
  const description = t("description");
  const featureLines = t
    .raw("features")
    .map((f: string) => f.replace("{{states}}", STATES));

  return (
    <section
      id="coverage"
      className="relative py-16 lg:py-24 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Heading ----------------------------------------------------- */}
        <div className="text-center mb-12 lg:mb-16 animate-fadeUp">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)] rounded-xl shadow-md shadow-[hsl(var(--custom)/0.2)]">
              <MapPin
                className="w-8 h-8 lg:w-10 lg:h-10 text-[hsl(var(--custom))]"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 ml-4">
              {t("title")}
            </h2>
          </div>
          <p className="text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Feature grid ------------------------------------------------ */}
        <div
          className="max-w-5xl mx-auto animate-fadeUp"
          style={{ animationDelay: "0.1s" }}
        >
          <div
            className="bg-gradient-to-br from-[hsl(var(--custom)/0.08)] via-[hsl(var(--custom)/0.04)] to-[hsl(var(--custom)/0.12)]
                       rounded-3xl p-6 sm:p-8 lg:p-10 mb-12
                       border border-[hsl(var(--custom)/0.2)] shadow-xl"
          >
            <div className="text-center mb-8 lg:mb-10">
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">
                {t("name")}
              </h3>
              <p className="text-lg lg:text-xl text-gray-700 leading-relaxed max-w-2xl mx-auto">
                {description}
              </p>
            </div>

            <div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5"
              role="list"
              aria-label="Coverage features"
            >
              {featureLines.map((line: string, idx: number) => (
                <div
                  key={`feature-${idx}`}
                  className="flex items-start bg-white/95 backdrop-blur-sm rounded-xl p-4 lg:p-5
                             shadow-lg hover:shadow-xl border border-gray-200/60
                             transition-all duration-300 hover:-translate-y-1
                             animate-fadeUp focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
                  role="listitem"
                  style={{ animationDelay: `${0.15 + idx * 0.05}s` }}
                >
                  <CheckCircle
                    className="w-5 h-5 lg:w-6 lg:h-6 text-[hsl(var(--custom))] mr-3 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm lg:text-base font-medium text-gray-700 break-words leading-relaxed">
                    {line}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA card -------------------------------------------------- */}
          <div
            role="region"
            aria-labelledby="cta-heading"
            className="text-center px-2 animate-fadeUp"
            style={{ animationDelay: "0.7s" }}
          >
            <Card className="border-0 shadow-2xl overflow-hidden bg-white/95 backdrop-blur-sm">
              {/* Brand top bar for visual anchor */}
              <div className="h-3 w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)]" />

              <CardContent className="p-6 sm:p-10 lg:p-12">
                <h4
                  id="cta-heading"
                  className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight
                   text-gray-900 mb-4"
                >
                  {t("cta.heading")}
                </h4>

                <p className="text-base sm:text-lg lg:text-xl text-gray-700 mb-8 lg:mb-10 max-w-2xl mx-auto leading-relaxed">
                  {t("cta.text")}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-stretch">
                  {/* Primary: Call button */}
                  <a
                    href={`tel:${PHONE}`}
                    aria-label={`Call ${PHONE}`}
                    className="inline-flex items-center justify-center gap-3
                               px-8 py-4 rounded-xl font-bold text-lg
                               bg-[hsl(var(--custom))] text-white
                               shadow-lg hover:shadow-xl
                               hover:bg-[hsl(var(--custom)/0.9)]
                               focus:outline-none focus-visible:ring-4
                               focus-visible:ring-[hsl(var(--custom)/0.35)]
                               focus-visible:ring-offset-2
                               transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <Phone className="w-5 h-5" aria-hidden="true" />
                    <span className="tabular-nums">{PHONE}</span>
                  </a>

                  {/* Secondary: Email button */}
                  <a
                    href="mailto:info@isaacplans.com"
                    aria-label={`Email ${t("cta.email")}`}
                    className="inline-flex items-center justify-center gap-3
                               px-8 py-4 rounded-xl font-semibold text-lg
                               bg-white text-gray-900
                               border-2 border-[hsl(var(--custom)/0.3)]
                               hover:bg-[hsl(var(--custom)/0.1)]
                               hover:border-[hsl(var(--custom))]
                               focus:outline-none focus-visible:ring-4
                               focus-visible:ring-[hsl(var(--custom)/0.35)]
                               focus-visible:ring-offset-2
                               transition-all duration-300 hover:-translate-y-0.5
                               shadow-lg hover:shadow-xl w-full sm:w-auto"
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                    <span className="truncate">{t("cta.email")}</span>
                  </a>
                </div>

                {/* Small reassurance line to boost conversions */}
                <p className="mt-8 text-sm text-gray-600">
                  {t("cta.reassurance")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
