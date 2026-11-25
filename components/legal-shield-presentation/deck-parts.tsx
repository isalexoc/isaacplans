/**
 * The Legal Shield deck's building blocks, on the shared 900×1600 canvas (every size a canvas
 * pixel). Measured from Isaac's 1080×1920 PDF (page by page: palette, margins, card pitch, type
 * sizes and weights) and scaled by 900/1080. Typeface: Montserrat (Black titles, ExtraBold card
 * titles and kickers, SemiBold body), loaded by the deck's shell.
 *
 * Colors are whole classes or inline styles: Tailwind only keeps classes it can see in the source.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LS_DECK, type LsIcon } from "./copy";
import { LsGlyph, WhatsAppGlyph } from "./icons";

/** The headline gold, top to bottom across the line box. */
export const GOLD_TEXT_STYLE = {
  backgroundImage: "linear-gradient(180deg, #eccf86 0%, #e2bf6a 50%, #b58c3e 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;

/** Flat navy with a warm glow top-right and a blue glow bottom-left, as on every PDF page. */
export const NAVY_STYLE = {
  background:
    "radial-gradient(433px 433px at 800px 125px, rgba(27,49,63,.95) 0%, rgba(27,49,63,0) 100%), " +
    "radial-gradient(500px 500px at 0px 1600px, rgba(18,54,90,.95) 0%, rgba(18,54,90,0) 100%), " +
    "#07233b",
} as const;

/** `**bold**` → the PDF's pale-gold bold highlight. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") ? (
          <strong key={i} className="font-extrabold text-[#efdda5]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function Slide({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("absolute inset-0 overflow-hidden text-white", className)} style={NAVY_STYLE}>
      {children}
    </section>
  );
}

/** The brand row (mark, wordmark), the page counter, and the gold rule under them. */
export function Brandbar({ page }: { page: string }) {
  return (
    <>
      <div className="absolute left-[70px] right-[70px] top-[86px] flex h-[57px] items-center justify-between">
        <div className="flex items-center gap-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG mark */}
          <img src="/images/legal-shield/red-de-apoyo-mark.svg" alt="" width={57} height={57} className="h-[57px] w-[57px]" />
          <span className="text-[23px] font-bold tracking-[.08em] text-[#c8dbee]">
            RED DE APOYO <span className="text-[#d7bd7c]">LATINO USA</span>
          </span>
        </div>
        <span className="text-[22px] font-extrabold tracking-[.06em] text-[#d9be7b]">{page}</span>
      </div>
      <div
        className="absolute left-[70px] right-[70px] top-[178px] h-[2px]"
        style={{ background: "linear-gradient(90deg, #cfb36a 0%, rgba(207,179,106,.6) 55%, rgba(207,179,106,0) 100%)" }}
      />
    </>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="text-[26px] font-extrabold uppercase leading-none tracking-[.13em] text-[#d8bc78]">{children}</div>;
}

/** White first line(s), gold last line, like every title in the PDF. */
export function Title({ lines, gold, size = 73 }: { lines: readonly string[]; gold: string; size?: number }) {
  return (
    <h2 className="mt-[24px] font-black tracking-[-.018em]" style={{ fontSize: size, lineHeight: 1.02 }}>
      {lines.map((line) => (
        <span key={line} className="block text-white">
          {line}
        </span>
      ))}
      <span className="block pb-[6px]" style={GOLD_TEXT_STYLE}>
        {gold}
      </span>
    </h2>
  );
}

/** Kicker + title block, where every slide puts it. */
export function Heading({ kicker, lines, gold }: { kicker: string; lines: readonly string[]; gold: string }) {
  return (
    <div className="absolute left-[70px] right-[70px] top-[233px]">
      <Kicker>{kicker}</Kicker>
      <Title lines={lines} gold={gold} />
    </div>
  );
}

export const CARD = "rounded-[20px] border-[1.5px] border-white/[.16] bg-white/[.05]";
export const CARD_GOLD = "rounded-[27px] border-[2px] border-[#d5bb7a]";
export const CARD_GOLD_STYLE = { background: "linear-gradient(90deg, #303e41 0%, #142e45 100%)" } as const;

/** A gold-ringed icon circle (rows) or a solid gold disc (the dual-plan cards). */
export function RowIcon({ icon, size, solid = false }: { icon: LsIcon; size: number; solid?: boolean }) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: solid
          ? "radial-gradient(circle at 35% 30%, #f3d68a 0%, #e8c36b 40%, #a58743 100%)"
          : "linear-gradient(180deg, #4f5b59 0%, #2f414a 100%)",
        border: solid ? "none" : "1.5px solid rgba(213,187,122,.75)",
      }}
    >
      <span style={{ width: size * 0.48, height: size * 0.48 }} className="flex">
        <LsGlyph
          name={icon}
          strokeWidth={solid ? 2.1 : 1.6}
          className={cn("h-full w-full", solid ? "text-[#07233b]" : "text-[#ecd08a]")}
        />
      </span>
    </span>
  );
}

/** One feature: icon, an ExtraBold title, one SemiBold line under it. */
export function FeatureRow({ icon, title, body, compact }: { icon: LsIcon; title: string; body: string; compact?: boolean }) {
  return (
    <div
      className={cn(CARD, "flex items-center gap-[21px]", compact ? "min-h-[100px] px-[16px] py-[10px]" : "min-h-[117px] px-[22px] py-[12px]")}
    >
      <RowIcon icon={icon} size={compact ? 79 : 92} />
      <div className="min-w-0">
        <div className={cn("font-extrabold leading-[1.15] tracking-[-.01em] text-white", compact ? "text-[29px]" : "text-[32px]")}>{title}</div>
        <div className={cn("mt-[4px] font-semibold leading-[1.3] text-[#c8dbee]", compact ? "text-[21px]" : "text-[23px]")}>
          <Rich text={body} />
        </div>
      </div>
    </div>
  );
}

/** The cards under the heading, from where the PDF starts them. */
export function Cards({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <div className={cn("absolute left-[70px] right-[70px] top-[452px] flex flex-col", compact ? "gap-[10px]" : "gap-[18px]")}>
      {children}
    </div>
  );
}

/** "Ysmael Orraiz · WhatsApp (540) 376-1831": readable text (a viewer on a screen share can't tap it). */
export function WhatsAppPill() {
  return (
    <div
      className="absolute left-[70px] right-[70px] top-[1365px] flex h-[83px] items-center justify-center gap-[16px] rounded-full border-[2px] border-[#2f976a]"
      style={{ background: "linear-gradient(90deg, #103f4f 0%, #0a353e 100%)" }}
    >
      <WhatsAppGlyph className="h-[36px] w-[36px] text-[#25d366]" />
      <span className="text-[27.5px] font-bold text-white">
        {LS_DECK.whatsappPill} <span className="text-[#25d366]">{LS_DECK.phone}</span>
      </span>
    </div>
  );
}

/** The big green "Escríbeme por WhatsApp" block. */
export function WhatsAppCta({ label, top = 1220 }: { label: string; top?: number }) {
  return (
    <div
      className="absolute left-[70px] right-[70px] flex h-[138px] items-center gap-[28px] rounded-full bg-[#25d366] px-[42px]"
      style={{ top }}
    >
      <WhatsAppGlyph className="h-[64px] w-[64px] flex-none text-white" />
      <div className="leading-none text-white">
        <div className="text-[23px] font-extrabold uppercase tracking-[.1em]">{label}</div>
        <div className="mt-[6px] text-[54px] font-black tracking-[-.01em]">{LS_DECK.phone}</div>
      </div>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="absolute left-[75px] right-[75px] top-[1466px] text-center text-[18.5px] font-medium leading-[1.38] text-[#8ca4ba]">
      {LS_DECK.disclaimer}
    </p>
  );
}
