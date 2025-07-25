/* components/CTABanner.tsx */
"use client";

import clsx from "clsx";

interface CTABannerProps {
  /** Inserts your focus area: "Dental", "Vision", "Health", etc. */
  message: string;
  /** JSX element to render as the CTA button */
  cta: React.ReactNode;
  /** Extra utility classes */
  className?: string;
}

export default function CTABanner({ message, cta, className }: CTABannerProps) {
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
        {/* Dynamic headline */}
        <p
          className="
            text-blue-800 font-semibold
            text-center md:text-left
            text-lg md:text-xl
            leading-snug
          "
        >
          {`${message}`}
        </p>

        {/* Custom CTA */}
        <div className="flex justify-center md:justify-start">{cta}</div>
      </div>
    </section>
  );
}
