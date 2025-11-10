/* components/plan-tiers-section.tsx */
import { Dot, ArrowRight } from "lucide-react";
import clsx from "clsx";

type Tier = {
  name: string;
  color: string; // hex or Tailwind class (e.g. "#cd7f32" or "text-yellow-500")
  bullets: string[];
};

interface PlanTiersProps {
  title: React.ReactNode;
  intro: string;
  tiers: Tier[];
}

export default function PlanTiersSection({
  title,
  intro,
  tiers,
}: PlanTiersProps) {
  return (
    <section
      className="relative py-16 lg:py-24 bg-white dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto text-center w-full max-w-7xl relative z-10">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white leading-tight">
          {title}
        </h2>
        <div className="h-1.5 w-24 bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.6)] 
                        mx-auto my-6 rounded-full shadow-md shadow-[hsl(var(--custom)/0.3)]" />
        <p className="text-gray-700 dark:text-gray-300 text-lg lg:text-xl mb-12 lg:mb-16 max-w-4xl mx-auto leading-relaxed">
          {intro}
        </p>

        {/* grid */}
        <div
          className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4"
          role="list"
          aria-label="Insurance plan tiers"
        >
          {tiers.map((tier, idx) => (
            <article
              key={`tier-${idx}`}
              className={clsx(
                "relative bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 rounded-2xl shadow-lg p-6 lg:p-8 text-left",
                "border-2",
                "hover:shadow-2xl hover:-translate-y-1 transition-all duration-300",
                "focus-within:ring-2 focus-within:ring-offset-2",
                "animate-fadeUp"
              )}
              style={{
                borderColor: tier.color,
                animationDelay: `${idx * 0.1}s`,
              }}
              role="listitem"
            >
              {/* Decorative gradient accent at top */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
                style={{
                  background: `linear-gradient(to right, ${tier.color}80, ${tier.color}40, ${tier.color}80)`,
                }}
                aria-hidden="true"
              />

              <h3
                className="text-xl lg:text-2xl font-bold mb-6 lg:mb-8 text-center text-gray-900 dark:text-white"
                style={{ color: tier.color }}
              >
                {tier.name}
              </h3>

              <ul
                className="space-y-3 lg:space-y-4"
                role="list"
                aria-label={`${tier.name} features`}
              >
                {tier.bullets.map((b, bulletIdx) => (
                  <li
                    key={`bullet-${idx}-${bulletIdx}`}
                    className="flex items-start gap-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg p-3
                               hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors duration-200"
                    role="listitem"
                  >
                    <div
                      className="p-1 rounded-md shrink-0 mt-0.5"
                      style={{ backgroundColor: `${tier.color}20` }}
                    >
                      <ArrowRight
                        className="w-5 h-5 lg:w-6 lg:h-6"
                        style={{ color: tier.color }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-sm lg:text-base text-gray-800 dark:text-gray-200 leading-relaxed pt-0.5">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
