"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IncompletePreviewOverlayProps = {
  incomplete: boolean;
  title: string;
  hint: string;
  children: ReactNode;
  className?: string;
};

/** Blurs preview content and shows a centered message when quote data is incomplete. */
export function IncompletePreviewOverlay({
  incomplete,
  title,
  hint,
  children,
  className,
}: IncompletePreviewOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "transition-[filter,opacity]",
          incomplete && "pointer-events-none select-none blur-[4px] brightness-[0.55] saturate-50"
        )}
      >
        {children}
      </div>
      {incomplete && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 px-4"
          role="status"
          aria-live="polite"
        >
          <div className="max-w-[min(100%,280px)] rounded-lg border border-amber-300/80 bg-amber-950/95 px-5 py-4 text-center shadow-xl backdrop-blur-sm">
            <p className="text-base font-semibold tracking-wide text-amber-50">{title}</p>
            <p className="mt-2 text-sm leading-snug text-amber-100/90">{hint}</p>
          </div>
        </div>
      )}
    </div>
  );
}
