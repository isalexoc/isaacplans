"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  formatPremiumDisplay,
  formatWholeDollarDisplay,
  normalizePremiumOnBlur,
  parseWholeDollarInput,
  sanitizePremiumInput,
} from "@/lib/leave-behind-money-input";

type MoneyFieldProps = {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
};

function DollarAdornment() {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
      $
    </span>
  );
}

/** Whole-dollar coverage (no cents). */
export function LeaveBehindWholeDollarField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  error,
  className,
}: MoneyFieldProps) {
  const stored = parseWholeDollarInput(value);
  const display = formatWholeDollarDisplay(stored);

  return (
    <div className={cn("space-y-2", className)}>
      {label}
      <div className="relative">
        <DollarAdornment />
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={display}
          onChange={(e) => onChange(parseWholeDollarInput(e.target.value))}
          className={cn("pl-7", error && "border-red-500")}
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {hint}
    </div>
  );
}

/** Monthly premium with up to 2 decimal places; blurs to .00. */
export function LeaveBehindPremiumField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  error,
  className,
}: MoneyFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label}
      <div className="relative">
        <DollarAdornment />
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={formatPremiumDisplay(value)}
          onChange={(e) => onChange(sanitizePremiumInput(e.target.value))}
          onBlur={() => onChange(normalizePremiumOnBlur(value))}
          className={cn("pl-7", error && "border-red-500")}
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {hint}
    </div>
  );
}
