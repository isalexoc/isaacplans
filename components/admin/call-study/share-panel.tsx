"use client";

import { useState } from "react";
import { AlertTriangle, Download, Loader2, ShieldCheck, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock } from "@/lib/call-study/reading";
import type { RecordingDetail } from "@/lib/call-study/store";

/**
 * Making a copy of the call that can be sent to another agent, and showing exactly what was cut.
 *
 * The verification list is the point of this panel, not decoration. Detection is context-gated —
 * it beeps digits that follow a phrase like "número de cuenta" and deliberately leaves ordinary
 * figures alone — so it can miss a client who starts reciting an account number unprompted. Every
 * dictated number it chose NOT to beep is listed here, because a redaction tool that only shows its
 * successes is claiming a guarantee it does not make.
 */
export default function SharePanel({
  recording,
  onChanged,
}: {
  recording: RecordingDetail;
  onChanged: (next: RecordingDetail) => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const spans = recording.redactionSpans ?? [];
  const unmasked = recording.unmaskedRuns ?? [];
  const building = working || recording.shareableStatus === "building";
  const ready = recording.hasShareableAudio && recording.shareableStatus === "ready";
  const maskedSeconds = spans.reduce((total, s) => total + Math.max(0, s.end - s.start), 0);

  async function build() {
    setWorking(true);
    setError(null);
    setQueued(false);
    try {
      const res = await fetch(`/api/admin/call-study/recordings/${recording.id}/shareable`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Could not build the copy.");
      if (json.recording) onChanged(json.recording);
      if (json.queued) setQueued(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the copy.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-gray-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-brand" />
            Share this call
          </p>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Makes a second copy of the recording with account numbers, Social Security numbers and
            dates of birth replaced by a beep. The original is never changed.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={build} disabled={building || !recording.canBuildShareable}>
            {building ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Volume2 className="mr-1 h-4 w-4" />}
            {ready ? "Rebuild" : "Prepare copy"}
          </Button>
          {ready && (
            <Button size="sm" variant="outline" asChild>
              <a
                href={`/api/admin/call-study/recordings/${recording.id}/shareable-audio`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-1 h-4 w-4" /> Download
              </a>
            </Button>
          )}
        </div>
      </div>

      {!recording.canBuildShareable && (
        <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          This call was transcribed before the word timings needed to place the beeps were stored.
          Upload the recording again to make a shareable copy of it.
        </p>
      )}

      {queued && !ready && (
        <p className="mt-3 text-sm text-muted-foreground">
          Building in the background — a two-hour call takes a few minutes. Reopen this call to check.
        </p>
      )}

      {(error || recording.shareableError) && (
        <p className="mt-3 text-sm text-red-600">{error ?? recording.shareableError}</p>
      )}

      {ready && (
        <div className="mt-4 space-y-4">
          <p className="text-sm">
            <span className="font-semibold">{spans.length}</span> moment
            {spans.length === 1 ? "" : "s"} beeped, {Math.round(maskedSeconds)} seconds in total
            {recording.transcriptScrubbedAt ? " — the transcript above was scrubbed to match." : "."}
          </p>

          {spans.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What was removed
              </p>
              <ul className="divide-y rounded-md border text-sm">
                {spans.map((span, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatClock(span.start)}–{formatClock(span.end)}
                    </span>
                    <span className="font-medium">
                      {span.kind ? span.kind.replace(/_/g, " ") : "dictated number"}
                    </span>
                    {span.cue && (
                      <span className="text-muted-foreground">after &ldquo;{span.cue}&rdquo;</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* The honest part. */}
          <div
            className={cn(
              "rounded-md border p-3",
              unmasked.length > 0
                ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
                : "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
            )}
          >
            {unmasked.length > 0 ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Check these {unmasked.length} before you send it
                </p>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">
                  Numbers read out without anyone naming what they were. Most are prices, ages or
                  dates and are fine to leave. Listen to any you are unsure of.
                </p>
                <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto text-sm">
                  {unmasked.map((run, i) => (
                    <li key={i} className="flex flex-wrap gap-x-3">
                      <span className="font-mono tabular-nums text-amber-900/70 dark:text-amber-200/70">
                        {formatClock(run.start)}
                      </span>
                      <span className="text-amber-950 dark:text-amber-100">{run.text}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-green-900 dark:text-green-200">
                No other dictated numbers were found in this call.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
