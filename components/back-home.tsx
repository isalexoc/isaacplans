"use client";

import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { useLocale } from "next-intl";

interface BackHomeProps {
  variant?: "absolute" | "inline";
  /** When set, overrides the default home link (e.g. parent hub page). */
  href?: string;
  /** Accessible label for the link (pass translated string from the server). */
  label?: string;
}

export function BackHome({
  variant = "absolute",
  href,
  label,
}: BackHomeProps) {
  const locale = useLocale();
  const to = href ?? `/${locale}`;
  const text =
    label ??
    (locale === "en" ? "Back to Home" : "Volver al Inicio");
  const isCustom = Boolean(href);

  const linkClasses =
    "inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm";

  const icon = isCustom ? (
    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
  ) : (
    <Home className="h-4 w-4 shrink-0" aria-hidden />
  );

  if (variant === "inline") {
    return (
      <Link href={to} className={linkClasses}>
        {icon}
        {text}
      </Link>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-10">
      <Link href={to} className={linkClasses}>
        {icon}
        {text}
      </Link>
    </div>
  );
}

