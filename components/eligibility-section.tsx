/* components/eligibility-section.tsx */
import Image from "next/image";
import clsx from "clsx";
import { CheckCircle } from "lucide-react";

interface EligibilitySectionProps {
  /** main headline (JSX allowed for bold spans / breaks) */
  title: React.ReactNode;
  /** short intro text before the list */
  intro: string;
  /** bullet list requirements */
  bullets: string[];
  /** note or paragraph after the list */
  note?: string;
  /** Cloudinary public ID for the photo */
  imagePublicId: string;
  /** "left" (default) or "right" */
  imagePosition?: "left" | "right";
}

export default function EligibilitySection({
  title,
  intro,
  bullets,
  note,
  imagePublicId,
  imagePosition = "left",
}: EligibilitySectionProps) {
  const isLeft = imagePosition === "left";
  const imgUrl = `https://res.cloudinary.com/isaacdev/image/upload/f_auto,q_auto,w_600,c_fill,g_auto/${imagePublicId}.png`;

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
          { "lg:flex-row-reverse": !isLeft }
        )}
      >
        {/* ───────── image (≈ 1/3) ───────── */}
        <div className="w-full lg:w-1/3 flex justify-center animate-fadeUp">
          <div className="relative group w-full max-w-md">
            {/* Decorative gradient behind image */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] via-transparent to-[hsl(var(--custom)/0.1)] 
                         rounded-2xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
              aria-hidden="true"
            />
            <div className="relative w-full aspect-[4/3]">
              <Image
                src={imgUrl}
                alt="Eligibility visual"
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

        {/* ───────── text (≈ 2/3) ───────── */}
        <div className="w-full lg:w-2/3 max-w-2xl animate-fadeUp" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
            {title}
          </h2>

          {/* underline */}
          <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] 
                          my-6 rounded-full shadow-md shadow-[hsl(var(--custom)/0.3)]" />

          <p className="text-gray-700 dark:text-gray-300 text-lg lg:text-xl mb-8 leading-relaxed">
            {intro}
          </p>

          <ul
            className="space-y-4 mb-8"
            role="list"
            aria-label="Eligibility requirements"
          >
            {bullets.map((item, idx) => (
              <li
                key={`eligibility-${idx}`}
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
                         rounded-r-lg p-4 shadow-sm"
              role="note"
            >
              <p className="text-gray-700 dark:text-gray-300 text-base lg:text-lg leading-relaxed">
                {note}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
