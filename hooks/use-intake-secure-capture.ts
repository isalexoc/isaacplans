"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Watches an intake's secure link and hands back the masked values once the client sends them.
 *
 * The IUL hook (`use-iul-secure-capture.ts`) for the shared intake engine. Polling, not push: it
 * exists only while the agent has the form open with a link outstanding, and stops on submit, on
 * cancel, on unmount and while the tab is hidden — a phone call's worth of reads, not the
 * around-the-clock Neon polling CLAUDE.md rules out.
 */

export type IntakeCaptureStatus = "pending" | "submitted" | "cancelled";

export type IntakeCaptureState = {
  token: string;
  status: IntakeCaptureStatus;
  createdAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  /** Group keys this link asks for. Display only — the server enforces its own snapshot. */
  groups: string[];
};

const POLL_MS = 3000;
const BACKOFF_AFTER_MS = 120_000;
const SLOW_POLL_MS = 10_000;
const MAX_ERRORS = 6;

export function useIntakeSecureCapture({
  lob,
  token,
  enabled,
  onValues,
}: {
  lob: string;
  token: string;
  /** False in the client's view, while presenting, or once the form is submitted. */
  enabled: boolean;
  /** Called with the masked values the client sent. */
  onValues: (values: Record<string, string>) => void;
}) {
  const [capture, setCapture] = useState<IntakeCaptureState | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onValuesRef = useRef(onValues);
  onValuesRef.current = onValues;
  const startedAtRef = useRef(Date.now());
  const errorsRef = useRef(0);
  const base = `/api/intake/${lob}/${token}/secure-capture`;

  const read = useCallback(async (): Promise<IntakeCaptureState | null> => {
    const res = await fetch(base, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
    setCapture(json.capture ?? null);
    setUrl(json.url ?? null);
    if (json.values && typeof json.values === "object" && Object.keys(json.values).length) {
      onValuesRef.current(json.values);
    }
    return json.capture ?? null;
  }, [base]);

  /** One read on mount, so a link created before a reload still shows. */
  useEffect(() => {
    if (!enabled) return;
    read().catch(() => setCapture(null));
  }, [enabled, read]);

  useEffect(() => {
    if (!enabled || capture?.status !== "pending") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const next = await read();
        errorsRef.current = 0;
        if (!active || next?.status !== "pending") return;
      } catch {
        errorsRef.current += 1;
        if (errorsRef.current >= MAX_ERRORS) {
          if (active) setError("poll");
          return;
        }
      }
      if (!active) return;
      const elapsed = Date.now() - startedAtRef.current;
      timer = setTimeout(tick, elapsed > BACKOFF_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, capture?.status, read]);

  const create = useCallback(
    async (groups: string[]) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(base, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groups }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
        startedAtRef.current = Date.now();
        errorsRef.current = 0;
        setCapture(json.capture);
        setUrl(json.url ?? null);
      } catch {
        setError("create");
      } finally {
        setBusy(false);
      }
    },
    [base]
  );

  const cancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch(base, { method: "DELETE", credentials: "same-origin" });
      setCapture((c) => (c ? { ...c, status: "cancelled" } : c));
      setUrl(null);
    } catch {
      setError("cancel");
    } finally {
      setBusy(false);
    }
  }, [base]);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base}/send`, { method: "POST", credentials: "same-origin" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      return true;
    } catch {
      setError("send");
      return false;
    } finally {
      setBusy(false);
    }
  }, [base]);

  return { capture, url, busy, error, create, cancel, send };
}
