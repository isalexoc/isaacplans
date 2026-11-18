"use client";

/**
 * Data access for the AI Setter panel: GET views of /api/admin/ai-setter, and POSTed actions with
 * an Idempotency-Key. Only one action runs at a time (every action button is disabled meanwhile),
 * and the views reload after each one so the panel always shows what the server decided.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";
import type { AdminActionInput } from "@/lib/ai-setter/actions";
import type { ActionResponse } from "./api-types";

const VIEW_URL = "/api/admin/ai-setter";
const ACTION_URL = "/api/admin/ai-setter/action";
const OFFLINE = "Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";

type SuccessBody = { success: true };
type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type ViewState<T> = {
  data: T | null;
  error: string | null;
  /** True until the first answer arrives, and while a reload is in flight. */
  loading: boolean;
  reload: () => Promise<void>;
};

/** Runs one action; resolves true when the server applied it. */
export type RunAction = (busyKey: string, input: AdminActionInput, successText: string) => Promise<boolean>;

function isSuccessBody(value: unknown): value is SuccessBody {
  return typeof value === "object" && value !== null && "success" in value && value.success === true;
}

function errorText(value: unknown): string | null {
  if (typeof value === "object" && value !== null && "error" in value && typeof value.error === "string") {
    return value.error;
  }
  return null;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    const body: unknown = await res.json();
    return body;
  } catch {
    return null;
  }
}

/** Fresh per action. `randomUUID` needs a secure context; plain http on a LAN falls back to random bytes. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchView<T extends SuccessBody>(query: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(`${VIEW_URL}?${query}`, { credentials: "same-origin", cache: "no-store" });
    const body = await readJson(res);
    if (isSuccessBody(body)) return { ok: true, data: body as T };
    return { ok: false, error: errorText(body) ?? `Error ${res.status} al cargar.` };
  } catch {
    return { ok: false, error: OFFLINE };
  }
}

function toActionResponse(body: unknown, status: number): ActionResponse {
  if (typeof body === "object" && body !== null && "success" in body && typeof body.success === "boolean") {
    return {
      success: body.success,
      error: errorText(body) ?? (body.success ? undefined : `Error ${status}`),
      data: "data" in body ? body.data : undefined,
    };
  }
  return { success: false, error: `Error ${status}` };
}

/**
 * One POST per action, with a fresh Idempotency-Key. Only when the network drops mid-request (it
 * may or may not have arrived) is it sent once more with the SAME key, so it can't apply twice.
 */
export async function postAdminAction(input: AdminActionInput): Promise<ActionResponse> {
  const key = newIdempotencyKey();
  const init: RequestInit = {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(input),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(ACTION_URL, init);
      return toActionResponse(await readJson(res), res.status);
    } catch {
      // Network error: retried once with the same key.
    }
  }
  return { success: false, error: OFFLINE };
}

/** Loads `?query` (null = not yet: lazy tabs) and keeps the last good data while reloading. */
export function useApiView<T extends SuccessBody>(query: string | null): ViewState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: false,
  });
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    if (query === null) return;
    const id = ++sequence.current;
    setState((s) => ({ ...s, loading: true }));
    const result = await fetchView<T>(query);
    if (id !== sequence.current) return;
    setState((s) =>
      result.ok ? { data: result.data, error: null, loading: false } : { data: s.data, error: result.error, loading: false }
    );
  }, [query]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const waitingFirst = query !== null && state.data === null && state.error === null;
  return { ...state, loading: state.loading || waitingFirst, reload };
}

/** Serializes actions, toasts the outcome and calls `afterEach` (reload) whatever happened. */
export function useAdminActions(afterEach: () => Promise<void>): { busyKey: string | null; run: RunAction } {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const inFlight = useRef(false);

  const run = useCallback<RunAction>(
    async (key, input, successText) => {
      if (inFlight.current) return false;
      inFlight.current = true;
      setBusyKey(key);
      try {
        const res = await postAdminAction(input);
        if (res.success) toast({ title: successText });
        else toast({ variant: "destructive", title: "No se pudo", description: res.error ?? "Error desconocido" });
        await afterEach();
        return res.success;
      } finally {
        inFlight.current = false;
        setBusyKey(null);
      }
    },
    [afterEach]
  );

  return { busyKey, run };
}

/** A clock for relative times ("hace 5 min"), ticking every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Reload when Isaac comes back to the tab (no polling: an open panel must not keep the database
 * awake), at most once per `minGapMs`.
 */
export function useRefreshOnReturn(reload: () => Promise<void>, minGapMs = 30_000): void {
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const onChange = () => {
      if (document.visibilityState !== "visible" || Date.now() - last.current < minGapMs) return;
      last.current = Date.now();
      void reload();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [reload, minGapMs]);
}
