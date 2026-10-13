"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultCashValueBars } from "@/lib/illustration-studio/defaults";
import { formatCurrency } from "@/lib/illustration-studio/format";
import type { CashValueBar, LedgerRow } from "@/lib/illustration-studio/types";
import { Flag, MoneyInput, Section, SELECT_CLASS } from "./fields";

/** The chart is laid out for four bars (see CashValueChart in pdf/offers-page.tsx). */
const MAX_BARS = 4;

function byAge(bars: CashValueBar[]): CashValueBar[] {
  return [...bars].sort((a, b) => a.age - b.age);
}

/** The ledger age closest to `target` that isn't charted yet. */
function nextLedgerAge(rows: LedgerRow[], taken: Set<number>, target: number): LedgerRow | undefined {
  return rows
    .filter((row) => !taken.has(row.age))
    .reduce<LedgerRow | undefined>(
      (best, row) => (!best || Math.abs(row.age - target) < Math.abs(best.age - target) ? row : best),
      undefined
    );
}

export default function CashValueEditor({
  bars,
  ledger,
  issueAge,
  onChange,
}: {
  bars: CashValueBar[];
  ledger: LedgerRow[];
  issueAge: number | null;
  onChange: (bars: CashValueBar[]) => void;
}) {
  const rows = ledger.filter((row) => row.cashSurrenderValue !== null);
  const rowAt = (age: number) => rows.find((row) => row.age === age);
  const taken = new Set(bars.map((bar) => bar.age));

  /** Typed values never re-sort: the row would move out from under the cursor. */
  function setBar(index: number, next: CashValueBar) {
    onChange(bars.map((bar, i) => (i === index ? next : bar)));
  }

  function pickAge(index: number, age: number) {
    const row = rowAt(age);
    const next = { age, value: row?.cashSurrenderValue ?? bars[index].value };
    onChange(byAge(bars.map((bar, i) => (i === index ? next : bar))));
  }

  function addBar() {
    const last = bars[bars.length - 1]?.age ?? Math.max(65, (issueAge ?? 55) + 10);
    const target = bars.length === 0 ? last : last + 5;
    const row = nextLedgerAge(rows, taken, target);
    const bar = row ? { age: row.age, value: row.cashSurrenderValue ?? 0 } : { age: target, value: 0 };
    onChange(byAge([...bars, bar]));
  }

  const defaults = defaultCashValueBars(ledger, issueAge);

  return (
    <Section
      title="If I Need Cash — cash value chart"
      description="The illustration's current-scale cash surrender value at each age. Pick an age and its value fills in from the ledger."
      action={
        defaults.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(defaults)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        ) : null
      }
    >
      {rows.length === 0 && (
        <Flag>No ledger was found in the illustration — type each age and its cash value from the PDF.</Flag>
      )}

      <div className="mt-2 space-y-3">
        {bars.map((bar, index) => {
          const row = rowAt(bar.age);
          const edited = row?.cashSurrenderValue != null && row.cashSurrenderValue !== bar.value;
          return (
            <div key={index}>
              <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_auto] items-center gap-2">
                {rows.length > 0 ? (
                  <select
                    aria-label={`Bar ${index + 1} age`}
                    className={SELECT_CLASS}
                    value={bar.age}
                    onChange={(e) => pickAge(index, Number(e.target.value))}
                  >
                    {!row && <option value={bar.age}>Age {bar.age}</option>}
                    {rows.map((r) => (
                      <option key={r.age} value={r.age} disabled={taken.has(r.age) && r.age !== bar.age}>
                        Age {r.age}
                        {r.verified ? "" : " ⚠"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    aria-label={`Bar ${index + 1} age`}
                    type="number"
                    min={0}
                    max={125}
                    value={bar.age}
                    onChange={(e) => setBar(index, { ...bar, age: Number(e.target.value) || 0 })}
                    onBlur={() => onChange(byAge(bars))}
                  />
                )}
                <MoneyInput
                  id={`bar-${index}`}
                  value={bar.value}
                  invalid={row ? !row.verified : false}
                  onChange={(value) => setBar(index, { ...bar, value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove this bar"
                  onClick={() => onChange(bars.filter((_, i) => i !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {row && !row.verified ? (
                <Flag>
                  Age {row.age}&apos;s numbers couldn&apos;t be matched to one row of the illustration — check this value against the ledger.
                </Flag>
              ) : edited ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Edited — the illustration shows {formatCurrency(row.cashSurrenderValue ?? 0)}.{" "}
                  <button
                    type="button"
                    className="text-brand hover:underline"
                    onClick={() => setBar(index, { ...bar, value: row.cashSurrenderValue ?? 0 })}
                  >
                    Use it
                  </button>
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {bars.length < MAX_BARS && (
        <Button variant="outline" size="sm" className="mt-3" onClick={addBar}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add an age
        </Button>
      )}
    </Section>
  );
}
