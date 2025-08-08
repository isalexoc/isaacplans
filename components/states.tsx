// components/Coverage.tsx  (server – no "use client")
import { MapPin, CheckCircle } from "lucide-react";
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
            className="text-center px-2 animate-fadeUp"
            style={{ animationDelay: "0.7s" }}
          >
            <Card className="bg-custom text-custom-foreground p-6 sm:p-8">
              <CardContent className="p-0">
                <h4 className="text-2xl font-bold mb-4 text-custom-foreground">
                  {t("cta.heading")}
                </h4>
                <p className="text-lg mb-6 text-custom-foreground">
                  {t("cta.text")}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center">
                  <a
                    href={`tel:${PHONE}`}
                    className="bg-custom text-white px-6 py-3 rounded-lg font-semibold hover:bg-custom/90"
                  >
                    {PHONE}
                  </a>

                  <a
                    href="mailto:info@isaacplans.com"
                    className="bg-white text-custom hover:bg-gray-100
                               px-6 py-3 rounded-lg font-semibold
                               transition-colors w-full sm:w-auto truncate"
                  >
                    {t("cta.email")}
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
