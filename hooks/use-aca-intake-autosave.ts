"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAcaIntakeData } from "@/lib/aca-intake-api";
import type { AcaIntakeData } from "@/lib/aca-intake/schema";

export type AcaAutosaveStatus = "idle" | "pending" | "saved" | "error";

const SAVED_INDICATOR_MS = 2500;
const DEFAULT_DEBOUNCE_MS = 1000;

type Options = {
  token: string;
  data: AcaIntakeData;
  debounceMs?: number;
  /** Called after a successful save (e.g. to know the session became in_progress). */
  onSaved?: () => void;
};

/**
 * Debounced, snapshot-compared autosave for the ACA intake form. Always persists to the
 * server (the session always exists), mirroring use-iul-intake-autosave.ts.
 */
export function useAcaIntakeAutosave({
  token,
  data,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onSaved,
}: Options) {
  const [status, setStatus] = useState<AcaAutosaveStatus>("idle");
  const dataRef = useRef(data);
  const onSavedRef = useRef(onSaved);
  const generationRef = useRef(0);
  const skipFirstRef = useRef(true);
  const lastSnapshotRef = useRef<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;
  onSavedRef.current = onSaved;

  const snapshot = JSON.stringify(data);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const persist = useCallback(async (): Promise<boolean> => {
    const generation = ++generationRef.current;
    setStatus("pending");
    try {
      const payload = dataRef.current;
      await saveAcaIntakeData(token, payload);
      if (generation !== generationRef.current) return false;
      lastSnapshotRef.current = JSON.stringify(payload);
      onSavedRef.current?.();
      setStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setStatus((cur) => (cur === "saved" ? "idle" : cur));
      }, SAVED_INDICATOR_MS);
      return true;
    } catch {
      if (generation !== generationRef.current) return false;
      setStatus("error");
      return false;
    }
  }, [token]);

  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      lastSnapshotRef.current = snapshot;
      return;
    }
    if (snapshot === lastSnapshotRef.current) return;

    setStatus((cur) => (cur === "saved" ? "idle" : cur));
    const timer = setTimeout(() => {
      void persist();
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [snapshot, debounceMs, persist]);

  const saveNow = useCallback(async () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    return persist();
  }, [persist]);

  return { status, saveNow, isSaving: status === "pending" };
}
