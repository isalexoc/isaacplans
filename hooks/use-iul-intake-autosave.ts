"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveIntakeData } from "@/lib/iul-intake-api";
import type { IntakeData } from "@/lib/iul-intake/schema";

export type IntakeAutosaveStatus = "idle" | "pending" | "saved" | "error";

const SAVED_INDICATOR_MS = 2500;
const DEFAULT_DEBOUNCE_MS = 1000;

type Options = {
  token: string;
  data: IntakeData;
  debounceMs?: number;
  /** Called after a successful save (e.g. to know the session became in_progress). */
  onSaved?: () => void;
};

/**
 * Debounced, snapshot-compared autosave for the intake form. Always persists to the server
 * (the session always exists), mirroring use-leave-behind-package-autosave.ts.
 */
export function useIulIntakeAutosave({
  token,
  data,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onSaved,
}: Options) {
  const [status, setStatus] = useState<IntakeAutosaveStatus>("idle");
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
      await saveIntakeData(token, payload);
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
