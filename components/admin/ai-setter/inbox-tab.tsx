"use client";

/**
 * Bandeja: what waits on Isaac (drafts, shadow-mode replies) and what went wrong, filtered by
 * group. `focusMessageId` (from `?m=`) opens the right group, scrolls to that card and
 * highlights it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MessageStatus } from "@/lib/ai-setter/types";
import { cn } from "@/lib/utils";
import type { InboxItem, InboxResponse } from "./api-types";
import { InboxCard, cardDomId } from "./inbox-card";
import { EmptyRow, ErrorRow, FilterChip, LoadingRow, Notice } from "./ui-bits";
import type { RunAction, ViewState } from "./use-ai-setter-api";

type InboxFilter = "pending" | "problems" | "all";

const FILTERS: Array<{ id: InboxFilter; label: string; empty: string }> = [
  { id: "pending", label: "Pendientes", empty: "Nada esperando tu OK." },
  { id: "problems", label: "Problemas", empty: "Ningún mensaje con problemas." },
  { id: "all", label: "Todo", empty: "La bandeja está vacía." },
];

const PENDING: ReadonlySet<MessageStatus> = new Set(["draft", "shadow"]);

function inFilter(item: InboxItem, filter: InboxFilter): boolean {
  if (filter === "all") return true;
  return filter === "pending" ? PENDING.has(item.status) : !PENDING.has(item.status);
}

/** Drafts first (they expire), then shadow replies, then the rest; newest first inside each. */
function rank(item: InboxItem): number {
  if (item.status === "draft") return 0;
  return item.status === "shadow" ? 1 : 2;
}

type InboxTabProps = {
  inbox: ViewState<InboxResponse>;
  nowMs: number;
  busyKey: string | null;
  run: RunAction;
  focusMessageId: string | null;
  unapprovedTemplates: number;
  onOpenTemplates: () => void;
  onRegenerated: () => void;
};

/** Once the inbox has loaded: pick the focused card's group and scroll to it (or say it is gone). */
function useFocusMessage(items: InboxItem[] | null, focusMessageId: string | null, setFilter: (f: InboxFilter) => void) {
  const handled = useRef(false);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!focusMessageId || !items || handled.current) return;
    handled.current = true;
    const item = items.find((i) => i.messageId === focusMessageId);
    if (!item) {
      setMissing(true);
      return;
    }
    setFilter(PENDING.has(item.status) ? "pending" : "problems");
    window.setTimeout(() => {
      document.getElementById(cardDomId(item.messageId))?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, [items, focusMessageId, setFilter]);
  return missing;
}

export function InboxTab(props: InboxTabProps) {
  const { inbox, nowMs, busyKey, run, focusMessageId, unapprovedTemplates, onOpenTemplates, onRegenerated } = props;
  const [filter, setFilter] = useState<InboxFilter>("pending");
  const items = inbox.data?.items ?? null;
  const focusMissing = useFocusMessage(items, focusMessageId, setFilter);

  // Array#sort is stable: the server's newest-first order holds inside each rank.
  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => rank(a) - rank(b)), [items]);
  const shown = sorted.filter((item) => inFilter(item, filter));
  const pendingCount = sorted.filter((item) => inFilter(item, "pending")).length;
  const counts: Record<InboxFilter, number> = {
    pending: pendingCount,
    problems: sorted.length - pendingCount,
    all: sorted.length,
  };

  if (!items) {
    return inbox.error ? <ErrorRow error={inbox.error} onRetry={() => void inbox.reload()} /> : <LoadingRow />;
  }

  return (
    <div className="space-y-3">
      {unapprovedTemplates > 0 && (
        <Notice tone="blue" className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {unapprovedTemplates === 1
              ? "1 plantilla sin aprobar: las respuestas que la usan esperan tu OK aquí."
              : `${unapprovedTemplates} plantillas sin aprobar: las respuestas que las usan esperan tu OK aquí.`}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onOpenTemplates}>
            Revisar plantillas
          </Button>
        </Notice>
      )}
      {focusMissing && (
        <Notice tone="amber">Ese mensaje ya no está en la bandeja: ya se aprobó, se reemplazó o se rechazó.</Notice>
      )}
      {inbox.error && <ErrorRow error={inbox.error} onRetry={() => void inbox.reload()} />}

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({counts[f.id]})
          </FilterChip>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto h-8"
          onClick={() => void inbox.reload()}
          disabled={inbox.loading}
          aria-label="Actualizar bandeja"
        >
          <RefreshCw className={cn(inbox.loading && "animate-spin")} />
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyRow>{FILTERS.find((f) => f.id === filter)?.empty}</EmptyRow>
      ) : (
        shown.map((item) => (
          <InboxCard
            key={item.messageId}
            item={item}
            nowMs={nowMs}
            busyKey={busyKey}
            run={run}
            highlighted={item.messageId === focusMessageId}
            onRegenerated={onRegenerated}
          />
        ))
      )}
    </div>
  );
}
