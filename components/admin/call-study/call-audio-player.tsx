"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/call-study/reading";

const SPEEDS = [1, 1.25, 1.5, 1.75, 2] as const;
const SKIP_SECONDS = 10;

/**
 * Playback for the recording, wired to the transcript above it.
 *
 * The `<audio>` element is owned here but its ref belongs to the parent, which is what lets a click
 * on any line, stage or time marker seek — one element, one source of truth, no message passing.
 *
 * `onTime` fires on every `timeupdate` (roughly four times a second). The parent must not turn that
 * straight into state: on a two-hour call the reader is a thousand nodes, and re-rendering all of
 * them four times a second to move one highlight is the difference between smooth and unusable.
 * `dialogue-reader.tsx` only sets state when the ACTIVE TURN changes. The running clock below is
 * local to this component for the same reason.
 */
export default function CallAudioPlayer({
  src,
  audioRef,
  onTime,
}: {
  src: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onTime: (seconds: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [failed, setFailed] = useState(false);

  // Kept in a ref so the effect below does not need to re-subscribe every time the parent
  // re-renders with a new closure.
  const onTimeRef = useRef(onTime);
  onTimeRef.current = onTime;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = () => {
      setSeconds(audio.currentTime);
      onTimeRef.current(audio.currentTime);
    };
    const meta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const error = () => setFailed(true);

    audio.addEventListener("timeupdate", time);
    audio.addEventListener("loadedmetadata", meta);
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);
    audio.addEventListener("error", error);
    return () => {
      audio.removeEventListener("timeupdate", time);
      audio.removeEventListener("loadedmetadata", meta);
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("error", error);
    };
  }, [audioRef]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setFailed(true));
    else audio.pause();
  }

  function nudge(by: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + by, audio.duration || Infinity));
  }

  function changeSpeed() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
    audio.playbackRate = next;
    setSpeed(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 dark:bg-gray-950">
      {/* preload="none" — a two-hour recording should not download because a page was opened. */}
      <audio ref={audioRef} src={src} preload="none" className="hidden" />

      <Button size="sm" variant="secondary" onClick={toggle} disabled={failed} className="w-20">
        {playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}
        {playing ? "Pause" : "Play"}
      </Button>

      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(-SKIP_SECONDS)} title={`Back ${SKIP_SECONDS}s`}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => nudge(SKIP_SECONDS)} title={`Forward ${SKIP_SECONDS}s`}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={1}
        value={Math.min(seconds, duration || 0)}
        onChange={(e) => {
          const audio = audioRef.current;
          if (audio) audio.currentTime = Number(e.target.value);
        }}
        className="h-1.5 min-w-[8rem] flex-1 cursor-pointer accent-[#0077B6]"
        aria-label="Seek"
      />

      <span className="whitespace-nowrap font-mono text-xs tabular-nums text-muted-foreground">
        {formatClock(seconds)} / {formatClock(duration)}
      </span>

      <Button size="sm" variant="ghost" className="h-8 px-2 font-mono text-xs" onClick={changeSpeed}>
        {speed}&times;
      </Button>

      {failed && (
        <span className="text-xs text-red-600">
          The recording could not be played. The transcript is unaffected.
        </span>
      )}
    </div>
  );
}
