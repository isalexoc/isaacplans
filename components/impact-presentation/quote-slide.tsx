"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  CO_SHARE_MAX,
  RECOMMENDED_TIER,
  money,
  perDay,
  type ImpactPlan,
  type ImpactQuote,
} from "@/lib/impact-quote/plans";
import { publishPlanChoice, readStoredQuote, subscribeQuote } from "@/lib/impact-quote/sync";
import { DECK_COPY, type DeckCopy, type DeckLocale } from "./copy";
import { Brandbar, Kicker, Slide, Title } from "./deck-parts";
import { Glyph } from "./icons";

/**
 * "Choose your plan" on the CrankWheel deck: this household's four Impact prices, sold the way
 * Isaac wants — every benefit in every plan said first, the cheapest plan recommended and biggest,
 * the PRA explained as the only thing that changes.
 *
 * Starts with the quote the page fetched from Impact for the intake's household, then follows
 * whatever the agent publishes from the form (a re-quote, or prices typed from Impact's page).
 */
export default function QuoteSlide({
  locale,
  token,
  initial,
  page,
}: {
  locale: DeckLocale;
  token: string;
  initial: ImpactQuote | null;
  page: string;
}) {
  const t = DECK_COPY[locale];
  const q = t.quote;
  const [quote, setQuote] = useState<ImpactQuote | null>(initial);
  const [selected, setSelected] = useState<string>(RECOMMENDED_TIER);

  useEffect(() => {
    const stored = readStoredQuote(token);
    if (stored) setQuote(stored);
    return subscribeQuote(token, (next) => setQuote(next ?? initial));
  }, [token, initial]);

  return (
    <Slide>
      <Kicker>{q.kicker}</Kicker>
      <Title>{q.title}</Title>
      {quote && (
        <div className="mt-[16px] flex flex-wrap gap-[10px]">
          <span className="rounded-full border border-[#e6e9ef] bg-white px-[20px] py-[8px] text-[21px] font-semibold text-[#0b2a4a]">
            {q.household(quote.members, quote.oldestAge)}
          </span>
        </div>
      )}

      <div className="mt-[20px] rounded-[24px] bg-[#d6f2ee] px-[26px] py-[18px]">
        <p className="flex items-center gap-[12px] text-[23px] font-bold text-[#0b2a4a]">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[#2f97a0]">
            <Glyph name="check" strokeWidth={3.2} className="h-[18px] w-[18px] text-white" />
          </span>
          {q.allIncludedTitle}
        </p>
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          {q.allIncluded.map((item) => (
            <span key={item} className="rounded-full bg-white px-[14px] py-[6px] text-[18px] font-semibold text-[#0b2a4a]">
              {item}
            </span>
          ))}
        </div>
      </div>

      {quote?.plans.length ? (
        <div className="mt-[24px] grid gap-[12px]">
          {quote.plans.map((plan) => (
            <PlanCard
              key={plan.pra}
              plan={plan}
              t={t}
              selected={selected === (plan.tier ?? String(plan.pra))}
              onSelect={() => {
                setSelected(plan.tier ?? String(plan.pra));
                // The client's pick goes straight into the agent's open form ("Your plan").
                if (plan.tier) publishPlanChoice(token, { tier: plan.tier, monthly: plan.monthly });
              }}
            />
          ))}
        </div>
      ) : (
        <div className="mt-[26px] flex flex-1 items-center justify-center rounded-[28px] border-[3px] border-dashed border-[#e6e9ef] bg-white text-[32px] font-bold text-[#56657a]">
          {q.pending}
        </div>
      )}

      {quote?.oldestAge !== null && quote?.oldestAge !== undefined && quote.oldestAge >= 65 && (
        <p className="mt-[14px] text-[19px] text-[#56657a]">{q.senior}</p>
      )}
      <p className="mt-[14px] text-[19px] leading-[1.4] text-[#56657a]">{q.note}</p>
      <p className="mt-[6px] text-[19px] font-bold text-[#0b2a4a]">{q.fee}</p>
      <Brandbar page={page} />
    </Slide>
  );
}

function PlanCard({
  plan,
  t,
  selected,
  onSelect,
}: {
  plan: ImpactPlan;
  t: DeckCopy;
  selected: boolean;
  onSelect: () => void;
}) {
  const q = t.quote;
  const recommended = plan.tier === RECOMMENDED_TIER;
  const label = plan.tier ? q.names[plan.tier] : { name: `PRA ${money(plan.pra)}`, tagline: "" };
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative grid w-full grid-cols-[1fr_auto] items-center gap-x-[18px] rounded-[28px] border-[3px] px-[30px] text-left transition",
        recommended ? "py-[22px]" : "py-[12px]",
        selected
          ? "border-[#0b2a4a] bg-[#0b2a4a] text-white shadow-[0_24px_50px_rgba(11,42,74,.35)]"
          : "border-[#e6e9ef] bg-white text-[#0b2a4a]"
      )}
    >
      {recommended && (
        <span className="absolute -top-[17px] right-[28px] rounded-full bg-[#f2735a] px-[16px] py-[6px] text-[17px] font-extrabold tracking-[.06em] text-white">
          {q.recommended}
        </span>
      )}
      <div>
        <div className={cn("font-extrabold leading-none", recommended ? "text-[44px]" : "text-[36px]")}>{label.name}</div>
        {label.tagline && (
          <div className={cn("mt-[6px] text-[20px]", selected ? "text-white/75" : "text-[#56657a]")}>{label.tagline}</div>
        )}
      </div>
      <div className="text-right">
        <div className={cn("whitespace-nowrap font-extrabold leading-none", recommended ? "text-[70px]" : "text-[50px]")}>
          <span className={cn(selected && "text-[#ff8f74]")}>{money(plan.monthly)}</span>
          <span className={cn("text-[22px] font-medium", selected ? "text-white/75" : "text-[#56657a]")}>{q.perMonth}</span>
        </div>
        <div className={cn("mt-[4px] text-[18px]", selected ? "text-white/75" : "text-[#56657a]")}>
          {q.perDay(money(perDay(plan.monthly), true))}
        </div>
      </div>
      <div
        className={cn(
          "col-span-2 mt-[10px] flex flex-wrap gap-[8px] border-t pt-[10px] text-[18px]",
          selected ? "border-white/15" : "border-[#e6e9ef]"
        )}
      >
        {[
          [q.pra, money(plan.pra)],
          [q.then, "90/10"],
          [q.max, money(plan.pra + CO_SHARE_MAX)],
        ].map(([k, v]) => (
          <span key={k} className={cn("rounded-[10px] px-[12px] py-[5px]", selected ? "bg-white/10" : "bg-[#fbf6f2]")}>
            {k}: <b>{v}</b>
          </span>
        ))}
      </div>
    </button>
  );
}
