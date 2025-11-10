/* components/PlanEnrollCard.tsx */
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

// Declare gtag on the Window interface for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface PlanEnrollCardProps {
  title: string;
  subtitle: string;
  cta: string;
  link: string;
  disclaimer?: string;
  imageUrl?: string;
  className?: string;
}

export default function PlanEnrollCard({
  title,
  subtitle,
  cta,
  link,
  disclaimer,
  imageUrl,
  className,
}: PlanEnrollCardProps) {
  return (
    <Card
      className={cn(
        "relative flex flex-col md:flex-row items-center gap-6 lg:gap-8 p-6 lg:p-8 shadow-xl",
        "bg-white/95 backdrop-blur-sm dark:bg-gray-950",
        "border border-gray-200/60 dark:border-gray-800",
        "hover:shadow-2xl transition-all duration-300 hover:-translate-y-1",
        "focus-within:ring-2 focus-within:ring-[hsl(var(--custom))] focus-within:ring-offset-2",
        className
      )}
      role="region"
      aria-labelledby="self-enroll-title"
    >
      {/* Decorative gradient accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[hsl(var(--custom))] via-[hsl(var(--custom)/0.6)] to-[hsl(var(--custom))] rounded-t-lg"
        aria-hidden="true"
      />

      {imageUrl && (
        <div className="relative w-28 h-28 lg:w-32 lg:h-32 shrink-0 mx-auto md:mx-0 group">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--custom)/0.2)] to-transparent 
                       rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
            aria-hidden="true"
          />
          <div className="relative w-full h-full bg-gradient-to-br from-[hsl(var(--custom)/0.1)] to-[hsl(var(--custom)/0.05)] rounded-2xl p-3 shadow-lg">
            <Image
              src={imageUrl}
              fill
              priority
              alt={`${title} logo`}
              className="object-contain"
              fetchPriority="high"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col text-center md:text-left flex-1 space-y-4">
        <h2
          id="self-enroll-title"
          className="text-2xl lg:text-3xl font-bold text-[hsl(var(--custom))] dark:text-[hsl(var(--custom)/0.9)]"
        >
          {title}
        </h2>
        <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
          {subtitle}
        </p>

        <Button
          asChild
          size="lg"
          className="mt-2 w-full md:w-fit 
                     bg-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.9)] 
                     text-white font-semibold
                     shadow-lg hover:shadow-xl
                     transition-all duration-300 hover:-translate-y-0.5
                     focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom))] focus-visible:ring-offset-2"
          onClick={() =>
            window?.gtag?.("event", "plan_enroll_click", {
              plan: title,
              link,
            })
          }
        >
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${cta} - ${title} (opens in new tab)`}
            className="inline-flex items-center gap-2"
          >
            {cta}
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </Button>

        {disclaimer && (
          <p
            className="mt-4 text-xs lg:text-sm text-gray-600 dark:text-gray-400 md:max-w-md leading-relaxed"
            role="note"
          >
            {disclaimer}
          </p>
        )}
      </div>
    </Card>
  );
}
