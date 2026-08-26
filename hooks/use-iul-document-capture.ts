"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Watches a document-upload link and reports how many files have arrived.
 *
 * Modelled on `use-iul-secure-capture`, with one deliberate difference: that link is single use, so
 * its poll stops the moment the status leaves "pending". This link never leaves "pending" on its
 * own — it stays open for more documents — so the poll instead slows down and keeps watching,
 * reporting each new arrival as the count moves.
 *
 * On CLAUDE.md's "no polling" rule: that forbids server-side crons hitting Neon around the clock
 * regardless of activity. This is the opposite — it exists only while an agent has the form open
 * with a link actually outstanding, and it stops on revoke, on unmount and when the tab is hidden.
 */

export type DocumentCaptureStatus = "pending" | "cancelled";

export type DocumentCaptureState = {
  token: string;
  status: DocumentCaptureStatus;
  uploadCount: number;
  createdAt: string;
  openedAt: string | null;
  lastUploadAt: string | null;
};

const POLL_MS = 4000;
/**
 * Backs off sooner and further than the secure-capture poll.
 *
 * That one is watching for a single event that ends it. This one may sit open for the rest of a
 * call while the client finds a document in a drawer, so a steady 4-second poll for ten minutes
 * would be reads nobody asked for.
 */
const BACKOFF_AFTER_MS = 90_000;
const SLOW_POLL_MS = 15_000;
/** Network blips are normal on a laptop mid-call; don't give up on the first one. */
const MAX_ERRORS = 6;

export function useIulDocumentCapture({
  token,
  enabled,
  onArrival,
}: {
  token: string;
  /** False for the client view, or once the form is submitted — nothing to watch. */
  enabled: boolean;
  /** Called when the received count goes up, so the form can refresh its Documents list. */
  onArrival?: () => void;
}) {
  const [capture, setCapture] = useState<DocumentCaptureState | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onArrivalRef = useRef(onArrival);
  onArrivalRef.current = onArrival;
  const startedAtRef = useRef<number>(Date.now());
  const errorsRef = useRef(0);
  const lastCountRef = useRef(0);

  const read = useCallback(async (): Promise<DocumentCaptureState | null> => {
    const res = await fetch(`/api/iul-intake/${token}/document-capture`, {
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
    const next: DocumentCaptureState | null = json.capture ?? null;
    setCapture(next);
    setUrl(json.url ?? null);
    if (next && next.uploadCount > lastCountRef.current) {
      lastCountRef.current = next.uploadCount;
      onArrivalRef.current?.();
    }
    return next;
  }, [token]);

  /** One read on mount, so a link created in an earlier session still shows up. */
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      try {
        await read();
      } catch {
        if (active) setCapture(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, read]);

  useEffect(() => {
    if (!enabled) return;
    if (capture?.status !== "pending") return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      // A backgrounded tab is not being watched; stop asking until it comes back.
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const next = await read();
        errorsRef.current = 0;
        if (!active) return;
        if (next?.status !== "pending") return; // revoked — the effect will tear down
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

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iul-intake/${token}/document-capture`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      startedAtRef.current = Date.now();
      errorsRef.current = 0;
      lastCountRef.current = 0;
      setCapture(json.capture);
      setUrl(json.url ?? null);
    } catch {
      setError("create");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const cancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iul-intake/${token}/document-capture`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      setCapture((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
      setUrl(null);
    } catch {
      setError("cancel");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const send = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iul-intake/${token}/document-capture/send`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      return true;
    } catch {
      setError("send");
      return false;
    } finally {
      setBusy(false);
    }
  }, [token]);

  return { capture, url, busy, error, create, cancel, send };
}
