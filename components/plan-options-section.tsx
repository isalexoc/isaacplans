/* components/plan-options-section.tsx */
import clsx from "clsx";

type Option = {
  name: string;
  description: string;
};

interface PlanOptionsProps {
  title: string | React.ReactNode;
  options: Option[]; // ideally 2, 4, or 6 for even grid
}

export default function PlanOptionsSection({
  title,
  options,
}: PlanOptionsProps) {
  return (
    <section
      className="relative py-16 lg:py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50/80 
                 dark:bg-gray-950 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Decorative background elements */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[hsl(var(--custom)/0.05)] rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto text-center max-w-6xl relative z-10">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white mb-12 lg:mb-16 leading-tight">
          {title}
        </h2>

        <div
          className="grid gap-6 md:gap-8 md:grid-cols-2"
          role="list"
          aria-label="Plan options"
        >
          {options.map((opt, idx) => (
            <article
              key={`option-${idx}`}
              className={clsx(
                "relative rounded-2xl bg-white/95 backdrop-blur-sm dark:bg-gray-900/95",
                "shadow-lg border border-gray-200/60 dark:border-gray-700/60",
                "p-6 lg:p-8 text-left",
                "hover:shadow-2xl hover:-translate-y-1 transition-all duration-300",
                "focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2",
                "animate-fadeUp"
              )}
              style={{ animationDelay: `${idx * 0.1}s` }}
              role="listitem"
            >
              {/* Decorative gradient accent */}
              <div
                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--custom))] via-[hsl(var(--custom)/0.6)] to-[hsl(var(--custom))] rounded-t-2xl"
                aria-hidden="true"
              />

              <h3 className="text-xl lg:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                {opt.name}
              </h3>
              <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {opt.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
