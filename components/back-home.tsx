"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

interface BackHomeProps {
  variant?: "absolute" | "inline";
}

export function BackHome({ variant = "absolute" }: BackHomeProps) {
  const locale = useLocale();

  const linkClasses = "inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-gray-200/50 dark:border-gray-700/50 shadow-sm";

  if (variant === "inline") {
    return (
      <Link
        href={`/${locale}`}
        className={linkClasses}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {locale === "en" ? "Back to Home" : "Volver al Inicio"}
      </Link>
    );
  }

  return (
    <div className="absolute top-4 left-4 z-10">
      <Link
        href={`/${locale}`}
        className={linkClasses}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        {locale === "en" ? "Back to Home" : "Volver al Inicio"}
      </Link>
    </div>
  );
}

