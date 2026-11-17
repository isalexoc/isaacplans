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
} from "@/lib/impact-quote/plans";
import { publishPlanChoice } from "@/lib/impact-quote/sync";
import { AGENT, DECK_COPY, type DeckCopy, type DeckLocale } from "./copy";
import { Glyph } from "./icons";

type Result = { plans: ImpactPlan[]; members: HouseholdSize; age: number; senior: boolean; under18: boolean };
type Saved = { members: HouseholdSize | null; month: string; day: string; year: string; result: Result | null };
const STORAGE_KEY = "impact-guide-quote";

/**
 * The guide's "Choose your plan" screen: two questions a visitor can answer without help (how many
 * people, the oldest one's birth date), then this household's four Impact prices, the cheapest
 * recommended. Kept across a language switch. If Impact's prices can't be fetched, WhatsApp.
 */
export default function GuideQuote({ locale }: { locale: DeckLocale }) {
  const t = DECK_COPY[locale];
  const q = t.quote;
  const [members, setMembers] = useState<HouseholdSize | null>(null);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [phase, setPhase] = useState<"form" | "loading" | "error">("form");

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Saved | null;
      if (!saved) return;
      setMembers(saved.members);
      setMonth(saved.month);
      setDay(saved.day);
      setYear(saved.year);
      setResult(saved.result);
    } catch {
      /* start empty */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ members, month, day, year, result } satisfies Saved));
    } catch {
      /* answers just won't survive a language switch */
    }
  }, [members, month, day, year, result]);

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
  const dob = month && day && year ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  const ready = Boolean(members && dob);

  async function quote() {
    if (!ready) return;
    setPhase("loading");
    try {
      const res = await fetch(`/api/impact/quote?dob=${dob}&members=${members}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error("no quote");
      setResult({ plans: json.plans, members: json.members, age: json.age, senior: json.senior, under18: json.under18 });
      setPhase("form");
    } catch {
      setPhase("error");
    }
  }

  const select = "h-14 w-full rounded-2xl border-2 border-[#e6e9ef] bg-white px-3 text-base text-[#14243a] focus:border-[#0b2a4a] focus:outline-none";

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.14em] text-[#f2735a] sm:text-sm">{q.kicker}</p>
      <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-[#0b2a4a] sm:text-4xl">{q.title}</h2>

      <div className="mt-5 rounded-3xl bg-[#d6f2ee] px-5 py-4">
        <p className="flex items-center gap-2.5 text-base font-bold text-[#0b2a4a]">
          <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#2f97a0]">
            <Glyph name="check" strokeWidth={3.2} className="h-3.5 w-3.5 text-white" />
          </span>
          {q.allIncludedTitle}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {q.allIncluded.map((item) => (
            <span key={item} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-[#0b2a4a]">
              {item}
            </span>
          ))}
        </div>
      </div>

      {result ? (
        <Plans t={t} result={result} onChange={() => setResult(null)} />
      ) : (
        <div className="mt-6 space-y-5">
          <fieldset>
            <legend className="mb-2 text-base font-bold text-[#0b2a4a]">{q.membersQuestion}</legend>
            <div className="grid grid-cols-3 gap-2">
              {q.members.map((label, i) => {
                const value = (i + 1) as HouseholdSize;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setMembers(value)}
                    aria-pressed={members === value}
                    className={cn(
                      "h-14 rounded-2xl border-2 px-2 text-base font-bold transition",
                      members === value ? "border-[#0b2a4a] bg-[#0b2a4a] text-white" : "border-[#e6e9ef] bg-white text-[#0b2a4a]"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-base font-bold text-[#0b2a4a]">{q.dobQuestion}</legend>
            <div className="grid grid-cols-[1.4fr_1fr_1.2fr] gap-2">
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
          </fieldset>
          <button
            type="button"
            onClick={quote}
            disabled={!ready || phase === "loading"}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0b2a4a] text-lg font-extrabold text-white transition disabled:opacity-40"
          >
            {phase === "loading" && <Loader2 className="h-5 w-5 animate-spin" />}
            {q.see}
          </button>
          {phase === "error" && (
            <a
              href={`https://wa.me/${AGENT.whatsappDigits}?text=${encodeURIComponent(t.guide.whatsappText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
            >
              {q.error}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function Plans({ t, result, onChange }: { t: DeckCopy; result: Result; onChange: () => void }) {
  const q = t.quote;
  const [selected, setSelected] = useState<string>(RECOMMENDED_TIER);

  /**
   * What shows as chosen here arrives chosen on the application ("Your plan"), where it can still
   * be changed: the highlighted plan counts from the start, not only after a tap.
   */
  useEffect(() => {
    const plan = result.plans.find((p) => (p.tier ?? String(p.pra)) === selected);
    if (plan?.tier) publishPlanChoice("guide", { tier: plan.tier, monthly: plan.monthly });
  }, [result, selected]);
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-[#e6e9ef] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#0b2a4a]">
          {q.household(result.members, result.age)}
        </span>
        <button type="button" onClick={onChange} className="text-sm font-semibold text-[#0b2a4a] underline">
          {q.change}
        </button>
      </div>
      {result.under18 && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#56657a]">{q.under18}</p>}
      {result.senior && <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#56657a]">{q.senior}</p>}
      <div className="mt-5 space-y-4">
        {result.plans.map((plan) => {
          const key = plan.tier ?? String(plan.pra);
          const on = selected === key;
          const recommended = plan.tier === RECOMMENDED_TIER;
          const label = plan.tier ? q.names[plan.tier] : { name: `PRA ${money(plan.pra)}`, tagline: "" };
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              aria-pressed={on}
              className={cn(
                "relative w-full rounded-3xl border-2 px-5 text-left transition",
                recommended ? "py-5" : "py-4",
                on ? "border-[#0b2a4a] bg-[#0b2a4a] text-white shadow-[0_16px_36px_rgba(11,42,74,.3)]" : "border-[#e6e9ef] bg-white text-[#0b2a4a]"
              )}
            >
              {recommended && (
                <span className="absolute -top-3 right-4 rounded-full bg-[#f2735a] px-3 py-1 text-[11px] font-extrabold tracking-[.06em] text-white">
                  {q.recommended}
                </span>
              )}
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={cn("font-extrabold leading-none", recommended ? "text-2xl" : "text-xl")}>{label.name}</p>
                  {label.tagline && <p className={cn("mt-1 text-sm", on ? "text-white/75" : "text-[#56657a]")}>{label.tagline}</p>}
                </div>
                <div className="text-right">
                  <p className={cn("whitespace-nowrap font-extrabold leading-none", recommended ? "text-4xl" : "text-3xl")}>
                    <span className={cn(on && "text-[#ff8f74]")}>{money(plan.monthly)}</span>
                    <span className={cn("text-sm font-medium", on ? "text-white/75" : "text-[#56657a]")}>{q.perMonth}</span>
                  </p>
                  <p className={cn("mt-1 text-xs", on ? "text-white/75" : "text-[#56657a]")}>{q.perDay(money(perDay(plan.monthly), true))}</p>
                </div>
              </div>
              <div className={cn("mt-3 flex flex-wrap gap-1.5 border-t pt-3 text-xs", on ? "border-white/15" : "border-[#e6e9ef]")}>
                {[
                  [q.pra, money(plan.pra)],
                  [q.then, "90/10"],
                  [q.max, money(plan.pra + CO_SHARE_MAX)],
                ].map(([k, v]) => (
                  <span key={k} className={cn("rounded-lg px-2 py-1", on ? "bg-white/10" : "bg-[#fbf6f2]")}>
                    {k}: <b>{v}</b>
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#56657a]">{q.note}</p>
      <p className="mt-2 text-sm font-bold text-[#0b2a4a]">{q.fee}</p>
    </div>
  );
}
