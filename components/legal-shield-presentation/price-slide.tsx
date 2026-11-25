"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { lsQuote, usd } from "@/lib/legal-shield/plans";
import { LS_DECK } from "./copy";
import { Brandbar, Disclaimer, GOLD_TEXT_STYLE, Heading, Rich, Slide, WhatsAppPill } from "./deck-parts";
import { useLsPlan } from "./plan-state";

/**
 * "¿Cuánto cuesta y qué incluye?": the one offer's price, huge, with the breakdown and what it
 * includes in small print under it (Isaac's brief: people should see the total, not the parts).
 *
 * The Mensual/Anual switch is on the slide, for the client to see. Taking IDShield off is not: the
 * agent does it from his own (unshared) form tab or with Shift+I, and this slide just shows the
 * Preferred plan alone, with nothing crossed out. Both are the intake's answers (plan-state.tsx).
 */
export default function PriceSlide({ page }: { page: string }) {
  const t = LS_DECK.price;
  const { pkg, billing, setBilling } = useLsPlan();
  const quote = lsQuote(pkg, billing);
  const yearly = billing === "anual";
  const total = usd(quote.totalCents);

  return (
    <Slide>
      <Brandbar page={page} />
      <Heading kicker={t.kicker} lines={[t.title]} gold={t.titleGold} />

      {/* A photo that sells: the family the plan protects (all three faces, the girl's included). */}
      <div className="absolute left-[70px] right-[70px] top-[452px] h-[300px] overflow-hidden rounded-[27px] border-[1.5px] border-white/[.16]">
        <Image src="/images/legal-shield/presentation/familia-precio.webp" alt="" fill sizes="760px" className="object-cover object-[50%_66%]" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(7,35,59,0) 60%, rgba(7,35,59,.7) 100%)" }} />
      </div>

      {/* One column under the photo, so the yearly view's extra line pushes the rest down instead
          of into the WhatsApp pill. */}
      <div className="absolute left-[70px] right-[70px] top-[776px] flex flex-col items-center">
        {/* Mensual | Anual */}
        <div className="flex h-[66px] items-center rounded-full border-[1.5px] border-white/[.18] bg-white/[.06] p-[5px]">
          {(["mensual", "anual"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setBilling(option)}
              aria-pressed={billing === option}
              className={cn(
                "h-full rounded-full px-[40px] text-[25px] font-extrabold transition",
                billing === option ? "bg-[linear-gradient(180deg,#f3d68a_0%,#d9b260_100%)] text-[#07233b]" : "text-[#c8dbee]"
              )}
            >
              {option === "anual" ? t.yearly : t.monthly}
            </button>
          ))}
        </div>

        {/* The number, big. */}
        <div className="mt-[16px] flex items-baseline justify-center gap-[10px]">
          <span className="font-black leading-none tracking-[-.03em]" style={{ ...GOLD_TEXT_STYLE, fontSize: total.length > 6 ? 138 : 162 }}>
            {total}
          </span>
          <span className="text-[44px] font-extrabold text-white/80">{yearly ? t.perYear : t.perMonth}</span>
        </div>

        {/* The small print: what the number is made of, and what it buys. */}
        <div className="mt-[14px] self-stretch px-[20px] text-center">
          {yearly && quote.perMonthCents !== null && quote.savingsCents !== null && (
            <div className="text-[25px] font-bold text-white">
              {t.yearlyEquivalent.replace("{perMonth}", usd(quote.perMonthCents))} ·{" "}
              <span className="text-[#25d366]">{t.yearlySaves.replace("{savings}", usd(quote.savingsCents))}</span>
            </div>
          )}
          {/* Each plan and its price stay on one line; the "+" stays with the first. */}
          <div
            className={cn(
              "flex flex-wrap justify-center gap-x-[10px] text-[20px] font-semibold text-[#8ca4ba]",
              yearly ? "mt-[8px]" : "mt-[2px]"
            )}
          >
            {quote.lines.map((line, i) => (
              <span key={line.nameEs} className="whitespace-nowrap">
                {line.nameEs} {usd(line.cents)}
                {i < quote.lines.length - 1 ? " +" : ""}
              </span>
            ))}
          </div>
          <div className="mt-[18px] space-y-[10px] text-left text-[19px] font-medium leading-[1.4] text-[#a9bdd1]">
            <p>
              <Rich text={t.includes.preferido} />
            </p>
            {pkg !== "solo_preferido" && (
              <p>
                <Rich text={t.includes.idshield} />
              </p>
            )}
          </div>
        </div>
      </div>

      <WhatsAppPill />
      <Disclaimer />
    </Slide>
  );
}
