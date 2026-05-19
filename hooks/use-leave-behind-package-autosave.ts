"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveLeaveBehindClient } from "@/lib/leave-behind-clients-api";
import type { LeaveBehindClientRecord, PackageQuoteData } from "@/lib/leave-behind-clients";
import { isProspectNameComplete } from "@/lib/leave-behind-package";
import {
  clearLeaveBehindPackageDraft,
  writeLeaveBehindPackageDraft,
} from "@/lib/leave-behind-package-draft";

export type LeaveBehindAutosaveStatus = "idle" | "pending" | "saved" | "error";

const SAVED_INDICATOR_MS = 3000;
const DEFAULT_DEBOUNCE_MS = 1500;

type Options = {
  clientId: string | null;
  quoteData: PackageQuoteData;
  onClientSaved?: (client: LeaveBehindClientRecord) => void;
  debounceMs?: number;
};

export function useLeaveBehindPackageAutosave({
  clientId,
  quoteData,
  onClientSaved,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: Options) {
  const [activeClientId, setActiveClientId] = useState<string | null>(clientId);
  const [status, setStatus] = useState<LeaveBehindAutosaveStatus>("idle");
  const activeClientIdRef = useRef(activeClientId);
  const quoteDataRef = useRef(quoteData);
  const saveGenerationRef = useRef(0);
  const skipAutosaveRef = useRef(true);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  activeClientIdRef.current = activeClientId;
  quoteDataRef.current = quoteData;

  const canAutosave = isProspectNameComplete(quoteData.prospectName);
  const quoteSnapshot = JSON.stringify(quoteData);

  useEffect(() => {
    setActiveClientId(clientId);
    skipAutosaveRef.current = true;
    setStatus("idle");
  }, [clientId]);

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const persist = useCallback(async (): Promise<boolean> => {
    if (!canAutosave) return false;

    const generation = ++saveGenerationRef.current;
    setStatus("pending");

    try {
      const snapshot = quoteDataRef.current;
      const client = await saveLeaveBehindClient({
        id: activeClientIdRef.current,
        quoteType: "package",
        prospectName: snapshot.prospectName.trim(),
        quoteData: snapshot,
      });

      if (generation !== saveGenerationRef.current) return false;

      setActiveClientId(client.id);
      onClientSaved?.(client);
      clearLeaveBehindPackageDraft();
      setStatus("saved");

      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setStatus((current) => (current === "saved" ? "idle" : current));
      }, SAVED_INDICATOR_MS);

      return true;
    } catch {
      if (generation !== saveGenerationRef.current) return false;
      setStatus("error");
      return false;
    }
  }, [canAutosave, onClientSaved]);

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    if (!canAutosave) {
      writeLeaveBehindPackageDraft(quoteData);
      setStatus("idle");
      return;
    }

    setStatus((current) => (current === "saved" ? "idle" : current));

    const timer = setTimeout(() => {
      void persist();
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [quoteSnapshot, canAutosave, debounceMs, persist]);

  const saveNow = useCallback(async () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    return persist();
  }, [persist]);

  return {
    status,
    saveNow,
    canAutosave,
    isSaving: status === "pending",
  };
}
