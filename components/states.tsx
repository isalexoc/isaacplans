// components/Coverage.tsx  (server – no "use client")
import { MapPin, CheckCircle, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";
const STATES = process.env.NEXT_PUBLIC_STATES ?? "9";

export default async function Coverage() {
  const t = await getTranslations("HomePage.coverage");

  /* hydrate placeholders */
  const subtitle = t("subtitle", { states: STATES });
  const description = t("description");
  const featureLines = t
    .raw("features")
    .map((f: string) => f.replace("{{states}}", STATES));

  return (
    <section id="coverage" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Heading ----------------------------------------------------- */}
        <div className="text-center mb-16 animate-fadeUp">
          <div className="flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-custom mr-3" />
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              {t("title")}
            </h2>
          </div>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto">{subtitle}</p>
        </div>

        {/* Feature grid ------------------------------------------------ */}
        <div
          className="max-w-4xl mx-auto animate-fadeUp"
          style={{ animationDelay: "0.1s" }}
        >
          <div
            className="
              bg-gradient-to-br from-[hsl(var(--custom)/0.06)]
              to-[hsl(var(--custom)/0.16)]
              rounded-2xl p-6 sm:p-8 mb-12
            "
          >
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Isaac Orraiz
              </h3>
              <p className="text-lg text-gray-700">{description}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featureLines.map((line: string, idx: number) => (
                <div
                  key={line}
                  className="flex items-center bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow animate-fadeUp"
                  style={{ animationDelay: `${0.15 + idx * 0.05}s` }}
                >
                  <CheckCircle className="w-5 h-5 text-custom mr-3 shrink-0" />
                  <span className="text-sm font-medium text-gray-700 break-words">
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
            <Card
              className="
      border-0 shadow-xl overflow-hidden
      bg-white/95 backdrop-blur
      dark:bg-gray-900/95
    "
            >
              {/* Brand top bar for visual anchor */}
              <div className="h-2 w-full bg-[hsl(var(--custom))]" />

              <CardContent className="p-6 sm:p-10">
                <h4
                  id="cta-heading"
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight
                   text-gray-900 dark:text-white mb-3"
                >
                  {t("cta.heading")}
                </h4>

                <p className="text-base sm:text-lg text-gray-700 dark:text-gray-200 mb-8 max-w-2xl mx-auto">
                  {t("cta.text")}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center items-stretch">
                  {/* Primary: Call button (brand background, WCAG AA contrast on white text) */}
                  <a
                    href={`tel:${PHONE}`}
                    aria-label={`Call ${PHONE}`}
                    className="
    inline-flex items-center justify-center gap-2
    px-6 py-3 rounded-lg font-semibold text-lg
    bg-white text-gray-900
    border border-[hsl(var(--custom))]
    hover:bg-gray-50
    focus:outline-none focus-visible:ring-4
    focus-visible:ring-[hsl(var(--custom)/0.35)]
    focus-visible:ring-offset-2 focus-visible:ring-offset-white
    transition shadow-sm
  "
                  >
                    <span className="tabular-nums text-[hsl(var(--custom))]">
                      {PHONE}
                    </span>
                  </a>

                  {/* Secondary: Email button (high-contrast on both light/dark) */}
                  <a
                    href="mailto:info@isaacplans.com"
                    aria-label="Email info@isaacplans.com"
                    className="
            inline-flex items-center justify-center gap-2
            px-6 py-3 rounded-lg font-semibold
            text-gray-900 dark:text-white
            bg-white dark:bg-gray-800
            border border-gray-300 dark:border-gray-700
            hover:bg-gray-100 dark:hover:bg-gray-700
            focus:outline-none focus-visible:ring-4
            focus-visible:ring-[hsl(var(--custom)/0.35)]
            focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900
            transition
            shadow-sm w-full sm:w-auto
          "
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                    <span className="truncate">{t("cta.email")}</span>
                  </a>
                </div>

                {/* Small reassurance line to boost conversions */}
                <p className="mt-6 text-xs text-gray-600 dark:text-gray-300">
                  Response within business hours · Se habla Español
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
