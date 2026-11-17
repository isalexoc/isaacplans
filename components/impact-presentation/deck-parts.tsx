/**
 * The CrankWheel deck's shared building blocks, on its 900×1600 canvas (every size a canvas pixel).
 * Used by the server-rendered slides and by the client-side slides (the quote) alike.
 */

import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const IMG = "/images/impact/presentation";
export const LOGO_WHITE = { src: `${IMG}/logo-white.png`, width: 409, height: 112 };
export const LOGO_COLOR = { src: `${IMG}/logo-color.png`, width: 306, height: 81 };

export function Slide({ dark, className, children }: { dark?: boolean; className?: string; children: ReactNode }) {
  return (
    <section
      className={cn(
        "absolute inset-0 flex flex-col px-[56px] pb-[120px] pt-[90px]",
        dark ? "bg-[#0b2a4a] text-white" : "bg-[#fbf6f2] text-[#14243a]",
        className
      )}
    >
      {children}
    </section>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="mb-[14px] text-[22px] font-bold uppercase tracking-[.12em] text-[#f2735a]">{children}</div>;
}

export function Title({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <h2 className={cn("text-[62px] font-extrabold leading-[1.06] tracking-[-.01em]", dark ? "text-white" : "text-[#0b2a4a]")}>
      {children}
    </h2>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return <p className="mt-[22px] text-[29px] leading-[1.45] text-[#56657a]">{children}</p>;
}

export function Brandbar({ dark, page, note }: { dark?: boolean; page: string; note?: string }) {
  const logo = dark ? LOGO_WHITE : LOGO_COLOR;
  return (
    <div
      className={cn(
        "absolute bottom-[40px] left-[56px] right-[56px] z-[5] flex items-center justify-between text-[18px]",
        dark ? "text-white/65" : "text-[#56657a]"
      )}
    >
      <Image src={logo.src} alt="" width={logo.width} height={logo.height} className="h-[56px] w-auto" />
      {note && <span className="text-[16px]">{note}</span>}
      <span>{page}</span>
    </div>
  );
}
