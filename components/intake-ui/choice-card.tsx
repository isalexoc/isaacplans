"use client";

import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * A tappable option card — the control that replaces a native radio or a two-option `<select>`.
 *
 * Moved out of `components/fe-intake/intake-form.tsx` unchanged, except that the icon is now
 * optional. FE always passes one because its options are a fixed, hand-curated set (relationship,
 * gender, medication category) where an icon per value is worth drawing. IUL's options are
 * generated from a field config — "Single / Married / Divorced / Widowed", "Living / Deceased" —
 * and inventing an icon for each would be noise standing in for meaning. With no icon the label
 * takes the space and the card still reads as tappable.
 *
 * Emits `role="radio"` + `aria-checked` by default, so wrap a group in `role="radiogroup"`.
 * Pass `role="checkbox"` for a genuinely multi-select group (wrapped in a `role="group"`) — five
 * cards that announce as radios but let you pick several tells a screen reader user the opposite
 * of what the control does.
 */
export function ChoiceCard({
  selected,
  icon: Icon,
  label,
  onClick,
  disabled = false,
  role = "radio",
}: {
  selected: boolean;
  icon?: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  role?: "radio" | "checkbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition disabled:opacity-60 ${
        selected
          ? "border-brand bg-brand/5"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      }`}
    >
      {Icon && (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            selected ? "bg-brand text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{label}</span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-brand bg-brand" : "border-gray-300 dark:border-gray-700"
        }`}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </span>
    </button>
  );
}
