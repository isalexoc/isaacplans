"use client";

import { ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The repeated "Descarga tu copia ahora" button.
 *
 * A direct-response opt-in repeats its call to action after every beat, and every one of them has
 * to land on the same form. Scrolling to `#formulario` rather than linking to it keeps the URL
 * clean — a hash in the address bar is one more thing that can end up in an ad's tracking
 * parameters or get shared as a link that opens mid-page.
 *
 * The only client component in the static sections, so the ~400 lines of copy around it stay on
 * the server.
 */
export default function ScrollCta({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        document
          .getElementById("formulario")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={cn(
        "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] px-6 text-[16px] font-bold uppercase tracking-wide text-white shadow-lg transition hover:brightness-110",
        className
      )}
    >
      <ArrowUp className="h-5 w-5" />
      {children}
    </button>
  );
}
