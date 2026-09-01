"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft, FileAudio, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallStudy, useRecordingDetail } from "@/hooks/use-call-study";
import type { CallStudyStatus } from "@/lib/call-study/types";
import CallUploader from "./call-uploader";
import SnippetLibrary from "./snippet-library";
import TranscriptView from "./transcript-view";

const STATUS_LABEL: Record<CallStudyStatus, string> = {
  uploaded: "Uploaded",
  transcribing: "Transcribing…",
  transcribed: "Ready to read",
  analyzing: "Analysing…",
  ready: "Analysed",
  failed: "Failed",
};

const STATUS_CLASS: Record<CallStudyStatus, string> = {
  uploaded: "bg-muted text-muted-foreground",
  transcribing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  transcribed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  analyzing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  ready: "bg-brand/10 text-brand",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function CallStudyClient() {
  const { recordings, loading, error, reload } = useCallStudy();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"calls" | "library">("calls");
  const { recording, loading: loadingDetail, setRecording } = useRecordingDetail(selectedId);

  // Reading one call is a different job from browsing the list, so it takes over the view.
  if (selectedId) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> All calls
        </Button>

        {loadingDetail && !recording ? (
          <div className="flex items-center justify-center p-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : recording ? (
          <TranscriptView
            recording={recording}
            onChanged={(next) => {
              setRecording(next);
              void reload();
            }}
            onDeleted={() => {
              setSelectedId(null);
              void reload();
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">That call could not be loaded.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        {(["calls", "library"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? "border-brand text-brand"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "calls" ? "Calls" : "Script library"}
          </button>
        ))}
      </div>

      {tab === "library" ? (
        <SnippetLibrary />
      ) : (
        <>
          <CallUploader onUploaded={reload} />

          <div className="overflow-hidden rounded-lg border bg-white dark:bg-gray-950">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : recordings.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No calls yet. Upload a recording to get its transcript.
              </div>
            ) : (
              <ul className="divide-y">
                {recordings.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      // A call still transcribing has no dialogue to show yet.
                      disabled={r.status === "transcribing" || r.status === "uploaded"}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="flex items-center gap-2">
                        <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{r.title}</span>
                        <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_CLASS[r.status]}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate pl-6 text-xs text-muted-foreground">
                        {[
                          r.turnCount > 0 ? `${r.turnCount} turns` : null,
                          r.durationSeconds ? `${Math.round(r.durationSeconds / 60)} min` : null,
                          r.outcome !== "unknown" ? r.outcome.replace("_", " ") : null,
                          new Date(r.createdAt).toLocaleDateString(),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {r.errorMessage && (
                        <p className="mt-1 flex items-start gap-1.5 pl-6 text-xs text-amber-700 dark:text-amber-500">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {r.errorMessage}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
