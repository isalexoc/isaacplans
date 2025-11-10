import Image from "next/image";
import clsx from "clsx";
import { CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { ExternalLink } from "lucide-react";

interface EnrollmentSectionProps {
  title: React.ReactNode;
  intro: string;
  steps: [string, string];
  subHeading: string;
  bullets: string[];
  note?: string;
  imagePublicId: string;
  imagePosition?: "left" | "right";
  cta: React.ReactNode;
  /** Call-to-action link (e.g. HealthSherpa URL) */
  href: string;
}

export default function EnrollmentSectionGeneric({
  title,
  intro,
  steps,
  subHeading,
  bullets,
  note,
  imagePublicId,
  imagePosition = "right",
  cta,
  href,
}: EnrollmentSectionProps) {
  const imgUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_auto/${imagePublicId}.png`;
  const isLeft = imagePosition === "left";

  return (
    <section
      className="relative py-16 lg:py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50/80 
                 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-25 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-20 right-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-[hsl(var(--custom)/0.08)] rounded-full blur-3xl" />
      </div>

      <div
        className={clsx(
          "container mx-auto flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-16 relative z-10",
          { "lg:flex-row-reverse": isLeft }
        )}
      >
        {/* Text Section */}
        <div className="w-full lg:w-2/3 max-w-2xl mx-auto animate-fadeUp">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
            {title}
          </h2>
          <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] 
                          my-6 rounded-full shadow-md shadow-[hsl(var(--custom)/0.3)]" />
          <p className="text-gray-700 dark:text-gray-300 text-lg lg:text-xl mb-8 leading-relaxed">
            {intro}
          </p>

          <ol
            className="space-y-4 mb-10"
            role="list"
            aria-label="Enrollment steps"
          >
            {steps.map((step, idx) => (
              <li
                key={`step-${idx}`}
                className="flex items-start gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-5
                           border border-gray-200/60 shadow-sm hover:shadow-md
                           transition-all duration-300 hover:-translate-y-0.5"
                role="listitem"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.8)] 
                                flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {idx + 1}
                </div>
                <div
                  className="text-base lg:text-lg text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5"
                  dangerouslySetInnerHTML={{ __html: step }}
                />
              </li>
            ))}
          </ol>

          <p className="font-bold text-xl lg:text-2xl mb-6 text-gray-900 dark:text-white">
            {subHeading}
          </p>
          <ul
            className="space-y-4 mb-8"
            role="list"
            aria-label="Enrollment benefits"
          >
            {bullets.map((item, idx) => (
              <li
                key={`bullet-${idx}`}
                className="flex items-start gap-4 bg-white/50 backdrop-blur-sm rounded-xl p-4
                           border border-gray-200/60 shadow-sm hover:shadow-md
                           transition-all duration-300 hover:-translate-y-0.5"
                role="listitem"
              >
                <div className="p-1.5 bg-gradient-to-br from-[hsl(var(--custom)/0.15)] to-[hsl(var(--custom)/0.1)] rounded-lg shrink-0">
                  <CheckCircle
                    className="w-5 h-5 lg:w-6 lg:h-6 text-[hsl(var(--custom))]"
                    aria-hidden="true"
                  />
                </div>
                <span className="text-base lg:text-lg text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5">
                  {item}
                </span>
              </li>
            ))}
          </ul>

          {note && (
            <div
              className="bg-[hsl(var(--custom)/0.06)] border-l-4 border-[hsl(var(--custom))] 
                         rounded-r-lg p-4 mb-10 shadow-sm italic"
              role="note"
            >
              <p className="text-gray-700 dark:text-gray-300 text-base lg:text-lg leading-relaxed">
                {note}
              </p>
            </div>
          )}

          <div className="flex justify-center lg:justify-start">
            <Button
              asChild
              size="lg"
              className="mt-2 w-full md:w-fit 
                         bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                         text-white font-semibold
                         shadow-lg hover:shadow-xl
                         transition-all duration-300 hover:-translate-y-0.5
                         focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
            >
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${cta} (opens in new tab)`}
                className="inline-flex items-center gap-2"
              >
                {cta}
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>

        {/* Image Section */}
        <div className="w-full lg:w-1/3 flex justify-center animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          <div className="relative group w-full max-w-sm">
            {/* Decorative gradient behind image */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] via-transparent to-[hsl(var(--custom)/0.1)] 
                         rounded-2xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
              aria-hidden="true"
            />
            <div className="relative w-full aspect-[3/4]">
              <Image
                src={imgUrl}
                alt="Enrollment visual"
                fill
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="rounded-2xl object-cover shadow-2xl border-4 border-white/50
                           group-hover:shadow-3xl transition-all duration-300"
                priority
                fetchPriority="high"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
