"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CO_SHARE_MAX,
  RECOMMENDED_TIER,
  isQuoteBlock,
  makeQuoteBlock,
  money,
  perDay,
  type HouseholdSize,
  type ImpactPlan,
  type QuoteBlock,
} from "@/lib/impact-quote/plans";
import { GUIDE_SCOPE, publishPlanChoice, stashQuoteBlock } from "@/lib/impact-quote/sync";
import { whatsappHref, type AgentContact } from "@/lib/tenancy/agent-contact";
import { DECK_COPY, type DeckCopy, type DeckLocale } from "./copy";
import { useGuideGate } from "./guide-gate";
import { Glyph } from "./icons";

/**
 * Impact's answer for the visitor's household, with what they told it pinned on when they quoted:
 * how many people (`asked`), the oldest birth date (`dob`, YYYY-MM-DD), the quote's id and time.
 */
type Result = {
  plans: ImpactPlan[];
  members: HouseholdSize;
  age: number;
  senior: boolean;
  under18: boolean;
  asked: HouseholdSize;
  dob: string;
  id: string;
  at: string;
};
/** Kept per tab, across a language switch and a step away and back: answers, prices and the pick. */
type Saved = {
  members: HouseholdSize | null;
  month: string;
  day: string;
  year: string;
  result: Result | null;
  selected?: string;
};
const STORAGE_KEY = "impact-guide-quote";

/**
 * Isaac's "quote image for someone" box. Fetched only when it renders, which is only for an admin:
 * a visitor's page never carries its code or its words.
 */
const GuideQuoteImage = dynamic(() => import("./guide-quote-image"), { ssr: false });

const cardKey = (plan: ImpactPlan) => plan.tier ?? String(plan.pra);

/** The answers behind a result, as the application takes them; null for one saved before they were pinned. */
function blockOf(result: Result): QuoteBlock | null {
  const block: QuoteBlock = {
    id: result.id,
    at: result.at,
    source: "guide",
    asked: result.asked,
    priced: result.members,
    oldestDob: result.dob,
    senior: result.senior,
    under18: result.under18,
  };
  return isQuoteBlock(block) ? block : null;
}

/**
 * The guide's "Choose your plan" screen: two questions a visitor can answer without help (how many
 * people, the oldest one's birth date), then this household's four Impact prices, the cheapest
 * recommended. Kept across a language switch. If Impact's prices can't be fetched, WhatsApp.
 *
 * The pick goes to the application "Apply now" starts (lib/impact-quote/sync.ts, `scope`: "guide"
 * on Isaac's /impact, `guide:<slug>` on an agent's page): the plan in localStorage, the two answers
 * in this tab's sessionStorage only, so no birth date is left in localStorage on this public page.
 * Sent only when the visitor quotes or taps a plan, never when the screen merely shows again. If
 * Impact's prices can't be fetched, the agent's WhatsApp (or "try again" without one).
 *
 * `admin` (Isaac, signed in): under the plans, a box that makes the shareable quote image for
 * whoever he just quoted, from the selected plan and a name he types.
 */
export default function GuideQuote({
  locale,
  admin = false,
  agent,
  scope = GUIDE_SCOPE,
}: {
  locale: DeckLocale;
  admin?: boolean;
  /** Whose guide: the WhatsApp the visitor is sent to when the prices don't come. */
  agent: AgentContact;
  scope?: string;
}) {
  const t = DECK_COPY[locale];
  const q = t.quote;
  const [members, setMembers] = useState<HouseholdSize | null>(null);
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string>(RECOMMENDED_TIER);
  const [phase, setPhase] = useState<"form" | "loading" | "error">("form");
  const gate = useGuideGate();

  // Prices on screen open the way to "Apply now". So does a failed quote: the screen then sends
  // the visitor to WhatsApp, and they must not be stuck here.
  useEffect(() => {
    if (result || phase === "error") gate?.markQuoted();
  }, [result, phase, gate]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as Saved | null;
      if (!saved) return;
      setMembers(saved.members);
      setMonth(saved.month);
      setDay(saved.day);
      setYear(saved.year);
      setResult(saved.result);
      setSelected(saved.selected ?? RECOMMENDED_TIER);
    } catch {
      /* start empty */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ members, month, day, year, result, selected } satisfies Saved)
      );
    } catch {
      /* answers just won't survive a language switch */
    }
  }, [members, month, day, year, result, selected]);

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

  /** The pick, on its way to the application, with the answers behind it. */
  function publish(next: Result, key: string) {
    const plan = next.plans.find((p) => cardKey(p) === key);
    const block = blockOf(next);
    if (block) stashQuoteBlock(scope, block);
    if (!plan?.tier && !block) return;
    publishPlanChoice(scope, {
      tier: plan?.tier ?? null,
      monthly: plan?.tier ? plan.monthly : null,
      at: new Date().toISOString(),
      ...(block ? { quote: block } : {}),
    });
  }

  async function quote() {
    if (!ready || !members) return;
    setPhase("loading");
    try {
      const res = await fetch(`/api/impact/quote?dob=${dob}&members=${members}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error("no quote");
      const answer = { plans: json.plans, members: json.members, age: json.age, senior: json.senior, under18: json.under18 };
      const block = makeQuoteBlock("guide", members, dob, answer);
      const next: Result = { ...answer, asked: members, dob, id: block.id, at: block.at };
      setResult(next);
      setSelected(RECOMMENDED_TIER);
      // What shows as chosen arrives chosen on the application ("Your plan"), where it can still be
      // changed: the highlighted plan counts from the start, not only after a tap.
      publish(next, RECOMMENDED_TIER);
      setPhase("form");
    } catch {
      setPhase("error");
    }
  }

  function choose(key: string) {
    setSelected(key);
    if (result) publish(result, key);
  }

  const select = "h-14 w-full rounded-2xl border-2 border-[#e6e9ef] bg-white px-3 text-base text-[#14243a] focus:border-[#0b2a4a] focus:outline-none";
  // The admin box needs one of the four plans selected and the answers behind the quote.
  const imageBlock = admin && result ? blockOf(result) : null;
  const imagePlan = imageBlock ? result?.plans.find((p) => cardKey(p) === selected) : undefined;
  const whatsapp = whatsappHref(agent.whatsappDigits, t.guide.whatsappText(agent.firstName));

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
        <>
          <Plans t={t} result={result} selected={selected} onSelect={choose} onChange={() => setResult(null)} />
          {imageBlock && imagePlan?.tier && (
            <GuideQuoteImage
              locale={locale}
              tier={imagePlan.tier}
              monthly={imagePlan.monthly}
              asked={imageBlock.asked}
              oldestDob={imageBlock.oldestDob}
              senior={imageBlock.senior}
            />
          )}
        </>
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
          {phase === "error" &&
            (whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
              >
                {q.error(agent.firstName, agent.pronoun)}
              </a>
            ) : (
              <p role="alert" className="block rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {q.retry}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function Plans({
  t,
  result,
  selected,
  onSelect,
  onChange,
}: {
  t: DeckCopy;
  result: Result;
  selected: string;
  onSelect: (key: string) => void;
  onChange: () => void;
}) {
  const q = t.quote;
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
          const key = cardKey(plan);
          const on = selected === key;
          const recommended = plan.tier === RECOMMENDED_TIER;
          const label = plan.tier ? q.names[plan.tier] : { name: `PRA ${money(plan.pra)}`, tagline: "" };
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
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
