"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Flag, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import ObjectionAnswerDialog from "@/components/objections/objection-answer-dialog";
import type { Objection } from "@/lib/objections/types";
import {
  buildStageTimeline,
  buildTimeMarkers,
  findAllOccurrences,
  findQuoteRange,
  formatClock,
  isBackchannel,
  type CharRange,
} from "@/lib/call-study/reading";
import { stageStyle } from "@/lib/call-study/reading-theme";
import { speakerLabel } from "@/lib/call-study/dialogue";
import type { CallAnalysis, SpeakerMap, SpeakerRole, Turn } from "@/lib/call-study/types";
import CallAudioPlayer from "./call-audio-player";
import DialogueTurn, { type TurnObjection } from "./dialogue-turn";
import StageRail, { type RailObjection } from "./stage-rail";

type Filter = "all" | "agent" | "client" | "objections";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "agent", label: "Agent only" },
  { value: "client", label: "Client only" },
  { value: "objections", label: "Objections" },
];

const INTERVALS: { value: number | null; label: string }[] = [
  { value: null, label: "Auto" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 900, label: "15 min" },
  { value: 0, label: "Off" },
];

/** Searching on one character matches most of the call and helps nobody. */
const MIN_QUERY = 2;

export default function DialogueReader({
  turns,
  speakerMap,
  analysis,
  audioUrl,
  languageCode,
  libraryObjections,
}: {
  turns: Turn[];
  speakerMap: SpeakerMap;
  analysis: CallAnalysis | null;
  audioUrl: string | null;
  languageCode: string | null;
  libraryObjections: Objection[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [compact, setCompact] = useState(false);
  const [markerInterval, setMarkerInterval] = useState<number | null>(null);
  const [follow, setFollow] = useState(true);
  const [activeTurn, setActiveTurn] = useState(-1);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [openObjectionId, setOpenObjectionId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const language = languageCode?.toLowerCase().startsWith("es") ? "es" : "en";

  const roleOf = useCallback(
    (speaker: string): SpeakerRole => speakerMap[speaker]?.role ?? "other",
    [speakerMap]
  );

  const stages = useMemo(() => buildStageTimeline(analysis?.phases, turns), [analysis, turns]);
  const markers = useMemo(
    () => buildTimeMarkers(turns, { intervalSeconds: markerInterval }),
    [turns, markerInterval]
  );
  const markerByTurn = useMemo(() => new Map(markers.map((m) => [m.atTurn, m])), [markers]);
  const totalSeconds = turns.length > 0 ? turns[turns.length - 1].end : 0;

  /**
   * Anchor each objection to the line that carries it.
   *
   * The model's own `turnIndex` is a starting point, but the QUOTE is the more reliable signal: if
   * the words are not in the turn the model named, believing the index would ring the wrong line.
   * So a quote found elsewhere wins, and an objection whose words are nowhere in the transcript
   * stays out of the dialogue entirely rather than being pinned somewhere arbitrary — it is still
   * listed in the analysis panel below.
   */
  const objectionsByTurn = useMemo(() => {
    const map = new Map<number, TurnObjection[]>();
    for (const objection of analysis?.objections ?? []) {
      const named =
        typeof objection.turnIndex === "number" &&
        objection.turnIndex >= 0 &&
        objection.turnIndex < turns.length
          ? objection.turnIndex
          : -1;

      let index = named;
      let range: CharRange | null =
        named >= 0 && objection.clientQuote
          ? findQuoteRange(turns[named].text, objection.clientQuote)
          : null;

      if (!range && objection.clientQuote) {
        const found = turns.findIndex(
          (turn) => findQuoteRange(turn.text, objection.clientQuote) !== null
        );
        if (found >= 0) {
          index = found;
          range = findQuoteRange(turns[found].text, objection.clientQuote);
        }
      }
      if (index < 0) continue;

      const list = map.get(index) ?? [];
      list.push({ ...objection, range: range ?? objection.quoteRange ?? null });
      map.set(index, list);
    }
    return map;
  }, [analysis, turns]);

  const railObjections = useMemo<RailObjection[]>(
    () =>
      [...objectionsByTurn.entries()]
        .flatMap(([turnIndex, list]) =>
          list.map((objection) => ({
            turnIndex,
            seconds: turns[turnIndex]?.start ?? 0,
            label: objection.objection,
            strength: (objection.strength === "soft" ? "soft" : "hard") as "hard" | "soft",
          }))
        )
        .sort((a, b) => a.seconds - b.seconds),
    [objectionsByTurn, turns]
  );

  const searchByTurn = useMemo(() => {
    const map = new Map<number, CharRange[]>();
    const needle = query.trim();
    if (needle.length < MIN_QUERY) return map;
    turns.forEach((turn, i) => {
      const hits = findAllOccurrences(turn.text, needle);
      if (hits.length > 0) map.set(i, hits);
    });
    return map;
  }, [turns, query]);

  const visible = useMemo(() => {
    const searching = query.trim().length >= MIN_QUERY;
    const set = new Set<number>();
    turns.forEach((turn, i) => {
      if (searching && !searchByTurn.has(i)) return;
      const role = roleOf(turn.speaker);
      if (filter === "agent" && role !== "agent") return;
      if (filter === "client" && role === "agent") return;
      if (filter === "objections" && !objectionsByTurn.has(i)) return;
      set.add(i);
    });
    return set;
  }, [turns, query, searchByTurn, filter, roleOf, objectionsByTurn]);

  /** Which turn is playing. Only ever set when it CHANGES — see the note in the audio player. */
  const handleTime = useCallback(
    (seconds: number) => {
      let lo = 0;
      let hi = turns.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (turns[mid].start <= seconds) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      setActiveTurn((current) => (current === found ? current : found));
    },
    [turns]
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, seconds);
    void audio.play().catch(() => undefined);
  }, []);

  const jumpToTurn = useCallback(
    (index: number) => {
      document.getElementById(`cs-turn-${index}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (turns[index]) seek(turns[index].start);
    },
    [turns, seek]
  );

  // Follow along with the audio. Guarded on `follow` so reading ahead while it plays is possible.
  useEffect(() => {
    if (!follow || activeTurn < 0) return;
    document
      .getElementById(`cs-turn-${activeTurn}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTurn, follow]);

  // n / p step through objections. Ignored while typing, or the search box eats them.
  useEffect(() => {
    if (railObjections.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.key !== "n" && event.key !== "p") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      event.preventDefault();
      const positions = railObjections.map((o) => o.turnIndex);
      const next =
        event.key === "n"
          ? positions.find((p) => p > activeTurn) ?? positions[0]
          : [...positions].reverse().find((p) => p < activeTurn) ?? positions[positions.length - 1];
      jumpToTurn(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [railObjections, activeTurn, jumpToTurn]);

  const openObjection = useMemo(
    () => libraryObjections.find((o) => o._id === openObjectionId) ?? null,
    [libraryObjections, openObjectionId]
  );

  // Stages, each with the turns that survive the current filter. A stage with nothing left to show
  // is dropped entirely rather than left as a header over empty space.
  const groups = useMemo(() => {
    if (stages.length === 0) {
      const indices = turns.map((_, i) => i).filter((i) => visible.has(i));
      return indices.length > 0 ? [{ stage: null, indices }] : [];
    }
    return stages
      .map((stage) => ({
        stage,
        indices: Array.from(
          { length: stage.endTurn - stage.startTurn + 1 },
          (_, k) => stage.startTurn + k
        ).filter((i) => visible.has(i)),
      }))
      .filter((group) => group.indices.length > 0);
  }, [stages, turns, visible]);

  const activeStage = stages.findIndex((s) => activeTurn >= s.startTurn && activeTurn <= s.endTurn);
  const hiddenCount = turns.length - visible.size;

  return (
    <div className="space-y-3">
      {audioUrl && <CallAudioPlayer src={audioUrl} audioRef={audioRef} onTime={handleTime} />}

      <StageRail
        stages={stages}
        markers={markers}
        objections={railObjections}
        totalSeconds={totalSeconds}
        activeStage={activeStage}
        onJumpToTurn={jumpToTurn}
      />

      <div className="rounded-lg border bg-white dark:bg-gray-950">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this call"
              className="h-9 pl-8 pr-8 text-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex rounded-md border p-0.5">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  filter === option.value
                    ? "bg-brand text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
                {option.value === "objections" && railObjections.length > 0 && (
                  <span className="ml-1 opacity-80">{railObjections.length}</span>
                )}
              </button>
            ))}
          </div>

          <select
            value={markerInterval === null ? "auto" : String(markerInterval)}
            onChange={(e) => setMarkerInterval(e.target.value === "auto" ? null : Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
            title="How often to mark the time"
          >
            {INTERVALS.map((option) => (
              <option key={option.label} value={option.value === null ? "auto" : String(option.value)}>
                Time marks: {option.label}
              </option>
            ))}
          </select>

          <Button size="sm" variant={compact ? "secondary" : "ghost"} onClick={() => setCompact((v) => !v)}>
            {compact ? "Comfortable" : "Compact"}
          </Button>

          {audioUrl && (
            <Button size="sm" variant={follow ? "secondary" : "ghost"} onClick={() => setFollow((v) => !v)}>
              {follow ? "Following" : "Follow"}
            </Button>
          )}
        </div>

        {hiddenCount > 0 && (
          <p className="border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            Showing {visible.size} of {turns.length} lines.{" "}
            <button type="button" className="underline" onClick={() => { setFilter("all"); setQuery(""); }}>
              Show everything
            </button>
          </p>
        )}

        {/* The dialogue scrolls in its own pane rather than with the page, which is what makes the
            stage headers stick to the top of the READING area instead of behind the site header.
            Sized to the viewport so a tall screen shows more of the call, not more empty page. */}
        <div className="max-h-[calc(100vh-11rem)] min-h-[28rem] overflow-y-auto p-2">
          {groups.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing matches that.
            </p>
          )}

          {groups.map((group) => {
            const stage = group.stage;
            const style = stage ? stageStyle(stage.phase) : null;
            // Keyed by the stage itself, not its position: filtering drops empty groups, so a
            // positional key would collapse a different stage the moment a filter changed.
            const key = stage ? `${stage.phase}-${stage.startTurn}` : "all";
            const isCollapsed = collapsed.has(key);

            return (
              <section key={key}>
                {stage && style && (
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsed((current) => {
                        const next = new Set(current);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    className={cn(
                      // Sticky, so the answer to "what part of the script is this" is on screen at
                      // every scroll position rather than somewhere above it.
                      "sticky top-0 z-10 mb-1 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left backdrop-blur-sm",
                      style.header
                    )}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                    <span className={cn("text-sm font-semibold", style.text)}>{style.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatClock(stage.startSec)}–{formatClock(stage.endSec)} · {group.indices.length} line
                      {group.indices.length === 1 ? "" : "s"}
                    </span>
                    {stage.note && (
                      <span className="ml-auto hidden truncate text-xs italic text-muted-foreground sm:block">
                        {stage.note}
                      </span>
                    )}
                  </button>
                )}

                {!isCollapsed &&
                  group.indices.map((index) => {
                    const turn = turns[index];
                    const marker = markerByTurn.get(index);
                    return (
                      <div key={index}>
                        {marker && (
                          <button
                            type="button"
                            onClick={() => seek(marker.seconds)}
                            className="my-1 flex w-full items-center gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                          >
                            <Flag className="h-3 w-3 shrink-0" />
                            {marker.label}
                            <span className="h-px flex-1 bg-border" />
                          </button>
                        )}
                        <DialogueTurn
                          turn={turn}
                          index={index}
                          role={roleOf(turn.speaker)}
                          name={speakerLabel(turn.speaker, speakerMap)}
                          objections={objectionsByTurn.get(index) ?? []}
                          searchRanges={searchByTurn.get(index) ?? []}
                          isActive={index === activeTurn}
                          muted={isBackchannel(turn.text) && !objectionsByTurn.has(index)}
                          compact={compact}
                          onSeek={seek}
                          onOpenObjection={setOpenObjectionId}
                        />
                      </div>
                    );
                  })}
              </section>
            );
          })}
        </div>
      </div>

      <ObjectionAnswerDialog
        objection={openObjection}
        language={language}
        onClose={() => setOpenObjectionId(null)}
      />
    </div>
  );
}
