"use client";

/** Leads: every conversation the AI has touched, filterable by status and searchable by name. */

import { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LeadStatus } from "@/lib/ai-setter/types";
import { cn } from "@/lib/utils";
import type { LeadsResponse } from "./api-types";
import { LEAD_STATUS_META, LEAD_STATUS_ORDER } from "./labels";
import { LeadCard } from "./lead-card";
import { EmptyRow, ErrorRow, FilterChip, LoadingRow } from "./ui-bits";
import type { RunAction, ViewState } from "./use-ai-setter-api";

type LeadFilter = LeadStatus | "all";

type LeadsTabProps = {
  leads: ViewState<LeadsResponse>;
  nowMs: number;
  busyKey: string | null;
  run: RunAction;
};

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function LeadsTab({ leads, nowMs, busyKey, run }: LeadsTabProps) {
  const [filter, setFilter] = useState<LeadFilter>("all");
  const [query, setQuery] = useState("");
  const all = useMemo(() => leads.data?.leads ?? [], [leads.data]);

  const counts = useMemo(() => {
    const byStatus = new Map<LeadStatus, number>();
    for (const lead of all) byStatus.set(lead.status, (byStatus.get(lead.status) ?? 0) + 1);
    return byStatus;
  }, [all]);

  const needle = normalized(query);
  const shown = all.filter(
    (lead) =>
      (filter === "all" || lead.status === filter) &&
      (needle === "" || normalized(lead.firstName ?? "").includes(needle))
  );

  if (!leads.data) {
    return leads.error ? <ErrorRow error={leads.error} onRetry={() => void leads.reload()} /> : <LoadingRow />;
  }

  return (
    <div className="space-y-3">
      {leads.error && <ErrorRow error={leads.error} onRetry={() => void leads.reload()} />}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre"
            aria-label="Buscar lead por nombre"
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => void leads.reload()}
          disabled={leads.loading}
          aria-label="Actualizar leads"
        >
          <RefreshCw className={cn(leads.loading && "animate-spin")} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          Todos ({all.length})
        </FilterChip>
        {LEAD_STATUS_ORDER.map((status) => (
          <FilterChip key={status} active={filter === status} onClick={() => setFilter(status)}>
            {LEAD_STATUS_META[status].label} ({counts.get(status) ?? 0})
          </FilterChip>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyRow>{all.length === 0 ? "La IA todavía no ha hablado con ningún lead." : "Ningún lead coincide."}</EmptyRow>
      ) : (
        shown.map((lead) => <LeadCard key={lead.contactId} lead={lead} nowMs={nowMs} busyKey={busyKey} run={run} />)
      )}
    </div>
  );
}
