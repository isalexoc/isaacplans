// components/Coverage.tsx  (server – no "use client")
import { MapPin, CheckCircle, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getLicensedStateCount } from "@/lib/licensed-states";

const PHONE = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "540-426-1804";

export default async function Coverage() {
  const t = await getTranslations("HomePage.coverage");
  const states = String(await getLicensedStateCount());

  /* hydrate placeholders */
  const subtitle = t("subtitle", { states });
  const description = t("description");
  const featureLines = (t.raw("features") as string[]).map((f: string) =>
    f
      .replace("{{states}}", states)
      // Legacy copy (incl. curly apostrophe) — keep UI consistent if cache/old bundle serves old messages
      .replace(/Over\s+8\s+years['\u2019]\s+experience/gi, "10 years of experience")
  );

  return (
    <section
      id="coverage"
      className="relative overflow-hidden bg-gradient-to-b from-background via-muted/50 to-background py-16 lg:py-24 dark:via-muted/25"
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
        <div className="mb-12 animate-fadeUp text-center lg:mb-16">
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-xl bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)] p-3 shadow-md shadow-[hsl(var(--custom)/0.2)] dark:from-[hsl(var(--custom)/0.22)] dark:to-[hsl(var(--custom)/0.08)]">
              <MapPin
                className="h-8 w-8 text-[hsl(var(--custom))] lg:h-10 lg:w-10"
                aria-hidden="true"
              />
            </div>
            <h2 className="ml-4 text-3xl font-bold text-gray-900 dark:text-gray-50 sm:text-4xl lg:text-5xl">
              {t("title")}
            </h2>
          </div>
          <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-700 dark:text-gray-300 lg:text-xl">
            {subtitle}
          </p>
        </div>

        {/* Feature grid ------------------------------------------------ */}
        <div
          className="max-w-5xl mx-auto animate-fadeUp"
          style={{ animationDelay: "0.1s" }}
        >
          <div
            className="mb-12 rounded-3xl border border-[hsl(var(--custom)/0.2)] bg-gradient-to-br from-[hsl(var(--custom)/0.08)] via-[hsl(var(--custom)/0.04)] to-[hsl(var(--custom)/0.12)] p-6 shadow-xl dark:border-[hsl(var(--custom)/0.28)] dark:from-[hsl(var(--custom)/0.1)] dark:via-[hsl(var(--custom)/0.05)] dark:to-[hsl(var(--custom)/0.12)] sm:p-8 lg:p-10"
          >
            <div className="mb-8 text-center lg:mb-10">
              <h3 className="mb-4 text-2xl font-bold text-gray-900 dark:text-gray-50 lg:text-3xl">
                {t("name")}
              </h3>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-700 dark:text-gray-300 lg:text-xl">
                {description}
              </p>
            </div>

            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5"
              role="list"
              aria-label="Coverage features"
            >
              {featureLines.map((line: string, idx: number) => (
                <div
                  key={`feature-${idx}`}
                  className="flex animate-fadeUp items-start rounded-xl border border-gray-200/60 bg-white/95 p-4 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2 focus-within:ring-offset-background dark:border-gray-700/70 dark:bg-gray-950/90 lg:p-5"
                  role="listitem"
                  style={{ animationDelay: `${0.15 + idx * 0.05}s` }}
                >
                  <CheckCircle
                    className="mr-3 mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--custom))] lg:h-6 lg:w-6"
                    aria-hidden="true"
                  />
                  <span className="break-words text-sm font-medium leading-relaxed text-gray-700 dark:text-gray-300 lg:text-base">
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
            <Card className="overflow-hidden border border-border bg-white/95 shadow-2xl backdrop-blur-sm dark:border-gray-700/70 dark:bg-gray-950/95">
              {/* Brand top bar for visual anchor */}
              <div className="h-3 w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)]" />

              <CardContent className="p-6 sm:p-10 lg:p-12">
                <h4
                  id="cta-heading"
                  className="mb-4 text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-3xl lg:text-4xl"
                >
                  {t("cta.heading")}
                </h4>

                <p className="mx-auto mb-8 max-w-2xl text-base leading-relaxed text-gray-700 dark:text-gray-300 sm:text-lg lg:mb-10 lg:text-xl">
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
                               focus-visible:ring-offset-2 focus-visible:ring-offset-background
                               transition-all duration-300 hover:-translate-y-0.5"
                  >
                    <Phone className="w-5 h-5" aria-hidden="true" />
                    <span className="tabular-nums">{PHONE}</span>
                  </a>

                  {/* Secondary: Email button */}
                  <a
                    href="mailto:info@isaacplans.com"
                    aria-label={`Email ${t("cta.email")}`}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-xl border-2 border-[hsl(var(--custom)/0.3)] bg-white px-8 py-4 text-lg font-semibold text-gray-900 shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.1)] hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--custom)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-[hsl(var(--custom)/0.4)] dark:bg-gray-900/90 dark:text-gray-50 dark:hover:bg-[hsl(var(--custom)/0.12)] sm:w-auto"
                  >
                    <Mail className="h-5 w-5" aria-hidden="true" />
                    <span className="truncate">{t("cta.email")}</span>
                  </a>
                </div>

                {/* Small reassurance line to boost conversions */}
                <p className="mt-8 text-sm text-gray-600 dark:text-gray-400">
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
