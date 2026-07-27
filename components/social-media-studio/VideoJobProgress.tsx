"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, Circle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { SocialVideoJobView } from "@/lib/social-media-studio/video-job-types";

interface Props {
  /** Live job view (null briefly before the first poll returns). */
  view: SocialVideoJobView | null;
  /** Header label, e.g. "Generating video". */
  title: string;
  /** Shows a Cancel button when provided. */
  onCancel?: () => void;
  /** Epoch ms the operation started — drives the elapsed timer. */
  startedAt?: number;
}

function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

/**
 * Staged progress UI for a durable video job. Reads DB-persisted `jobState`
 * (progress %, ordered stage list, current stage) so it renders identically whether the
 * job was just started or reattached after a page refresh.
 */
export function VideoJobProgress({ view, title, onCancel, startedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const js = view?.jobState ?? null;
  const progress = Math.max(0, Math.min(100, js?.progress ?? 0));
  const stages = js?.stages ?? (js?.stageLabel ? [js.stageLabel] : []);
  const activeIndex = js?.stepIndex ?? 0;
  const items = js?.itemsTotal ? `${js.itemsDone ?? 0}/${js.itemsTotal}` : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        <span className="text-sm font-medium">{title}</span>
        {items && <span className="text-xs text-muted-foreground">· {items} images</span>}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {startedAt ? formatElapsed(now - startedAt) : null}
        </span>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
            disabled={cancelling}
            onClick={() => { setCancelling(true); onCancel(); }}
          >
            <X className="h-3 w-3 mr-1" /> {cancelling ? "Cancelling…" : "Cancel"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-xs font-medium tabular-nums text-muted-foreground w-9 text-right">{Math.round(progress)}%</span>
      </div>

      {js?.stageLabel && (
        <p className="text-xs text-muted-foreground">
          {stages.length > 1 ? `Stage ${activeIndex + 1} of ${stages.length}: ` : ""}
          <span className="text-foreground font-medium">{js.stageLabel}</span>
        </p>
      )}

      {stages.length > 1 && (
        <ul className="flex flex-col gap-1">
          {stages.map((label, i) => {
            const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
            return (
              <li key={`${label}-${i}`} className="flex items-center gap-2 text-xs">
                {state === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : state === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={cn(
                  state === "pending" ? "text-muted-foreground/60"
                    : state === "active" ? "text-foreground font-medium" : "text-muted-foreground",
                )}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
