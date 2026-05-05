"use client";

import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AppHref } from "@/i18n/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import * as Lucide from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "aca", href: "/aca/calendar" as const, icon: "Stethoscope" },
  { key: "dentalVision", href: "/dental-vision/calendar" as const, icon: "Eye" },
  {
    key: "hospitalIndemnity",
    href: "/hospital-indemnity/calendar" as const,
    icon: "Hospital",
  },
  {
    key: "finalExpense",
    href: "/final-expense/calendar" as const,
    icon: "Shield",
  },
  { key: "iul", href: "/iul/calendar" as const, icon: "HeartPulse" },
  {
    key: "shortTermMedical",
    href: "/short-term-medical/calendar" as const,
    icon: "Activity",
  },
  { key: "notSure", href: "/contact/calendar" as const, icon: "HelpCircle" },
] as const satisfies ReadonlyArray<{
  key: string;
  href: AppHref;
  icon: keyof typeof Lucide;
}>;

export default function BookAppointmentHub() {
  const t = useTranslations("bookAppointmentPage");

  return (
    <div className="relative w-full overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[hsl(var(--custom)/0.08)] via-transparent to-transparent dark:from-[hsl(var(--custom)/0.06)] dark:via-transparent dark:to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {t("hero.title")}
          </h1>
          <p className="mt-3 text-base text-gray-600 dark:text-gray-300 sm:text-lg">{t("hero.subtitle")}</p>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-[hsl(var(--custom))]">
            {t("prompt")}
          </p>
        </header>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {OPTIONS.map(({ key, href, icon }) => {
            const Icon = Lucide[icon] as ComponentType<{
              className?: string;
              "aria-hidden"?: boolean;
            }>;
            const isGeneral = key === "notSure";
            return (
              <li key={key}>
                <Link
                  href={href}
                  className={cn(
                    "group block h-full rounded-xl outline-none transition-all duration-200",
                    "focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  )}
                >
                  <Card
                    className={cn(
                      "h-full border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200",
                      "dark:border-gray-700/80 dark:bg-gray-950/90 dark:shadow-black/20",
                      "group-hover:border-[hsl(var(--custom)/0.35)] group-hover:shadow-md dark:group-hover:border-[hsl(var(--custom)/0.45)]",
                      isGeneral &&
                        "ring-1 ring-[hsl(var(--custom)/0.2)] dark:ring-[hsl(var(--custom)/0.35)]"
                    )}
                  >
                    <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--custom)/0.12)] text-[hsl(var(--custom))] transition-transform duration-200 group-hover:scale-105 dark:bg-[hsl(var(--custom)/0.2)]"
                        aria-hidden
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <CardTitle className="text-lg leading-snug text-gray-900 group-hover:text-[hsl(var(--custom))] dark:text-gray-50 dark:group-hover:text-[hsl(var(--custom))]">
                          {t(`options.${key}.title`)}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed dark:text-gray-400">
                          {t(`options.${key}.description`)}
                        </CardDescription>
                      </div>
                      <Lucide.ArrowRight
                        className="mt-1 h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[hsl(var(--custom))] dark:text-gray-500 dark:group-hover:text-[hsl(var(--custom))]"
                        aria-hidden
                      />
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-gray-500 dark:text-gray-400">{t("footnote")}</p>
      </div>
    </div>
  );
}
