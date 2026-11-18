"use client";

/**
 * Isaac's weekly hours: 7 days × up to 6 windows, in his zone. Mount it with
 * `key={scheduleKey(schedule)}` so a background reload never wipes an edit in progress, while a
 * saved change (the server normalizes it) starts a fresh draft.
 */

import { useState } from "react";
import { Plus, Save, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { TimeWindow, Weekday, WeeklySchedule } from "@/lib/ai-setter/types";
import {
  MAX_WINDOWS_PER_DAY,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  cloneSchedule,
  endFromInput,
  endToInput,
  isScheduleValid,
  scheduleKey,
  sortedSchedule,
  suggestWindow,
  windowErrors,
  withDay,
} from "./schedule-utils";
import { BusyIcon } from "./ui-bits";
import type { RunAction } from "./use-ai-setter-api";

type ScheduleEditorProps = {
  schedule: WeeklySchedule;
  busyKey: string | null;
  run: RunAction;
  onSaved: () => Promise<void>;
};

const SAVE_KEY = "save_schedule";

function zoneText(timeZone: string): string {
  return timeZone === "America/New_York" ? "hora del Este (Nueva York)" : timeZone;
}

type DayRowProps = {
  day: Weekday;
  windows: TimeWindow[];
  disabled: boolean;
  onChange: (windows: TimeWindow[]) => void;
};

function DayRow({ day, windows, disabled, onChange }: DayRowProps) {
  const errors = windowErrors(windows);
  const suggestion = windows.length < MAX_WINDOWS_PER_DAY ? suggestWindow(windows) : null;
  const update = (index: number, patch: Partial<TimeWindow>) =>
    onChange(windows.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{WEEKDAY_LABELS[day]}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          disabled={disabled || !suggestion}
          onClick={() => suggestion && onChange([...windows, suggestion])}
        >
          <Plus /> Agregar
        </Button>
      </div>
      {windows.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Sin horario: ese día no se ofrecen llamadas.</p>}
      {windows.map((window, index) => (
        <div key={index} className="mt-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Input
              type="time"
              value={window.start}
              disabled={disabled}
              aria-label={`${WEEKDAY_LABELS[day]}: inicio del horario ${index + 1}`}
              onChange={(e) => update(index, { start: e.target.value })}
              className="min-w-0 flex-1 px-2"
            />
            <span className="text-sm text-muted-foreground">a</span>
            <Input
              type="time"
              value={endToInput(window.end)}
              disabled={disabled}
              aria-label={`${WEEKDAY_LABELS[day]}: fin del horario ${index + 1}`}
              onChange={(e) => update(index, { end: endFromInput(e.target.value) })}
              className="min-w-0 flex-1 px-2"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              disabled={disabled}
              aria-label={`Quitar horario ${index + 1} del ${WEEKDAY_LABELS[day].toLowerCase()}`}
              onClick={() => onChange(windows.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </Button>
          </div>
          {errors[index] && <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{errors[index]}</p>}
        </div>
      ))}
    </div>
  );
}

export function ScheduleEditor({ schedule, busyKey, run, onSaved }: ScheduleEditorProps) {
  const [draft, setDraft] = useState<WeeklySchedule>(() => cloneSchedule(schedule));
  const dirty = scheduleKey(draft) !== scheduleKey(schedule);
  const valid = isScheduleValid(draft);
  const disabled = busyKey !== null;

  const save = async () => {
    const ok = await run(SAVE_KEY, { action: "save_schedule", schedule: sortedSchedule(draft) }, "Horario guardado");
    if (ok) await onSaved();
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base">Horario de Isaac</CardTitle>
        <CardDescription>
          Cuándo puedes llamar, en {zoneText(schedule.timeZone)}. La IA solo ofrece horas dentro de estos horarios
          (y de 9 a. m. a 9 p. m. en la zona del lead). Un fin a las 12:00 a. m. (00:00) es medianoche.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {WEEKDAY_ORDER.map((day) => (
          <DayRow
            key={day}
            day={day}
            windows={draft.days[day] ?? []}
            disabled={disabled}
            onChange={(windows) => setDraft((d) => withDay(d, day, windows))}
          />
        ))}
        {dirty && !valid && (
          <p className="text-sm font-medium text-red-600 dark:text-red-400">Corrige los horarios marcados antes de guardar.</p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" disabled={disabled || !dirty || !valid} onClick={() => void save()}>
            <BusyIcon busy={busyKey === SAVE_KEY} icon={<Save />} /> Guardar horario
          </Button>
          <Button type="button" variant="ghost" disabled={disabled || !dirty} onClick={() => setDraft(cloneSchedule(schedule))}>
            <Undo2 /> Deshacer cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
