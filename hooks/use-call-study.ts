"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingDetail, RecordingSummary } from "@/lib/call-study/store";

/**
 * The recordings list, and a poll that runs only while something is actually being transcribed.
 *
 * Same shape as `hooks/use-iul-secure-capture.ts` and `hooks/use-crankwheel-meeting.ts`: a browser
 * asking our own API a question while a page is open, stopping on a hidden tab, backing off, and
 * shutting down the moment nothing is in flight. CLAUDE.md's rule forbids server-side crons that
 * keep Neon awake around the clock; this is the opposite of one.
 */

const POLL_MS = 5000;
/** A long call takes minutes, so slow down rather than hammering for the whole wait. */
const BACKOFF_AFTER_MS = 120_000;
const SLOW_POLL_MS = 15_000;

export function useCallStudy() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/call-study/recordings", { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "Failed to load");
      setRecordings(json.recordings ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Only two states can change without the agent doing anything.
  const waiting = recordings.some((r) => r.status === "transcribing" || r.status === "analyzing");

  useEffect(() => {
    if (!waiting) return;
    startedAtRef.current = Date.now();

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      await load();
      if (!active) return;
      const elapsed = Date.now() - startedAtRef.current;
      timer = setTimeout(tick, elapsed > BACKOFF_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [waiting, load]);

  return { recordings, loading, error, reload: load };
}

/** One recording's full detail, including the dialogue. Fetched only when it is opened. */
export function useRecordingDetail(id: string | null) {
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setRecording(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/call-study/recordings/${id}`, { credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.success) setRecording(json.recording ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return { recording, loading, setRecording, reload: load };
}
