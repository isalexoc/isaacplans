/* components/CTABanner.tsx */
"use client";

import { useLanguage } from "@/hooks/useLanguage";
import { translations as t } from "@/lib/translations-aca";
import ACAButton from "@/components/ACAButton";
import clsx from "clsx";

interface CTABannerProps {
  /** Optional custom headline text */
  message?: string;
  /** Extra utility classes (e.g. to swap background) */
  className?: string;
}

export default function CTABanner({ message, className }: CTABannerProps) {
  const { language } = useLanguage();
  const copy = t[language].ctaBanner;

  return (
    <section
      className={clsx(
        "bg-[#0DA5D9] px-4 py-8", // increased vertical padding for breathing room
        className
      )}
    >
      <div
        className="
          container mx-auto max-w-7xl
          flex flex-col md:flex-row items-center
          gap-6 md:gap-8
          justify-center md:justify-between
        "
      >
        {/* Headline */}
        <p
          className="
            text-blue-800 font-semibold
            text-center md:text-left
            text-lg md:text-xl
            leading-snug
          "
        >
          {message ?? copy.message}
        </p>

        {/* CTA button — centred on mobile, aligned right on desktop */}
        <div className="flex justify-center md:justify-start">
          <ACAButton />
        </div>
      </div>
    </section>
  );
}
