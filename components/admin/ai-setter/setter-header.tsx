"use client";

/**
 * Top of the panel: is the assistant on, in shadow mode, paused; today's turns / sends / cost;
 * and the two switches Isaac needs fastest (pause everything, "I'm busy for an hour").
 */

import { Bot, Clock, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SettingsResponse } from "./api-types";
import { formatClock, formatUsd, isFuture } from "./format";
import { ACTION_BUTTON_CLASS, BusyIcon, ErrorRow, Pill } from "./ui-bits";
import type { RunAction, ViewState } from "./use-ai-setter-api";

const BUSY_MINUTES = 60;

type SetterHeaderProps = {
  overview: ViewState<SettingsResponse>;
  nowMs: number;
  busyKey: string | null;
  run: RunAction;
};

function StatusPills({ data, nowMs }: { data: SettingsResponse; nowMs: number }) {
  const { config, settings } = data;
  return (
    <div className="flex flex-wrap gap-1.5">
      {config.enabled ? <Pill tone="green">Encendido</Pill> : <Pill tone="slate">Apagado</Pill>}
      {config.dryRun && <Pill tone="violet">Modo sombra</Pill>}
      {settings.paused && <Pill tone="amber">Pausa total</Pill>}
      {settings.failedClosed && <Pill tone="red">Ajustes sin leer: en pausa</Pill>}
      {isFuture(settings.busyUntil, nowMs) && <Pill tone="blue">Ocupado hasta las {formatClock(settings.busyUntil)}</Pill>}
      {config.missing.length > 0 && <Pill tone="red">Falta configurar ({config.missing.length})</Pill>}
    </div>
  );
}

function Counter({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TodayCounters({ data }: { data: SettingsResponse }) {
  const today = data.stats.today;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Counter label="Turnos hoy" value={today ? String(today.turns) : "—"} />
      <Counter label="Envíos hoy" value={today ? String(today.sends) : "—"} />
      <Counter
        label="Costo hoy"
        value={today ? formatUsd(today.costMicros) : "—"}
        hint={`de ${formatUsd(data.config.dailyBudgetUsd * 1_000_000)}`}
      />
    </div>
  );
}

function GlobalButtons({ data, nowMs, busyKey, run }: { data: SettingsResponse; nowMs: number; busyKey: string | null; run: RunAction }) {
  const { paused, busyUntil } = data.settings;
  const isBusy = isFuture(busyUntil, nowMs);
  const disabled = busyKey !== null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {paused ? (
        <Button
          type="button"
          className={ACTION_BUTTON_CLASS}
          disabled={disabled}
          onClick={() => void run("resume_all", { action: "resume_all" }, "La IA vuelve a responder")}
        >
          <BusyIcon busy={busyKey === "resume_all"} icon={<Play />} /> Reanudar todo
        </Button>
      ) : (
        <Button
          type="button"
          variant="destructive"
          className={ACTION_BUTTON_CLASS}
          disabled={disabled}
          onClick={() => void run("pause_all", { action: "pause_all" }, "Todo en pausa: la IA no le responde a nadie")}
        >
          <BusyIcon busy={busyKey === "pause_all"} icon={<Pause />} /> Pausar todo
        </Button>
      )}
      {isBusy ? (
        <Button
          type="button"
          variant="outline"
          className={ACTION_BUTTON_CLASS}
          disabled={disabled}
          onClick={() => void run("set_busy", { action: "set_busy", minutes: 0 }, "Listo: ya estás libre")}
        >
          <BusyIcon busy={busyKey === "set_busy"} icon={<Clock />} /> Ya estoy libre
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={ACTION_BUTTON_CLASS}
          disabled={disabled}
          onClick={() =>
            void run("set_busy", { action: "set_busy", minutes: BUSY_MINUTES }, "Listo: 1 h sin ofrecer «hablar ahora»")
          }
        >
          <BusyIcon busy={busyKey === "set_busy"} icon={<Clock />} /> Estoy ocupado 1 h
        </Button>
      )}
    </div>
  );
}

export function SetterHeader({ overview, nowMs, busyKey, run }: SetterHeaderProps) {
  const data = overview.data;
  return (
    <header className="mb-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Asistente de Citas (IA)</h1>
          <p className="text-sm text-muted-foreground">Responde a los leads por SMS y WhatsApp y les agenda una llamada contigo.</p>
        </div>
      </div>
      {data ? (
        <>
          <StatusPills data={data} nowMs={nowMs} />
          <TodayCounters data={data} />
          <GlobalButtons data={data} nowMs={nowMs} busyKey={busyKey} run={run} />
        </>
      ) : overview.error ? (
        <ErrorRow error={overview.error} onRetry={() => void overview.reload()} />
      ) : (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-label="Cargando estado" />
      )}
    </header>
  );
}
