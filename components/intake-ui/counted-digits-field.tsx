"use client";

import { CheckCircle2 } from "lucide-react";
import { isMaskedValue } from "@/lib/intake-shared/masking";
import { BIG_INPUT } from "./styles";

export type CountedDigitsLabels = {
  /** Shown when the field holds the right number of digits. */
  looksGood: string;
  /** Countdown copy containing a literal `{n}` placeholder for the digits remaining. */
  remaining: string;
  /** Shown instead of `looksGood` when the value is a stored mask. */
  masked?: string;
};

/**
 * A digit field that formats as you type and always says why it is not finished yet.
 *
 * The point is the line underneath: "4 more digits to go" → "Looks good". A phone number or an
 * SSN is the most common place a form silently refuses to advance, and this removes the guessing
 * by counting out loud instead of turning red.
 *
 * Moved out of `components/fe-intake/intake-form.tsx` with two API changes:
 *
 *  - **`labels` replaces `locale`.** The original reached into `lib/fe-intake/ui-strings`, which
 *    would have dragged the whole FE string table into IUL. Callers pass the three strings they
 *    already have translated.
 *  - **`autoFocus` is opt-in.** FE hardcoded it because it renders exactly one field per screen.
 *    A step with eighteen fields must not have them all fighting for the cursor.
 *
 * A masked value (`•••••6789`) is shown as-is and cleared on focus, so typing replaces it rather
 * than appending digits to bullets.
 */
export function CountedDigitsField({
  value,
  onChange,
  onBlur,
  format,
  digitsNeeded,
  labels,
  placeholder,
  inputMode = "numeric",
  autoComplete,
  autoFocus = false,
  disabled = false,
  id,
  invalid = false,
  secret = false,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: (v: string) => void;
  format: (raw: string) => string;
  digitsNeeded: number;
  labels: CountedDigitsLabels;
  placeholder?: string;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  /** Force the invalid treatment even when the digit count happens to be right. */
  invalid?: boolean;
  /**
   * Render the digits as dots. The counter line underneath still says how many are left, which is
   * why an obscured field here is still usable — you are told your progress without the number
   * being readable by whoever is watching the screen.
   */
  secret?: boolean;
  className?: string;
}) {
  const masked = isMaskedValue(value);
  const digitCount = value.replace(/\D/g, "").length;
  const complete = !masked && digitCount === digitsNeeded;
  const remaining = digitsNeeded - digitCount;

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          autoFocus={autoFocus}
          // A masked value is bullets already; forcing type=password on top would hide the fact
          // that something is on file, which is the one thing the mask exists to communicate.
          type={secret && !masked ? "password" : "text"}
          inputMode={inputMode}
          autoComplete={autoComplete}
          disabled={disabled}
          value={masked ? value : format(value)}
          onFocus={() => {
            // A stored sensitive value shows as a mask; focusing to edit starts it fresh.
            if (masked) onChange("");
          }}
          onChange={(e) => onChange(format(e.target.value))}
          onBlur={(e) => onBlur?.(e.target.value)}
          aria-invalid={invalid || (!masked && digitCount > 0 && !complete)}
          placeholder={placeholder}
          className={`${className || BIG_INPUT} pr-12 tracking-wide ${
            complete && !invalid ? "border-green-500" : ""
          }`}
        />
        {(complete || masked) && !invalid && (
          <CheckCircle2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-green-600" />
        )}
      </div>
      <p
        className={`mt-2 text-xs ${
          (complete || masked) && !invalid ? "text-green-600" : "text-muted-foreground"
        }`}
      >
        {masked
          ? (labels.masked ?? labels.looksGood)
          : complete
            ? labels.looksGood
            : labels.remaining.replace("{n}", String(Math.max(0, remaining)))}
      </p>
    </div>
  );
}
