"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT } from "@/lib/get-covered-fast/constants";
import {
  IUL_GUIA_AGENT_NAME,
  IUL_GUIA_AGENT_SPECIALTY,
  IUL_GUIA_SEARCHING_LABEL,
} from "@/lib/iul-guia/constants";

/**
 * The short "finding your advisor" beat on the last quiz step, which then resolves into Isaac.
 *
 * Why it exists: the step it sits on asks for a callback time, and that is the question the funnel
 * loses people on — someone who came for a report did not expect to be scheduling a call. The
 * surrounding screen reframes the ask as something earned ("calificas…"), and this is the moment
 * that makes the advisor feel assigned rather than assumed.
 *
 * A NOTE ON HONESTY, because it is worth writing down: nothing is actually being searched. Isaac
 * is the only advisor, and he is the answer before the timer starts. The delay is theatre. It is
 * mild and the industry does it constantly, but the wording lives in
 * {@link IUL_GUIA_SEARCHING_LABEL} precisely so it is one string to change if Isaac would rather
 * say something that is literally true ("Preparando tu asesoría…"). The reveal animation carries
 * most of the effect either way.
 *
 * Reduced motion: the delay still runs (it is a sequence, not an animation) but the spinner and
 * the fade are dropped by the media query Tailwind applies via `motion-reduce:`.
 */

export default function AdvisorReveal({
  /**
   * Owned by the funnel, not by this component: the same flag gates the time options, and two
   * timers racing to agree on whether the advisor has been "found" is a bug waiting to happen.
   */
  found,
  className,
}: {
  found: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50",
        className
      )}
      // Announced once it resolves, so a screen reader is not read a spinner.
      aria-live="polite"
    >
      {!found ? (
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-[#0077B6]/20 motion-reduce:animate-none" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#0077B6]/10">
              <Loader2 className="h-5 w-5 animate-spin text-[#0077B6] motion-reduce:animate-none dark:text-[#4CC9F0]" />
            </span>
          </span>
          <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-300">
            {IUL_GUIA_SEARCHING_LABEL}
          </p>
        </div>
      ) : (
        <div className="flex animate-in fade-in slide-in-from-bottom-1 items-center gap-3 duration-500 motion-reduce:animate-none">
          {FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT ? (
            <Image
              src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
              alt={IUL_GUIA_AGENT_NAME}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover object-[center_20%]"
            />
          ) : null}
          <p className="text-[14px] leading-snug text-gray-600 dark:text-gray-400">
            <span className="font-bold text-gray-900 dark:text-white">{IUL_GUIA_AGENT_NAME}</span>
            <span className="text-gray-500 dark:text-gray-500"> · {IUL_GUIA_AGENT_SPECIALTY}</span>
            <br />
            hará lo posible por llamarte en el horario que elijas.
          </p>
        </div>
      )}
    </div>
  );
}
