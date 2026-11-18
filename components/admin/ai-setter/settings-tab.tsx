"use client";

/** Ajustes: config status, templates, Isaac's hours, the slot preview and last week's activity. */

import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { MessageStatus } from "@/lib/ai-setter/types";
import type { ConfigStatus, PreviewResponse, SettingsResponse } from "./api-types";
import { formatUsd } from "./format";
import { MESSAGE_STATUS_META } from "./labels";
import { ScheduleEditor } from "./schedule-editor";
import { scheduleKey } from "./schedule-utils";
import { SlotPreview } from "./slot-preview";
import { TemplatesPanel } from "./templates-panel";
import { ErrorRow, LoadingRow, Notice, Pill } from "./ui-bits";
import type { RunAction, ViewState } from "./use-ai-setter-api";

/** The statuses worth a tile, in reading order. */
const ACTIVITY_STATUSES: readonly MessageStatus[] = [
  "sent",
  "draft",
  "shadow",
  "approved",
  "rejected",
  "stale",
  "blocked",
  "send_unknown",
  "failed",
  "superseded",
];

function ConfigRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function ConfigCard({ config, failedClosed }: { config: ConfigStatus; failedClosed: boolean }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base">Estado</CardTitle>
        <CardDescription>Lo fijan las variables de entorno de Vercel; desde aquí solo se puede restringir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        {failedClosed && (
          <Notice tone="red">No se pudieron leer los ajustes guardados: el asistente queda en pausa por seguridad.</Notice>
        )}
        <div>
          <ConfigRow label="Asistente (AI_SETTER_ENABLED)">
            {config.enabled ? <Pill tone="green">Encendido</Pill> : <Pill tone="slate">Apagado</Pill>}
          </ConfigRow>
          <ConfigRow label="Modo sombra (AI_SETTER_DRY_RUN)">
            {config.dryRun ? <Pill tone="violet">Sí: no envía nada</Pill> : <Pill tone="green">No: envía de verdad</Pill>}
          </ConfigRow>
          <ConfigRow label="Modelo">
            <span className="font-mono text-xs">{config.model}</span> · esfuerzo {config.effort}
          </ConfigRow>
          <ConfigRow label="Presupuesto diario">{formatUsd(config.dailyBudgetUsd * 1_000_000)}</ConfigRow>
        </div>
        {config.missing.length > 0 ? (
          <Notice tone="red">
            <p className="font-semibold">Falta configurar:</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {config.missing.map((name) => (
                <li key={name} className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs dark:bg-red-900/40">
                  {name}
                </li>
              ))}
            </ul>
          </Notice>
        ) : (
          <p className="text-sm text-green-700 dark:text-green-400">Toda la configuración necesaria está puesta.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityCard({ last7d }: { last7d: Record<MessageStatus, number> | null }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardTitle className="text-base">Actividad (7 días)</CardTitle>
        <CardDescription>Mensajes de la IA creados en la última semana, por estado.</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {last7d ? (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {ACTIVITY_STATUSES.map((status) => (
              <div key={status} className="rounded-lg border p-2">
                <dt className="text-[11px] text-muted-foreground">{MESSAGE_STATUS_META[status].label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{last7d[status] ?? 0}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos (¿falta aplicar la migración 0045?).</p>
        )}
      </CardContent>
    </Card>
  );
}

type SettingsTabProps = {
  overview: ViewState<SettingsResponse>;
  preview: ViewState<PreviewResponse>;
  busyKey: string | null;
  run: RunAction;
};

export function SettingsTab({ overview, preview, busyKey, run }: SettingsTabProps) {
  if (!overview.data) {
    return overview.error ? <ErrorRow error={overview.error} onRetry={() => void overview.reload()} /> : <LoadingRow />;
  }
  const { settings, templates, config, stats } = overview.data;
  return (
    <div className="space-y-4">
      {overview.error && <ErrorRow error={overview.error} onRetry={() => void overview.reload()} />}
      <ConfigCard config={config} failedClosed={settings.failedClosed} />
      <TemplatesPanel templates={templates} busyKey={busyKey} run={run} />
      <ScheduleEditor
        key={scheduleKey(settings.schedule)}
        schedule={settings.schedule}
        busyKey={busyKey}
        run={run}
        onSaved={preview.reload}
      />
      <SlotPreview preview={preview} />
      <ActivityCard last7d={stats.last7d} />
    </div>
  );
}
