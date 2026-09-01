"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renderDialogue, speakerLabel } from "@/lib/call-study/dialogue";
import { LINES_OF_BUSINESS, type CallOutcome, type SpeakerMap } from "@/lib/call-study/types";
import type { RecordingDetail } from "@/lib/call-study/store";
import AnalysisPanel from "./analysis-panel";

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  sold: "Sold",
  not_sold: "Did not sell",
  follow_up: "Follow-up",
  unknown: "Not tagged",
};

const LOB_LABELS: Record<string, string> = {
  iul: "IUL",
  final_expense: "Final Expense",
  term_life: "Term Life",
  whole_life: "Whole Life",
  aca: "ACA",
  annuity: "Annuity",
  other: "Other",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * The dialogue, and everything that acts on it.
 *
 * The transcript is rendered from `turns` plus the speaker map on every keystroke of a rename, so
 * correcting a name updates all four hundred lines instantly and without touching the stored
 * transcript — which is the entire reason the map is a separate column.
 */
export default function TranscriptView({
  recording,
  onChanged,
  onDeleted,
}: {
  recording: RecordingDetail;
  onChanged: (next: RecordingDetail) => void;
  onDeleted: () => void;
}) {
  const [speakerMap, setSpeakerMap] = useState<SpeakerMap>(recording.speakerMap ?? {});
  const [savingNames, setSavingNames] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogue = useMemo(
    () => renderDialogue(recording.turns, speakerMap, { align: true }),
    [recording.turns, speakerMap]
  );

  const speakerIds = useMemo(
    () => [...new Set(recording.turns.map((t) => t.speaker))],
    [recording.turns]
  );

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/call-study/recordings/${recording.id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.success && json.recording) onChanged(json.recording);
    return Boolean(json?.success);
  }

  async function saveNames() {
    setSavingNames(true);
    try {
      await patch({ speakerMap });
    } finally {
      setSavingNames(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(dialogue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is selectable on screen */
    }
  }

  function download() {
    const safeTitle = recording.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([dialogue], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle || "call"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/call-study/recordings/${recording.id}/analyze`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Analysis failed.");
      if (json.recording) onChanged(json.recording);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this call, its transcript and its snippets?")) return;
    await fetch(`/api/admin/call-study/recordings/${recording.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    onDeleted();
  }

  const metrics = recording.metrics;

  return (
    <div className="space-y-4">
      {/* Header: what this call was and how it went */}
      <div className="rounded-lg border bg-white p-4 dark:bg-gray-950">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label htmlFor="cs-t">Title</Label>
            <Input
              id="cs-t"
              defaultValue={recording.title}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== recording.title) {
                  void patch({ title: e.target.value });
                }
              }}
            />
          </div>
          <div>
            <Label htmlFor="cs-out">Outcome</Label>
            <select
              id="cs-out"
              value={recording.outcome}
              onChange={(e) => void patch({ outcome: e.target.value })}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {(Object.keys(OUTCOME_LABELS) as CallOutcome[]).map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABELS[o]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cs-lob">Product</Label>
            <select
              id="cs-lob"
              value={recording.lineOfBusiness ?? ""}
              onChange={(e) => void patch({ lineOfBusiness: e.target.value })}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {LINES_OF_BUSINESS.map((l) => (
                <option key={l} value={l}>
                  {LOB_LABELS[l] ?? l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {metrics && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>Length: {formatDuration(recording.durationSeconds)}</span>
            <span>
              Talk time:{" "}
              {speakerIds
                .map((id) => `${speakerLabel(id, speakerMap)} ${Math.round((metrics.talkRatio[id] ?? 0) * 100)}%`)
                .join(" · ")}
            </span>
            <span>
              Longest monologue: {formatDuration(Math.round(metrics.longestMonologueSeconds))}
              {metrics.longestMonologueSpeaker
                ? ` (${speakerLabel(metrics.longestMonologueSpeaker, speakerMap)})`
                : ""}
            </span>
          </div>
        )}
      </div>

      {/* Speaker names — the difference between a log and a conversation */}
      <div className="rounded-lg border bg-white p-4 dark:bg-gray-950">
        <p className="mb-2 text-sm font-semibold">Who is who</p>
        <div className="flex flex-wrap items-end gap-3">
          {speakerIds.map((id) => (
            <div key={id}>
              <Label htmlFor={`spk-${id}`} className="text-xs text-muted-foreground">
                {id}
              </Label>
              <Input
                id={`spk-${id}`}
                className="w-40"
                value={speakerMap[id]?.name ?? ""}
                placeholder={speakerLabel(id, null)}
                onChange={(e) =>
                  setSpeakerMap((m) => ({
                    ...m,
                    [id]: { name: e.target.value, role: m[id]?.role ?? "other" },
                  }))
                }
              />
            </div>
          ))}
          <Button size="sm" variant="secondary" disabled={savingNames} onClick={saveNames}>
            {savingNames ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save names
          </Button>
        </div>
      </div>

      {/* The dialogue */}
      <div className="rounded-lg border bg-white dark:bg-gray-950">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <p className="text-sm font-semibold">Transcript</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="mr-1 h-4 w-4 text-green-600" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="mr-1 h-4 w-4" /> .txt
            </Button>
            <Button size="sm" disabled={analyzing} onClick={analyze}>
              {analyzing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              {recording.analysis ? "Re-analyse" : "Analyse"}
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={remove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap p-4 font-mono text-sm leading-relaxed">
          {dialogue}
        </pre>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {recording.analysis && <AnalysisPanel analysis={recording.analysis} />}
    </div>
  );
}
