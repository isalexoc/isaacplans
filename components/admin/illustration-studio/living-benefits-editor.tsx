"use client";

import { useEffect, useState } from "react";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { defaultLivingBenefitRows } from "@/lib/illustration-studio/defaults";
import { MAX_BENEFIT_ROWS } from "@/lib/illustration-studio/pdf/theme";
import type {
  IllustrationExtraction,
  LivingBenefitPrefix,
  LivingBenefitRow,
  LivingBenefitSource,
} from "@/lib/illustration-studio/types";
import { Field, Flag, formatMoneyInput, parseMoney, Section, SELECT_CLASS } from "./fields";

/** `livingBenefits` is capped at 8 by the API schema. */
const MAX_ROWS = 8;
const SUFFIXES = ["Lump Sum", "Per Month", "Per Year", ""];

const SOURCE_LABEL: Record<LivingBenefitSource, string> = {
  illustration: "From the illustration",
  rider_max: "Rider maximum",
  included: "Rider included, no amount printed",
  manual: "Edited",
};

/** Ages the illustration prints verified benefit amounts for — the only honest "at age N" choices. */
function exampleAges(extraction: IllustrationExtraction): number[] {
  const ages = new Set<number>();
  for (const benefit of extraction.livingBenefits) {
    for (const example of benefit.examples) {
      if (example.verified && example.age !== null) ages.add(example.age);
    }
  }
  return [...ages].sort((a, b) => a - b);
}

/** Fresh amounts for `age`, keeping the agent's show/hide choices, labels and added rows. */
function refill(extraction: IllustrationExtraction, age: number | null, current: LivingBenefitRow[]): LivingBenefitRow[] {
  const fresh = defaultLivingBenefitRows(extraction, age).map((row) => {
    const was = current.find((r) => r.key === row.key);
    return was ? { ...row, show: was.show, label: was.label } : row;
  });
  const added = current.filter((row) => row.source === "manual" && !fresh.some((f) => f.key === row.key));
  return [...fresh, ...added];
}

function valueText(row: LivingBenefitRow): string {
  return row.amount !== null ? formatMoneyInput(row.amount) : row.text;
}

/**
 * One field for the right-hand cell: a dollar amount ("250,000") or words ("Included"). Blank prints
 * "Included".
 */
function ValueInput({ row, onChange }: { row: LivingBenefitRow; onChange: (patch: Pick<LivingBenefitRow, "amount" | "text">) => void }) {
  const [text, setText] = useState(() => valueText(row));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(valueText(row));
  }, [row, focused]);

  return (
    <Input
      aria-label={`${row.label} amount`}
      autoComplete="off"
      maxLength={60}
      placeholder="Included"
      className="tabular-nums"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setText(e.target.value);
        const amount = parseMoney(e.target.value);
        onChange(
          typeof amount === "number" ? { amount, text: "" } : { amount: null, text: amount === null ? "" : e.target.value.trim() }
        );
      }}
    />
  );
}

export default function LivingBenefitsEditor({
  rows,
  age,
  extraction,
  onChange,
}: {
  rows: LivingBenefitRow[];
  age: number | null;
  extraction: IllustrationExtraction;
  onChange: (next: { rows: LivingBenefitRow[]; age: number | null }) => void;
}) {
  const ages = exampleAges(extraction);
  if (age !== null && !ages.includes(age)) ages.push(age);
  ages.sort((a, b) => a - b);
  const shown = rows.filter((row) => row.show).length;

  function setRow(index: number, patch: Partial<LivingBenefitRow>, edited = true) {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch, ...(edited ? { source: "manual" as const } : {}) } : row));
    onChange({ rows: next, age });
  }

  function addRow() {
    const row: LivingBenefitRow = {
      key: `custom-${Date.now().toString(36)}`,
      label: "Living Benefit",
      show: true,
      prefix: "",
      amount: null,
      text: "Included",
      suffix: "",
      source: "manual",
    };
    onChange({ rows: [...rows, row], age });
  }

  return (
    <Section
      title="If I Become Ill — living benefits"
      description="Accelerated benefit riders on this policy. Amounts the illustration prints come first; when it prints none, the rider's maximum share of the death benefit is shown as “Up to”."
      action={
        <Button variant="ghost" size="sm" onClick={() => onChange({ rows: defaultLivingBenefitRows(extraction, age), age })}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
      }
    >
      <Field
        label="Values shown at age"
        htmlFor="lb-age"
        className="max-w-xs"
        hint={
          ages.length > 0
            ? "Changing the age refills the amounts from the illustration."
            : "The illustration prints no age-by-age benefit amounts, so the table shows the riders' terms."
        }
      >
        <select
          id="lb-age"
          className={SELECT_CLASS}
          value={age ?? ""}
          onChange={(e) => {
            const nextAge = e.target.value === "" ? null : Number(e.target.value);
            onChange({ rows: refill(extraction, nextAge, rows), age: nextAge });
          }}
        >
          <option value="">No age — the riders&apos; terms</option>
          {ages.map((a) => (
            <option key={a} value={a}>
              Age {a}
            </option>
          ))}
        </select>
      </Field>

      <div className="mt-4 space-y-2">
        {rows.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            The illustration lists no living-benefit riders, so the panel says so. Add a row to show one anyway.
          </p>
        )}
        {rows.map((row, index) => (
          <div key={row.key} className={`rounded-md border p-3 ${row.show ? "" : "bg-muted/40 opacity-70"}`}>
            <div className="flex items-center gap-2">
              <Checkbox
                aria-label={`Show ${row.label}`}
                checked={row.show}
                onCheckedChange={(checked) => setRow(index, { show: checked === true }, false)}
              />
              <Input
                aria-label="Benefit name"
                maxLength={80}
                value={row.label}
                onChange={(e) => setRow(index, { label: e.target.value }, false)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                title="Remove this row"
                onClick={() => onChange({ rows: rows.filter((_, i) => i !== index), age })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)_7.5rem] gap-2 pl-6">
              <select
                aria-label="Prefix"
                className={SELECT_CLASS}
                value={row.prefix}
                onChange={(e) => setRow(index, { prefix: e.target.value as LivingBenefitPrefix })}
              >
                <option value="">—</option>
                <option value="Up to">Up to</option>
              </select>
              <ValueInput row={row} onChange={(patch) => setRow(index, patch)} />
              <select
                aria-label="Paid as"
                className={SELECT_CLASS}
                value={row.suffix}
                onChange={(e) => setRow(index, { suffix: e.target.value })}
              >
                {!SUFFIXES.includes(row.suffix) && <option value={row.suffix}>{row.suffix}</option>}
                {SUFFIXES.map((suffix) => (
                  <option key={suffix} value={suffix}>
                    {suffix || "—"}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{SOURCE_LABEL[row.source]}</p>
          </div>
        ))}
      </div>

      {shown > MAX_BENEFIT_ROWS && (
        <Flag>
          {shown} rows are ticked but only {MAX_BENEFIT_ROWS} fit on the page — the last {shown - MAX_BENEFIT_ROWS} won&apos;t print.
        </Flag>
      )}

      {rows.length < MAX_ROWS && (
        <Button variant="outline" size="sm" className="mt-3" onClick={addRow}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add a row
        </Button>
      )}
    </Section>
  );
}
