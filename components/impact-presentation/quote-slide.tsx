"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CO_SHARE_MAX,
  RECOMMENDED_TIER,
  money,
  perDay,
  type HouseholdSize,
  type ImpactPlan,
  type ImpactQuote,
} from "@/lib/impact-quote/plans";
import { publishPlanChoice, publishQuote, readStoredQuote, subscribeQuote } from "@/lib/impact-quote/sync";
import { dobFromParts, requestImpactQuote } from "@/lib/impact-quote/client";
import { splitDobIso } from "@/lib/intake-shared/format";
import { DECK_COPY, type DeckCopy, type DeckLocale } from "./copy";
import { Brandbar, Kicker, Slide, Title } from "./deck-parts";
import { Glyph } from "./icons";

/**
 * "Choose your plan" on the CrankWheel deck: this household's four Impact prices, sold the way
 * Isaac wants — every benefit in every plan said first, the cheapest plan recommended and biggest,
 * the PRA explained as the only thing that changes.
 *
 * Starts with the quote the page fetched for the intake's household when the form already had the
 * birth dates. Usually it doesn't — the deck opens right after the client is found — so the slide
 * asks the same two questions as the self-serve page, pre-filled from the intake when it can, and
 * quotes in place. It also follows whatever the agent publishes from the form's quote panel.
 */
export default function QuoteSlide({
  locale,
  token,
  initial,
  household,
  page,
}: {
  locale: DeckLocale;
  token: string;
  initial: ImpactQuote | null;
  /** What the intake says about the household when the deck opened, to pre-fill the questions. */
  household: { members: HouseholdSize; oldestDob: string | null };
  page: string;
}) {
  const t = DECK_COPY[locale];
  const q = t.quote;
  const [quote, setQuote] = useState<ImpactQuote | null>(initial);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string>(RECOMMENDED_TIER);

  useEffect(() => {
    const stored = readStoredQuote(token);
    if (stored) setQuote(stored);
    return subscribeQuote(token, (next) => {
      setQuote(next ?? initial);
      if (next) setEditing(false);
    });
  }, [token, initial]);

  /** A quote made on the slide: shown, shared with the agent's panel, and its plan sent to the form. */
  function quoted(next: ImpactQuote) {
    setQuote(next);
    setEditing(false);
    setSelected(RECOMMENDED_TIER);
    publishQuote(token, next);
    const plan = next.plans.find((p) => p.tier === RECOMMENDED_TIER);
    if (plan?.tier) publishPlanChoice(token, { tier: plan.tier, monthly: plan.monthly });
  }

  const asking = !quote?.plans.length || editing;

  return (
    <Slide>
      <Kicker>{q.kicker}</Kicker>
      <Title>{q.title}</Title>
      {quote && !asking && (
        <div className="mt-[16px] flex flex-wrap items-center gap-[14px]">
          <span className="rounded-full border border-[#e6e9ef] bg-white px-[20px] py-[8px] text-[21px] font-semibold text-[#0b2a4a]">
            {q.household(quote.members, quote.oldestAge)}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[19px] font-semibold text-[#0b2a4a] underline"
          >
            {q.change}
          </button>
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

      {asking ? (
        <QuickQuote t={t} locale={locale} household={household} onQuoted={quoted} />
      ) : (
        <div className="mt-[24px] grid gap-[12px]">
          {(quote?.plans ?? []).map((plan) => (
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
      )}

      {!asking && quote?.oldestAge !== null && quote?.oldestAge !== undefined && quote.oldestAge >= 65 && (
        <p className="mt-[14px] text-[19px] text-[#56657a]">{q.senior}</p>
      )}
      <p className="mt-[14px] text-[19px] leading-[1.4] text-[#56657a]">{q.note}</p>
      <p className="mt-[6px] text-[19px] font-bold text-[#0b2a4a]">{q.fee}</p>
      <Brandbar page={page} />
    </Slide>
  );
}

/**
 * The two questions Impact prices on, at canvas size, so the agent can quote on the shared screen
 * mid-presentation. Pre-filled from the intake when it already knows the household.
 */
function QuickQuote({
  t,
  locale,
  household,
  onQuoted,
}: {
  t: DeckCopy;
  locale: DeckLocale;
  household: { members: HouseholdSize; oldestDob: string | null };
  onQuoted: (quote: ImpactQuote) => void;
}) {
  const q = t.quote;
  const start = splitDobIso(household.oldestDob ?? "");
  const [members, setMembers] = useState<HouseholdSize>(household.members);
  const [month, setMonth] = useState(start.month);
  const [day, setDay] = useState(start.day);
  const [year, setYear] = useState(start.year);
  const [phase, setPhase] = useState<"idle" | "loading" | "failed">("idle");
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) =>
        new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { month: "long", timeZone: "UTC" }).format(
          new Date(Date.UTC(2000, i, 1))
        )
      ),
    [locale]
  );
  const thisYear = new Date().getFullYear();
  const dob = dobFromParts(month, day, year);

  async function submit() {
    if (!dob) return;
    setPhase("loading");
    const answer = await requestImpactQuote(dob, members);
    if (!answer) {
      setPhase("failed");
      return;
    }
    setPhase("idle");
    onQuoted({ plans: answer.plans, members: answer.members, oldestAge: answer.age, source: "impact" });
  }

  const select = "h-[76px] w-full rounded-[18px] border-[3px] border-[#e6e9ef] bg-white px-[16px] text-[24px] text-[#14243a]";
  return (
    <div className="mt-[26px] rounded-[28px] border border-[#e6e9ef] bg-white p-[30px]">
      <p className="text-[26px] font-bold text-[#0b2a4a]">{q.membersQuestion}</p>
      <div className="mt-[14px] grid grid-cols-3 gap-[12px]">
        {q.members.map((label, i) => {
          const value = (i + 1) as HouseholdSize;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setMembers(value)}
              aria-pressed={members === value}
              className={cn(
                "h-[76px] rounded-[18px] border-[3px] text-[24px] font-bold transition",
                members === value ? "border-[#0b2a4a] bg-[#0b2a4a] text-white" : "border-[#e6e9ef] bg-white text-[#0b2a4a]"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-[28px] text-[26px] font-bold text-[#0b2a4a]">{q.dobQuestion}</p>
      <div className="mt-[14px] grid grid-cols-[1.4fr_1fr_1.2fr] gap-[12px]">
        <select aria-label="month" value={month} onChange={(e) => setMonth(e.target.value)} className={select}>
          <option value="">{locale === "es" ? "Mes" : "Month"}</option>
          {months.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="day" value={day} onChange={(e) => setDay(e.target.value)} className={select}>
          <option value="">{locale === "es" ? "Día" : "Day"}</option>
          {Array.from({ length: 31 }, (_, i) => (
            <option key={i} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select aria-label="year" value={year} onChange={(e) => setYear(e.target.value)} className={select}>
          <option value="">{locale === "es" ? "Año" : "Year"}</option>
          {Array.from({ length: 100 }, (_, i) => (
            <option key={i} value={String(thisYear - i)}>
              {thisYear - i}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!dob || phase === "loading"}
        className="mt-[30px] flex h-[88px] w-full items-center justify-center gap-[12px] rounded-[22px] bg-[#f2735a] text-[32px] font-extrabold text-white shadow-[0_14px_30px_rgba(242,115,90,.35)] disabled:opacity-40"
      >
        {phase === "loading" && <Loader2 className="h-[30px] w-[30px] animate-spin" />}
        {q.see}
      </button>
      {phase === "failed" && <p className="mt-[16px] text-[21px] font-semibold text-[#b45309]">{q.retry}</p>}
    </div>
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
