"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Native select styled like the shadcn Input, same as the Call Study uploader. */
export const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {action}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Amber note under a field: a number the grounding check couldn't find, a blank the cover needs. */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  flag,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  flag?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-1">{children}</div>
      {flag ? <Flag>{flag}</Flag> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const WITH_CENTS = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatMoneyInput(value: number | null, cents = false): string {
  if (value === null) return "";
  return (cents ? WITH_CENTS : WHOLE).format(value);
}

/** "$2,400.50" → 2400.5; "" → null; anything that isn't a dollar amount → undefined. */
export function parseMoney(text: string): number | null | undefined {
  const cleaned = text.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return undefined;
  return Number(cleaned);
}

/**
 * Dollar input that keeps what the agent typed while they type, and reformats ("391,871") on blur.
 * A value changed from outside — picking a chart age, a reset — shows up whenever the field isn't
 * focused.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  cents = false,
  invalid = false,
  placeholder,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  cents?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => formatMoneyInput(value, cents));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatMoneyInput(value, cents));
  }, [value, cents, focused]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        className={`pl-6 tabular-nums ${invalid ? "border-amber-500 focus-visible:ring-amber-500" : ""}`}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const parsed = parseMoney(e.target.value);
          if (parsed !== undefined) onChange(parsed ?? 0);
        }}
      />
    </div>
  );
}
