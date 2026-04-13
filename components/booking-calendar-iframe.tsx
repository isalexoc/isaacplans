"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  title: string;
  loadingLabel: string;
};

/**
 * Agent CRM booking embed: shows a loading state until the iframe fires onLoad
 * (third-party widgets often load slowly; blank iframe was reported as “calendar not showing”).
 */
export default function BookingCalendarIframe({
  src,
  title,
  loadingLabel,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-full max-w-4xl min-h-[min(80vh,720px)]">
      {!loaded && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-100 dark:bg-slate-800 md:rounded-lg"
          role="status"
          aria-live="polite"
        >
          <span
            className="h-9 w-9 animate-spin rounded-full border-2 border-slate-300 border-t-[hsl(var(--custom))] dark:border-slate-600"
            aria-hidden
          />
          <span className="text-sm text-slate-600 dark:text-slate-400">{loadingLabel}</span>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-[80vh] w-full border-none shadow-lg md:rounded-lg",
          !loaded && "opacity-0"
        )}
        allow="camera; microphone; fullscreen; payment; clipboard-write"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
