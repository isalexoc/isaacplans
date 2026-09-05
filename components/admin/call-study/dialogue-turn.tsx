"use client";

import { AlertTriangle, BookOpen, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitByHighlights, type CharRange, type Highlight } from "@/lib/call-study/reading";
import { OBJECTION_STYLE, SEARCH_MARK, SPEAKER_STYLE } from "@/lib/call-study/reading-theme";
import type { CallObjection, SpeakerRole, Turn } from "@/lib/call-study/types";
import {
  OBJECTION_TYPE_LABELS,
  isObjectionType,
  type ObjectionType,
} from "@/lib/objections/types";

export type TurnObjection = CallObjection & { range: CharRange | null };

type MarkKind = "hard" | "soft" | "search";

function objectionLabel(objection: CallObjection): string {
  const type = objection.objectionType;
  if (isObjectionType(type)) return OBJECTION_TYPE_LABELS[type as ObjectionType].en;
  return objection.objection || "Objection";
}

/**
 * One turn of the conversation.
 *
 * **Every highlight is a wrapper, never a rewrite.** The text rendered here is `turn.text`, cut into
 * runs by `splitByHighlights` and reassembled — a function whose test asserts the runs rejoin into
 * the original string character for character, on every turn of a real transcript. Nothing is
 * re-cased, re-spaced, trimmed or cleaned up on the way to the screen.
 */
export default function DialogueTurn({
  turn,
  index,
  role,
  name,
  objections,
  searchRanges,
  isActive,
  muted,
  compact,
  onSeek,
  onOpenObjection,
}: {
  turn: Turn;
  index: number;
  role: SpeakerRole;
  name: string;
  objections: TurnObjection[];
  searchRanges: CharRange[];
  isActive: boolean;
  muted: boolean;
  compact: boolean;
  onSeek: (seconds: number) => void;
  onOpenObjection: (libraryObjectionId: string) => void;
}) {
  const speaker = SPEAKER_STYLE[role] ?? SPEAKER_STYLE.other;
  const strongest = objections.some((o) => o.strength !== "soft") ? "hard" : "soft";
  const objectionStyle = OBJECTION_STYLE[strongest];

  // Objections first, so they win any overlap with a search hit — the caller's order IS the
  // priority, which is why splitByHighlights takes them in one list rather than ranking them.
  const highlights: Highlight<MarkKind>[] = [
    ...objections.flatMap((objection) =>
      objection.range
        ? [{ ...objection.range, kind: (objection.strength === "soft" ? "soft" : "hard") as MarkKind }]
        : []
    ),
    ...searchRanges.map((range) => ({ ...range, kind: "search" as MarkKind })),
  ];
  const segments = splitByHighlights(turn.text, highlights);

  return (
    <div
      id={`cs-turn-${index}`}
      className={cn(
        "scroll-mt-24 rounded-md px-3 transition-colors",
        compact ? "py-1" : "py-2",
        speaker.body,
        objections.length > 0 && objectionStyle.ring,
        isActive && "bg-[#0077B6]/[0.07] dark:bg-[#4FC3E8]/10"
      )}
    >
      <div className="flex gap-3">
        <span className={cn("mt-1 w-0.5 shrink-0 rounded-full", speaker.rail)} aria-hidden />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSeek(turn.start)}
              title="Play from here"
              className={cn(
                "group inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                speaker.chip
              )}
            >
              <Play className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover:opacity-100" />
              {name}
            </button>

            {objections.map((objection, i) => {
              const label = objectionLabel(objection);
              const linked = objection.libraryObjectionId;
              const badge = (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  {label}
                  {objection.strength === "soft" && <span className="opacity-70">· possible</span>}
                  {linked && <BookOpen className="h-3 w-3" />}
                </>
              );
              const className = cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                OBJECTION_STYLE[objection.strength === "soft" ? "soft" : "hard"].badge
              );

              return linked ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => onOpenObjection(linked)}
                  title={`${objection.objection} — open the saved rebuttal`}
                  className={cn(className, "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                >
                  {badge}
                </button>
              ) : (
                <span key={i} className={className} title={objection.objection}>
                  {badge}
                </span>
              );
            })}
          </div>

          <p
            className={cn(
              // `text-foreground` explicitly, never inherited. Everything else in this component
              // sets its own colour, and a line of transcript that quietly takes whatever colour an
              // ancestor happens to have is the one element that must not go invisible in a theme.
              "mt-0.5 whitespace-pre-wrap break-words leading-relaxed text-foreground",
              compact ? "text-[13px]" : "text-[15px]",
              // A backchannel keeps every word but stops shredding a five-minute pitch visually.
              muted && "text-[13px] italic text-muted-foreground"
            )}
          >
            {segments.map((segment, i) =>
              segment.kind === null ? (
                <span key={i}>{segment.text}</span>
              ) : (
                <mark
                  key={i}
                  className={cn(
                    "rounded px-0.5",
                    segment.kind === "search" ? SEARCH_MARK : OBJECTION_STYLE[segment.kind].mark
                  )}
                >
                  {segment.text}
                </mark>
              )
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
