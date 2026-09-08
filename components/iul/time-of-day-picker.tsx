"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Tap-to-pick time selector for the IUL get-covered funnel's "a specific time" answer.
 *
 * A native <input type="time"> is fiddly on a phone (tiny spinners, a keyboard, an AM/PM
 * field that is easy to miss), so this is three rows of plain buttons instead: hour 1-12,
 * minutes, then AM/PM. Nothing to type.
 *
 * Minutes are quarter-hours on purpose — nobody schedules a callback for 2:23, and four big
 * targets stay readable on the narrowest phone.
 *
 * Value in/out is 24-hour "HH:MM" (the same shape the old input produced), or "" while the
 * selection is still incomplete, so the caller's validation is unchanged.
 */

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"] as const;
const PERIODS = ["AM", "PM"] as const;

type Period = (typeof PERIODS)[number];

export type TimeOfDayPickerLabels = {
  hour: string;
  minutes: string;
  period: string;
};

/** 12-hour parts → "HH:MM". 12 AM is midnight (00), 12 PM is noon (12). */
export function toTwentyFourHour(hour12: number, minute: string, period: Period): string {
  const hours =
    period === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return `${String(hours).padStart(2, "0")}:${minute}`;
}

function parseValue(value: string): {
  hour: number | null;
  minute: string;
  period: Period | null;
} {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hour: null, minute: "00", period: null };
  const hours = Number(match[1]);
  if (!Number.isFinite(hours) || hours > 23) return { hour: null, minute: "00", period: null };
  const period: Period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { hour: hour12, minute: match[2], period };
}

export default function TimeOfDayPicker({
  value,
  onChange,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  labels: TimeOfDayPickerLabels;
}) {
  const initial = parseValue(value);
  const [hour, setHour] = useState<number | null>(initial.hour);
  const [minute, setMinute] = useState<string>(initial.minute);
  const [period, setPeriod] = useState<Period | null>(initial.period);

  /** Emit only a complete time; anything partial reads as "" so Next stays disabled. */
  const emit = (nextHour: number | null, nextMinute: string, nextPeriod: Period | null) => {
    onChange(
      nextHour != null && nextPeriod != null
        ? toTwentyFourHour(nextHour, nextMinute, nextPeriod)
        : ""
    );
  };

  const cellBase =
    "flex h-12 items-center justify-center rounded-xl border-2 text-[16px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--custom)/0.4)]";
  const cellClass = (selected: boolean) =>
    cn(
      cellBase,
      selected
        ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom))] text-white shadow-sm"
        : "border-gray-200 bg-white text-slate-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800/50 dark:text-slate-200 dark:hover:border-gray-600"
    );
  const groupLabel =
    "mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400";

  return (
    <div className="mt-3 rounded-xl border-2 border-gray-200 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-800/30">
      <div role="group" aria-label={labels.hour}>
        <span className={groupLabel}>{labels.hour}</span>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={hour === h}
              onClick={() => {
                setHour(h);
                emit(h, minute, period);
              }}
              className={cellClass(hour === h)}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div role="group" aria-label={labels.minutes}>
          <span className={groupLabel}>{labels.minutes}</span>
          <div className="grid grid-cols-4 gap-2">
            {MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minute === m}
                onClick={() => {
                  setMinute(m);
                  emit(hour, m, period);
                }}
                className={cellClass(minute === m)}
              >
                :{m}
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label={labels.period}>
          <span className={groupLabel}>{labels.period}</span>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => {
                  setPeriod(p);
                  emit(hour, minute, p);
                }}
                className={cellClass(period === p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {hour != null && period != null && (
        <p
          className="mt-4 text-center text-2xl font-bold text-[hsl(var(--custom))]"
          aria-live="polite"
        >
          {hour}:{minute} {period}
        </p>
      )}
    </div>
  );
}
