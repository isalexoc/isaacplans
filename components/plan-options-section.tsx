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
    <section className="py-24 bg-gray-50 dark:bg-gray-950 px-4">
      <div className="container mx-auto text-center max-w-5xl">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white mb-16">
          {title}
        </h2>

        <div className="grid gap-8 md:grid-cols-2">
          {options.map((opt, idx) => (
            <div
              key={opt.name}
              className={clsx(
                "rounded-xl bg-white dark:bg-gray-900 shadow-sm p-8 text-left",
                "border border-gray-200 dark:border-gray-700"
              )}
            >
              <h3 className="text-lg font-bold mb-4 text-custom">{opt.name}</h3>
              <p className="text-gray-800 dark:text-gray-300 leading-relaxed">
                {opt.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
