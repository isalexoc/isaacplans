"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Loader2 } from "lucide-react";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import {
  ageOn,
  householdFromIntake,
  householdSize,
  manualPlans,
  SENIOR_AGE,
  TIERS,
  type ImpactPlan,
  type ImpactTierKey,
} from "@/lib/impact-quote/plans";
import { publishQuote, readStoredQuote } from "@/lib/impact-quote/sync";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

type Prices = Record<ImpactTierKey, string>;
const EMPTY: Prices = { esencial: "", plus: "", premium: "", total: "" };

function pricesFrom(plans: ImpactPlan[]): Prices {
  const out = { ...EMPTY };
  for (const p of plans) if (p.tier) out[p.tier] = String(p.monthly);
  return out;
}

/**
 * The agent's control for the deck's quote slide, in the intake tab (never on the shared screen).
 *
 * The household comes from the form itself — the applicant plus every added person, and the
 * oldest date of birth — so "Quote with Impact" is one click. The four prices stay editable: if
 * Impact's service doesn't answer, Isaac types them from Impact's quote page. Either way the
 * presentation tab updates at once.
 */
export default function ImpactQuotePanel({
  token,
  data,
  locale,
}: {
  token: string;
  data: Record<string, unknown>;
  locale: IntakeLocale;
}) {
  const names = DECK_COPY[locale].quote;
  const { people, oldestDob } = useMemo(() => householdFromIntake(data), [data]);
  const age = oldestDob ? ageOn(oldestDob) : null;
  const members = age !== null && age >= SENIOR_AGE ? 1 : householdSize(people);
  const [prices, setPrices] = useState<Prices>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "live">("idle");

  useEffect(() => {
    const stored = readStoredQuote(token);
    if (stored?.plans.length) {
      setPrices(pricesFrom(stored.plans));
      setStatus("live");
    }
  }, [token]);

  async function quoteWithImpact() {
    if (!oldestDob) return;
    setStatus("loading");
    try {
      const res = await fetch(`/api/impact/quote?dob=${oldestDob}&members=${members}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error("no quote");
      setPrices(pricesFrom(json.plans));
      publishQuote(token, { plans: json.plans, members: json.members, oldestAge: json.age, source: "impact" });
      setStatus("live");
    } catch {
      setStatus("error");
    }
  }

  function typePrice(tier: ImpactTierKey, raw: string) {
    const next = { ...prices, [tier]: raw.replace(/[^\d.]/g, "") };
    setPrices(next);
    const numbers = Object.fromEntries(TIERS.map((t) => [t.key, Number(next[t.key]) || 0])) as Record<ImpactTierKey, number>;
    const plans = manualPlans(numbers);
    publishQuote(token, plans.length ? { plans, members, oldestAge: age, source: "manual" } : null);
    setStatus(plans.length ? "live" : "idle");
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-brand/30 bg-brand/5 p-3">
      <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
        <Calculator className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.quoteTitle, locale)}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {oldestDob ? names.household(members, age) : tr(UI.quoteNeedsDob, locale)}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIERS.map((tier) => (
          <label key={tier.key} className="text-xs font-medium text-muted-foreground">
            {names.names[tier.key].name} · PRA ${tier.pra.toLocaleString("en-US")}
            <input
              inputMode="decimal"
              placeholder={tr(UI.quoteMonthly, locale)}
              value={prices[tier.key]}
              onChange={(e) => typePrice(tier.key, e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={quoteWithImpact}
          disabled={!oldestDob || status === "loading"}
          className={`${OUTLINE_BTN} w-auto px-4 py-2 text-sm disabled:opacity-50`}
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
          {tr(status === "loading" ? UI.quoteFetching : UI.quoteFetch, locale)}
        </button>
        {status === "live" && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> {tr(UI.quoteLive, locale)}
          </span>
        )}
        {status === "error" && <span className="text-sm font-medium text-amber-700">{tr(UI.quoteFailed, locale)}</span>}
      </div>
    </div>
  );
}
