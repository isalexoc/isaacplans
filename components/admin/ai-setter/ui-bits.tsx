"use client";

/** Small presentational pieces shared by the AI Setter panel's tabs. */

import type { ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./labels";

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", TONE_CLASSES[tone], className)}>
      {children}
    </Badge>
  );
}

const NOTICE_CLASSES: Record<"amber" | "red" | "blue", string> = {
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
  red: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300",
  blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200",
};

export function Notice({
  tone,
  children,
  className,
}: {
  tone: keyof typeof NOTICE_CLASSES;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("rounded-lg border p-3 text-sm", NOTICE_CLASSES[tone], className)}>{children}</div>;
}

export function LoadingRow({ text = "Cargando…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

export function ErrorRow({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Notice tone="red" className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {error}
      </span>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw /> Reintentar
      </Button>
    </Notice>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Toggle chip for the inbox / leads / templates filters. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
      className="h-8 rounded-full px-3 text-xs"
    >
      {children}
    </Button>
  );
}

/**
 * For buttons in the two-column mobile action grids: the label may wrap on a narrow phone
 * instead of overflowing its column.
 */
export const ACTION_BUTTON_CLASS = "h-auto min-h-10 whitespace-normal py-2 leading-tight";

/** A spinner while this button's own action is in flight, its icon otherwise. */
export function BusyIcon({ busy, icon }: { busy: boolean; icon: ReactNode }) {
  return busy ? <Loader2 className="animate-spin" /> : <>{icon}</>;
}
