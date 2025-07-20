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
    <section className="py-24 bg-gray-50 dark:bg-gray-950 px-4">
      <div className="container mx-auto text-center w-full">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white">
          {title}
        </h2>
        <div className="h-1 w-24 bg-custom mx-auto my-4" />
        <p className="text-gray-700 dark:text-gray-300 text-lg mb-16  max-w-4xl mx-auto">
          {intro}
        </p>

        {/* grid */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={clsx(
                "bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8 text-left",
                "border-2",
                // ring on hover
                "hover:shadow-md transition-shadow"
              )}
              style={{ borderColor: tier.color }}
            >
              <h3 className="text-xl font-bold mb-6 text-center text-custom">
                {tier.name}
              </h3>

              <ul className="space-y-4">
                {tier.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <ArrowRight className="w-6 h-6 flex-shrink-0  text-custom" />
                    <span className="text-gray-800 dark:text-gray-200">
                      {b}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
