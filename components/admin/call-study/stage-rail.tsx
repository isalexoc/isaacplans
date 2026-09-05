"use client";

import { cn } from "@/lib/utils";
import { formatClock, type Stage, type TimeMarker } from "@/lib/call-study/reading";
import { OBJECTION_STYLE, stageStyle } from "@/lib/call-study/reading-theme";

/** One objection, reduced to what the rail needs to draw a tick. */
export type RailObjection = {
  turnIndex: number;
  seconds: number;
  label: string;
  strength: "hard" | "soft";
};

/**
 * The whole call as one bar: what happened, in what order, for how long.
 *
 * This is the single most useful thing on the page for a two-hour recording. Stage widths are
 * proportional to TIME rather than to turn count, because five minutes of uninterrupted pitch and
 * five minutes of rapid back-and-forth are the same amount of call but wildly different numbers of
 * turns — and it is the minutes Isaac is trying to account for.
 *
 * Objections are drawn as ticks ABOVE the bar rather than as segments in it, so a two-line
 * objection inside a twenty-minute presentation stays visible instead of collapsing to a hairline.
 */
export default function StageRail({
  stages,
  markers,
  objections,
  totalSeconds,
  activeStage,
  onJumpToTurn,
}: {
  stages: Stage[];
  markers: TimeMarker[];
  objections: RailObjection[];
  totalSeconds: number;
  activeStage: number;
  onJumpToTurn: (turnIndex: number) => void;
}) {
  if (stages.length === 0 || totalSeconds <= 0) return null;

  const pct = (seconds: number) => `${Math.max(0, Math.min(100, (seconds / totalSeconds) * 100))}%`;

  return (
    <div className="rounded-lg border bg-white p-3 dark:bg-gray-950">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Shape of the call</p>
        <p className="text-xs text-muted-foreground">Click anywhere to jump</p>
      </div>

      {/* Objection ticks, in their own lane above the bar. */}
      <div className="relative h-4">
        {objections.map((objection, i) => (
          <button
            key={`${objection.turnIndex}-${i}`}
            type="button"
            onClick={() => onJumpToTurn(objection.turnIndex)}
            title={`${objection.label} — ${formatClock(objection.seconds)}`}
            style={{ left: pct(objection.seconds) }}
            className="absolute bottom-0 -ml-[3px] h-3 w-[6px] rounded-sm transition-transform hover:scale-y-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("block h-full w-full rounded-sm", OBJECTION_STYLE[objection.strength].tick)} />
            <span className="sr-only">{objection.label}</span>
          </button>
        ))}
      </div>

      {/* The bar itself. */}
      <div className="flex h-7 w-full overflow-hidden rounded-md">
        {stages.map((stage, i) => {
          const style = stageStyle(stage.phase);
          const width = ((stage.endSec - stage.startSec) / totalSeconds) * 100;
          return (
            <button
              key={`${stage.phase}-${stage.startTurn}`}
              type="button"
              onClick={() => onJumpToTurn(stage.startTurn)}
              title={`${style.label} · ${formatClock(stage.startSec)}–${formatClock(stage.endSec)}`}
              style={{ width: `${Math.max(width, 0.5)}%` }}
              className={cn(
                "group relative h-full min-w-[2px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                style.bar,
                i === activeStage ? "" : "opacity-70"
              )}
            >
              <span className="sr-only">{style.label}</span>
            </button>
          );
        })}
      </div>

      {/* Time marks under the bar, so the bar reads as minutes and not just proportions. */}
      <div className="relative mt-1 h-4">
        {markers.map((marker) => (
          <button
            key={marker.seconds}
            type="button"
            onClick={() => onJumpToTurn(marker.atTurn)}
            style={{ left: pct(marker.seconds) }}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {marker.label}
          </button>
        ))}
      </div>

      {/* Legend. Each stage appears once however many times it occurs in the call. */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {[...new Set(stages.map((s) => s.phase))].map((phase) => {
          const style = stageStyle(phase);
          return (
            <span key={phase} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-sm", style.bar)} />
              {style.label}
            </span>
          );
        })}
        {objections.length > 0 && (
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-2 w-1 rounded-sm", OBJECTION_STYLE.hard.tick)} />
            {objections.length} objection{objections.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
