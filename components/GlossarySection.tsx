"use client";

import Image from "next/image";
import clsx from "clsx";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type GlossaryTerm = {
  term: string;
  definition: string;
};

interface GlossarySectionProps {
  label?: string;
  title: React.ReactNode;
  terms: GlossaryTerm[];
  imagePublicId?: string;
  imagePosition?: "left" | "right";
}

export default function GlossarySection({
  label,
  title,
  terms,
  imagePublicId,
  imagePosition = "left",
}: GlossarySectionProps) {
  const t = useTranslations("glossaryPage.glossarySection");
  const [showAll, setShowAll] = useState(false);
  const isLeft = imagePosition === "left";
  const imgUrl =
    imagePublicId &&
    `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_face/${imagePublicId}.png`;
  
  const initialCount = 3;
  const displayedTerms = showAll ? terms : terms.slice(0, initialCount);
  const hasMore = terms.length > initialCount;

  return (
    <section
      className="relative py-16 lg:py-24 bg-gradient-to-br from-[hsl(var(--custom)/0.06)] via-white to-[hsl(var(--custom)/0.04)] 
                 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16 relative z-10",
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ▸ Image block */}
        {imgUrl && (
          <div className="w-full lg:w-1/2 flex justify-center relative animate-fadeUp">
            <div className="absolute inset-0 -translate-x-4 translate-y-4 rounded-xl border-4 border-dashed border-gray-300 dark:border-gray-700" />
            <Image
              src={imgUrl}
              alt="Glossary visual"
              width={500}
              height={500}
              className="relative rounded-xl shadow-xl object-cover w-full max-w-md"
              priority
            />
          </div>
        )}

        {/* ▸ Glossary block */}
        <div className="w-full lg:w-1/2 max-w-xl mx-auto animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          {label && (
            <div
              className="inline-flex items-center bg-white/90 backdrop-blur-sm text-[hsl(var(--custom))] 
                         px-5 py-2.5 rounded-full text-sm font-semibold mb-6
                         shadow-lg shadow-[hsl(var(--custom)/0.2)] border border-[hsl(var(--custom)/0.2)]
                         hover:shadow-xl hover:shadow-[hsl(var(--custom)/0.3)] transition-all duration-300"
            >
              <span>{label}</span>
            </div>
          )}

          {/* Headline + blue separator */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
            {title}
          </h2>
          <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] 
                          mt-6 mb-10 rounded-full shadow-md shadow-[hsl(var(--custom)/0.3)]" />

          {/* Glossary Terms */}
          <div className="space-y-6">
            {displayedTerms.map((item, i) => (
              <div
                key={`term-${i}`}
                className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/60 
                           shadow-sm hover:shadow-md transition-all duration-300 px-6 py-5
                           hover:bg-white/80"
                role="article"
                aria-label={`Definition of ${item.term}`}
              >
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {item.term}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-base lg:text-lg">
                  {item.definition}
                </p>
              </div>
            ))}
          </div>
          
          {/* Show More / Show Less Button */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                onClick={() => setShowAll(!showAll)}
                variant="outline"
                className="group flex items-center gap-2 px-6 py-3 text-base font-semibold 
                         border-2 border-[hsl(var(--custom))] text-[hsl(var(--custom))] 
                         hover:bg-[hsl(var(--custom))] hover:text-white 
                         transition-all duration-300 rounded-full shadow-md hover:shadow-lg"
              >
                {showAll ? (
                  <>
                    {t("showLess")}
                    <ChevronDown className="w-5 h-5 rotate-180 transition-transform duration-300" />
                  </>
                ) : (
                  <>
                    {t("showMore")}
                    <ChevronDown className="w-5 h-5 transition-transform duration-300" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

