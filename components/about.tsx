// components/About.tsx  – server component
import Image from "next/image";
import { Award, Users, Clock, GraduationCap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";
import { sanityFetch } from "@/sanity/lib/live";
import { type SanityDocument } from "next-sanity";
import StatesMap from "@/components/states-map";
import {
  LICENSED_STATES_LIST_QUERY,
  statesSanityFetchOptions,
} from "@/lib/licensed-states";

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
  
  // Fetch states from Sanity
  const statesResult = await sanityFetch({
    query: LICENSED_STATES_LIST_QUERY,
    ...statesSanityFetchOptions,
  });

  const states: SanityDocument[] = statesResult.data || [];
  const statesCount = states.length;
  const statesDisplay = String(statesCount);

  // Extract state names for display, with fallback to translations if Sanity is empty
  let certs: string[];
  if (states.length > 0) {
    certs = states.map((state: any) => state.name);
  } else {
    // Fallback to translations if no states found in Sanity
    certs = t.raw("certs") || [];
  }

  const subtitle1 = t("description1", { states: statesDisplay });
  const subtitle2 = t("description2");

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-gradient-to-b from-background via-muted/50 to-background py-16 lg:py-24 dark:via-muted/30"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* ── Text column ───────────────────────────────────────────── */}
          <div className="space-y-6 lg:space-y-8 order-1 animate-fadeLeft">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-50 sm:text-4xl lg:mb-8 lg:text-5xl">
                {t("title")}
              </h2>

              <div className="space-y-4">
                <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 lg:text-xl">
                  {subtitle1}
                </p>
                <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300 lg:text-xl">
                  {subtitle2}
                </p>
              </div>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-50 lg:mb-5 lg:text-2xl">
                {t("certifications")}
              </h3>

              <div
                className="flex flex-wrap gap-3"
                role="list"
                aria-label={t("certifications")}
              >
                {certs.map((cert) => (
                  <Badge
                    key={cert}
                    variant="secondary"
                    className="border-2 border-[hsl(var(--custom)/0.3)] bg-white/95 px-4 py-2 text-sm font-semibold
                               text-[hsl(var(--custom))] shadow-md backdrop-blur-sm transition-all duration-300
                               hover:-translate-y-0.5 hover:border-[hsl(var(--custom))] hover:shadow-lg
                               focus:ring-2 focus:ring-[hsl(var(--custom))] focus:ring-offset-2
                               dark:border-[hsl(var(--custom)/0.45)] dark:bg-gray-950/90"
                    role="listitem"
                  >
                    {cert}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* ── Images, Map & achievements ────────────────────────────────── */}
          <div
            className="space-y-6 lg:space-y-8 order-2 animate-fadeRight"
            style={{ animationDelay: "0.1s" }}
          >
            

            {/* States Map */}
            {states.length > 0 && (
              <div className="relative mb-6 lg:mb-8 animate-fadeUp" style={{ animationDelay: "0.2s" }}>
                <Card className="overflow-hidden border border-gray-200/60 bg-white/95 shadow-xl backdrop-blur-sm dark:border-gray-700/70 dark:bg-gray-950/95">
                  <CardContent className="p-4 lg:p-6">
                    <h3 className="mb-4 text-center text-xl font-semibold text-gray-900 dark:text-gray-50 lg:text-2xl">
                      {t("certifications")}
                    </h3>
                    <div className="overflow-hidden rounded-lg border-2 border-gray-200/60 dark:border-gray-700/70">
                      <StatesMap states={states} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Achievement cards */}
            <div
              className="grid grid-cols-2 gap-4 lg:gap-5"
              role="list"
              aria-label="Professional achievements"
            >
              {ACHIEVEMENTS.map(({ slug, Icon }, idx) => (
                <article
                  key={slug}
                  className="animate-fadeUp"
                  style={{ animationDelay: `${0.15 + idx * 0.1}s` }}
                  role="listitem"
                >
                  <Card
                    className="border border-gray-200/60 bg-white/95 p-4 text-center shadow-lg backdrop-blur-sm transition-all duration-300
                               hover:-translate-y-1 hover:border-[hsl(var(--custom)/0.3)] hover:shadow-2xl
                               focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2 dark:border-gray-700/70 dark:bg-gray-950/95 lg:p-5"
                  >
                    <CardContent className="p-0">
                      <div
                        className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)]
                                   rounded-xl flex items-center justify-center mx-auto mb-3 lg:mb-4
                                   shadow-md shadow-[hsl(var(--custom)/0.2)]"
                      >
                        <Icon
                          className="w-6 h-6 lg:w-7 lg:h-7 text-[hsl(var(--custom))]"
                          aria-hidden="true"
                        />
                      </div>
                      <h4 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-50 lg:text-base">
                        {t(`achievements.${slug}.title`, { states: statesDisplay })}
                      </h4>
                      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 lg:text-sm">
                        {t(`achievements.${slug}.description`)}
                      </p>
                    </CardContent>
                  </Card>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
