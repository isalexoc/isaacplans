"use client";

/**
 * Which times a lead in each US zone would be offered this week, from Isaac's saved hours and the
 * general calendar's free slots. Makes the cost of late-night-only windows visible (an Eastern
 * lead never sees 10:30 pm).
 */

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PreviewResponse, ZonePreview } from "./api-types";
import { EmptyRow, ErrorRow, LoadingRow } from "./ui-bits";
import type { ViewState } from "./use-ai-setter-api";

function ZoneCard({ zone }: { zone: ZonePreview }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-sm font-semibold">Hora {zone.labelEs}</p>
      {zone.slots.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Ninguna hora disponible esta semana.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {zone.slots.map((slot, index) => (
            <li key={`${index}-${slot}`} className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {slot}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewBody({ preview }: { preview: ViewState<PreviewResponse> }) {
  if (!preview.data) {
    return preview.error ? (
      <ErrorRow error={preview.error} onRetry={() => void preview.reload()} />
    ) : (
      <LoadingRow text="Consultando el calendario…" />
    );
  }
  if (preview.data.zones.length === 0) {
    return <EmptyRow>No se pudo calcular: falta configuración o el CRM no respondió.</EmptyRow>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {preview.data.zones.map((zone) => (
        <ZoneCard key={zone.zone} zone={zone} />
      ))}
    </div>
  );
}

export function SlotPreview({ preview }: { preview: ViewState<PreviewResponse> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 p-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-base">Horas que vería un lead</CardTitle>
          <CardDescription>Próximos 7 días, por zona, con tu horario guardado y el calendario general.</CardDescription>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void preview.reload()} disabled={preview.loading}>
          <RefreshCw className={cn(preview.loading && "animate-spin")} /> Actualizar
        </Button>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <PreviewBody preview={preview} />
      </CardContent>
    </Card>
  );
}
