"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { DECK_COPY } from "@/components/impact-presentation/copy";
import {
  ageOn,
  householdFromIntake,
  householdSize,
  money,
  RECOMMENDED_TIER,
  SENIOR_AGE,
  TIERS,
  type ImpactPlan,
  type ImpactTierKey,
} from "@/lib/impact-quote/plans";
import type { IntakeField } from "@/lib/intake-core/types";
import { UI, fieldLabel, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

/**
 * "Your plan" on the Health Coverage form: the four Impact plans as cards, priced live for the
 * household this same form describes (applicant + added people, oldest birth date), the cheapest
 * recommended. Usually arrives already chosen from the presentation or the self-serve quote; the
 * client can change it here.
 *
 * The chosen plan's monthly price follows the quote, so adding a family member re-prices it. When
 * there's no quote (birth dates not filled in yet, or Impact not answering) the cards still pick a
 * plan, and the agent can type the price.
 */
export default function ImpactPlanPicker({
  field,
  value,
  monthly,
  data,
  locale,
  isOwner,
  invalid,
  onPick,
  onMonthly,
}: {
  field: IntakeField;
  value: string;
  monthly: string;
  data: Record<string, unknown>;
  locale: IntakeLocale;
  isOwner: boolean;
  invalid: boolean;
  onPick: (tier: ImpactTierKey, monthly: number | null) => void;
  onMonthly: (monthly: string) => void;
}) {
  const q = DECK_COPY[locale].quote;
  const { people, oldestDob } = useMemo(() => householdFromIntake(data), [data]);
  const age = oldestDob ? ageOn(oldestDob) : null;
  const members = age !== null && age >= SENIOR_AGE ? 1 : householdSize(people);
  const [plans, setPlans] = useState<ImpactPlan[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oldestDob) {
      setPlans(null);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/impact/quote?dob=${oldestDob}&members=${members}`)
      .then((res) => res.json())
      .then((json) => active && setPlans(json?.success ? (json.plans as ImpactPlan[]) : null))
      .catch(() => active && setPlans(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [oldestDob, members]);

  const priceOf = (tier: string): number | null => plans?.find((p) => p.tier === tier)?.monthly ?? null;

  // Keep the stored price in step with this household's quote (a family member added, say).
  useEffect(() => {
    const price = value ? priceOf(value) : null;
    if (price !== null && Number(monthly) !== price) onMonthly(price.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, plans]);

  const shownPrice = Number(monthly) > 0 ? money(Number(monthly), true) : "";

  return (
    <div>
      <Label className={invalid ? "text-red-600" : ""}>
        {fieldLabel(field, locale)}
        {field.required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      <p className="mt-1 text-sm text-muted-foreground">{tr(UI.planNote, locale)}</p>
      <div role="radiogroup" className="mt-3 grid gap-2 sm:grid-cols-2">
        {TIERS.map((tier) => {
          const selected = value === tier.key;
          const price = priceOf(tier.key);
          const names = q.names[tier.key];
          return (
            <button
              key={tier.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onPick(tier.key, price)}
              className={`relative rounded-xl border p-3 text-left transition ${
                selected
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : `${invalid ? "border-red-500" : "border-input"} hover:border-brand`
              }`}
            >
              {tier.key === RECOMMENDED_TIER && (
                <span className="absolute -top-2 right-3 rounded-full bg-[#f2735a] px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-white">
                  {q.recommended}
                </span>
              )}
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className={`font-bold ${selected ? "text-brand" : "text-foreground"}`}>{names.name}</p>
                  <p className="text-xs text-muted-foreground">PRA {money(tier.pra)}</p>
                </div>
                <p className="whitespace-nowrap text-lg font-extrabold text-foreground">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : price !== null ? (
                    <>
                      {money(price)}
                      <span className="text-xs font-medium text-muted-foreground">{q.perMonth}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {!oldestDob && <p className="mt-2 text-xs text-muted-foreground">{tr(UI.planPriceLater, locale)}</p>}
      {value && shownPrice && (
        <p className="mt-2 text-sm font-semibold text-foreground">
          {tr(UI.planMonthly, locale)} {shownPrice}
        </p>
      )}
      {/* Without a quote the agent types the price Impact gave; the client never has to. */}
      {isOwner && value && priceOf(value) === null && (
        <input
          inputMode="decimal"
          placeholder={tr(UI.quoteMonthly, locale)}
          value={monthly}
          onChange={(e) => onMonthly(e.target.value.replace(/[^\d.]/g, ""))}
          className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:w-48"
        />
      )}
    </div>
  );
}
