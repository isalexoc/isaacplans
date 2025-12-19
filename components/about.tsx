// components/About.tsx  – server component
import Image from "next/image";
import { Award, Users, Clock, GraduationCap } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";
import { sanityFetch } from "@/sanity/lib/live";
import { type SanityDocument } from "next-sanity";
import StatesMap from "@/components/states-map";

/* Achievements + icons map --------------------------------------------- */
const ACHIEVEMENTS = [
  { slug: "states", Icon: Award },
  { slug: "clients", Icon: Users },
  { slug: "experience", Icon: Clock },
  { slug: "education", Icon: GraduationCap },
] as const;

/* States query ---------------------------------------------------------- */
const STATES_QUERY = `*[
  _type == "state"
  && active == true
]|order(order asc, name asc){
  _id,
  name,
  code,
  order
}`;

// ISR with 1 hour fallback - on-demand revalidation via webhook is preferred
const statesOptions = { 
  next: { 
    revalidate: 3600, // 1 hour fallback
    tags: ['states'] // Allows granular revalidation
  } 
};

/* ---------------------------------------------------------------------- */
export default async function About() {
  const t = await getTranslations("HomePage.profile");
  
  // Fetch states from Sanity
  const statesResult = await sanityFetch({ 
    query: STATES_QUERY, 
    ...statesOptions 
  });
  
  const states: SanityDocument[] = statesResult.data || [];
  const statesCount = states.length;
  const statesDisplay = process.env.NEXT_PUBLIC_STATES ?? String(statesCount);

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
      className="relative py-16 lg:py-24 bg-gradient-to-b from-white via-gray-50 to-white overflow-hidden"
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
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 lg:mb-8">
                {t("title")}
              </h2>

              <div className="space-y-4">
                <p className="text-lg lg:text-xl text-gray-700 leading-relaxed">
                  {subtitle1}
                </p>
                <p className="text-lg lg:text-xl text-gray-700 leading-relaxed">
                  {subtitle2}
                </p>
              </div>
            </div>

            {/* Certifications */}
            <div>
              <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4 lg:mb-5">
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
                    className="bg-white/95 backdrop-blur-sm border-2 border-[hsl(var(--custom)/0.3)] 
                               text-[hsl(var(--custom))] px-4 py-2 text-sm font-semibold
                               shadow-md hover:shadow-lg hover:border-[hsl(var(--custom))] 
                               transition-all duration-300 hover:-translate-y-0.5
                               focus:ring-2 focus:ring-[hsl(var(--custom))] focus:ring-offset-2"
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
                <Card className="bg-white/95 backdrop-blur-sm border border-gray-200/60 shadow-xl overflow-hidden">
                  <CardContent className="p-4 lg:p-6">
                    <h3 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4 text-center">
                      {t("certifications")}
                    </h3>
                    <div className="rounded-lg overflow-hidden border-2 border-gray-200/60">
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
                    className="p-4 lg:p-5 text-center bg-white/95 backdrop-blur-sm
                               border border-gray-200/60 shadow-lg hover:shadow-2xl
                               transition-all duration-300 hover:-translate-y-1 
                               hover:border-[hsl(var(--custom)/0.3)]
                               focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2"
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
                      <h4 className="font-bold text-sm lg:text-base mb-2 text-gray-900">
                        {t(`achievements.${slug}.title`, { states: statesDisplay })}
                      </h4>
                      <p className="text-xs lg:text-sm text-gray-600 leading-relaxed">
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
