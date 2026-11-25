"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { lsQuote, usd } from "@/lib/legal-shield/plans";
import { LS_DECK, LS_GUIDE } from "./copy";
import { GOLD_TEXT_STYLE, Rich } from "./deck-parts";
import { useGuideBilling } from "./guide";

/**
 * "¿Cuánto cuesta y qué incluye?" for a client reading alone: the bundle only (Plan Legal
 * Preferencial + IDShield Familiar 3B), never a choice to drop either; the client picks how to pay,
 * and that choice rides into their application.
 */
export default function GuidePrice() {
  const t = LS_DECK.price;
  const { billing, setBilling } = useGuideBilling();
  const quote = lsQuote("preferido_idshield", billing);
  const yearly = billing === "anual";

  return (
    <div>
      <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#d8bc78] sm:text-sm">{t.kicker}</p>
      <h2 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-4xl">
        {t.title}{" "}
        <span className="block" style={GOLD_TEXT_STYLE}>
          {t.titleGold}
        </span>
      </h2>

      <div className="relative mt-5 aspect-[16/10] w-full overflow-hidden rounded-3xl border border-white/15">
        <Image
          src="/images/legal-shield/presentation/familia-precio.webp"
          alt=""
          fill
          sizes="(min-width: 640px) 576px, 100vw"
          className="object-cover object-[50%_60%]"
        />
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-[#c8dbee]">{LS_GUIDE.billingLabel}</p>
      <div className="mx-auto mt-2 flex w-full max-w-xs rounded-full border border-white/20 bg-white/[.06] p-1">
        {(["mensual", "anual"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setBilling(option)}
            aria-pressed={billing === option}
            className={cn(
              "h-12 flex-1 rounded-full text-base font-extrabold transition",
              billing === option ? "bg-[linear-gradient(180deg,#f3d68a_0%,#d9b260_100%)] text-[#07233b]" : "text-[#c8dbee]"
            )}
          >
            {option === "anual" ? t.yearly : t.monthly}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-center gap-1.5">
        <span className="text-6xl font-black leading-none tracking-tight sm:text-7xl" style={GOLD_TEXT_STYLE}>
          {usd(quote.totalCents)}
        </span>
        <span className="text-2xl font-extrabold text-white/80">{yearly ? t.perYear : t.perMonth}</span>
      </div>
      {yearly && quote.perMonthCents !== null && quote.savingsCents !== null && (
        <p className="mt-3 text-center text-base font-bold">
          {t.yearlyEquivalent.replace("{perMonth}", usd(quote.perMonthCents))} ·{" "}
          <span className="whitespace-nowrap text-[#25d366]">{t.yearlySaves.replace("{savings}", usd(quote.savingsCents))}</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-x-2 text-center text-sm font-semibold text-[#8ca4ba]">
        {quote.lines.map((line, i) => (
          <span key={line.nameEs} className="whitespace-nowrap">
            {line.nameEs} {usd(line.cents)}
            {i < quote.lines.length - 1 ? " +" : ""}
          </span>
        ))}
      </div>

      <div className="mt-6 space-y-3 rounded-3xl border border-white/15 bg-white/[.05] p-5 text-[15px] leading-relaxed text-[#c8dbee]">
        <p className="text-sm font-bold text-white">{LS_GUIDE.bundleNote}</p>
        <p>
          <Rich text={t.includes.preferido} />
        </p>
        <p>
          <Rich text={t.includes.idshield} />
        </p>
        <p className="text-xs text-[#8ca4ba]">{t.stateNote}</p>
      </div>
    </div>
  );
}
