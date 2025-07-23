/* components/PlanEnrollCard.tsx */
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
        "flex flex-col md:flex-row items-center gap-6 p-6 shadow-lg",
        "bg-white dark:bg-gray-950", // card body
        className
      )}
    >
      {imageUrl && (
        <div className="relative w-24 h-24 shrink-0 mx-auto md:mx-0">
          <Image
            src={imageUrl}
            fill
            priority
            alt=""
            className="object-contain"
          />
        </div>
      )}

      <div className="flex flex-col text-center md:text-left flex-1">
        <h2 className="text-2xl font-bold text-brand dark:text-brand-light">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>

        <Button
          asChild
          size="lg"
          className="mt-5 w-full md:w-fit bg-brand hover:bg-brand-dark dark:bg-brand-light dark:hover:bg-brand"
          onClick={() =>
            window?.gtag?.("event", "plan_enroll_click", {
              plan: title,
              link,
            })
          }
        >
          <a href={link} target="_blank" rel="noopener noreferrer">
            {cta}
          </a>
        </Button>

        {disclaimer && (
          <p className="mt-4 text-xs text-muted-foreground md:max-w-md">
            {disclaimer}
          </p>
        )}
      </div>
    </Card>
  );
}
