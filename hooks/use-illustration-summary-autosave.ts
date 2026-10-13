"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updatePresentationRequest } from "@/lib/illustration-studio/api";
import type { PresentationData } from "@/lib/illustration-studio/types";

export type SummarySaveStatus = "saved" | "pending" | "saving" | "error";

const DEFAULT_DEBOUNCE_MS = 900;

/**
 * Saves the Illustration Studio editor as the agent types.
 *
 * Saves run one at a time and each sends the newest state, so a slow request can never land after
 * a newer one and roll an edit back. `savedVersion` ticks only when the server has everything on
 * screen — the cue for the preview to re-render, so it never shows a half-saved state.
 */
export function useIllustrationSummaryAutosave(
  id: string,
  presentation: PresentationData,
  debounceMs = DEFAULT_DEBOUNCE_MS
) {
  const [status, setStatus] = useState<SummarySaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedVersion, setSavedVersion] = useState(0);

  const snapshot = JSON.stringify(presentation);
  const latestRef = useRef(presentation);
  const persistedRef = useRef(snapshot);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  latestRef.current = presentation;

  /** Resolves true once everything on screen is saved — what "Present" and "Download" wait for. */
  const save = useCallback((): Promise<boolean> => {
    queueRef.current = queueRef.current.then(async () => {
      const current = latestRef.current;
      const sending = JSON.stringify(current);
      if (sending === persistedRef.current) return true;
      setStatus("saving");
      try {
        await updatePresentationRequest(id, current);
        persistedRef.current = sending;
        setError(null);
        const caughtUp = JSON.stringify(latestRef.current) === sending;
        setStatus(caughtUp ? "saved" : "pending");
        if (caughtUp) setSavedVersion((v) => v + 1);
        return caughtUp;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save your changes.");
        setStatus("error");
        return false;
      }
    });
    return queueRef.current;
  }, [id]);

  useEffect(() => {
    if (snapshot === persistedRef.current) return;
    setStatus((s) => (s === "saving" ? s : "pending"));
    const timer = setTimeout(() => void save(), debounceMs);
    return () => clearTimeout(timer);
  }, [snapshot, save, debounceMs]);

  const unsaved = status !== "saved";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  return { status, error, savedVersion, save };
}
