"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CaptureScope } from "@/lib/iul-intake/fields";

/**
 * Watches a secure capture link and reports the masked values as the client fills them in.
 *
 * Polling, not push. The repo has no SSE or WebSocket, and QStash — the project's standard for
 * background work — pushes to servers, not browsers. Modelled on the Social Media Studio's job
 * poll (`components/social-media-studio/VideoImageStudio.tsx`), which is the established pattern
 * here.
 *
 * On CLAUDE.md's "no polling" rule: that rule forbids server-side crons that hit Neon around the
 * clock regardless of activity. This is the opposite — it exists only while an agent has the form
 * open with a link actually outstanding, and it stops on submit, on cancel, on unmount, and when
 * the tab is hidden. A phone call's worth of reads, not a standing bill.
 */

export type CaptureStatus = "pending" | "submitted" | "cancelled";

export type CaptureState = {
  token: string;
  status: CaptureStatus;
  createdAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  /** What this link asks for. Display only — the server enforces its own frozen snapshot. */
  scope: CaptureScope;
};

const POLL_MS = 3000;
/** After this long, slow down — a link open for ten minutes is not being watched second by second. */
const BACKOFF_AFTER_MS = 120_000;
const SLOW_POLL_MS = 10_000;
/** Network blips are normal on a laptop mid-call; don't give up on the first one. */
const MAX_ERRORS = 6;

export function useIulSecureCapture({
  token,
  enabled,
  onValues,
}: {
  token: string;
  /** False for the client view, or once the form is submitted — nothing to watch. */
  enabled: boolean;
  /** Called with the masked values whenever the server reports them. */
  onValues: (values: Record<string, string>) => void;
}) {
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onValuesRef = useRef(onValues);
  onValuesRef.current = onValues;
  const startedAtRef = useRef<number>(Date.now());
  const errorsRef = useRef(0);

  const read = useCallback(async (): Promise<CaptureState | null> => {
    const res = await fetch(`/api/iul-intake/${token}/secure-capture`, {
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
    setCapture(json.capture ?? null);
    setUrl(json.url ?? null);
    if (json.values && typeof json.values === "object") onValuesRef.current(json.values);
    return json.capture ?? null;
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
        if (next?.status !== "pending") return; // terminal — the effect will tear down
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

  const create = useCallback(async (scope: CaptureScope = "both") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iul-intake/${token}/secure-capture`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
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
  }, [token]);

  const cancel = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/iul-intake/${token}/secure-capture`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      setCapture((c) => (c ? { ...c, status: "cancelled" } : c));
      setUrl(null);
    } catch {
      setError("cancel");
    } finally {
      setBusy(false);
    }
  }, [token]);

  const send = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/iul-intake/${token}/secure-capture/send`, {
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
