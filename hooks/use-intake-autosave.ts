"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveIntakePatch } from "@/lib/intake-core/api-client";
import { diffIntakeData, stableJson } from "@/lib/intake-core/diff";
import type { IntakeData } from "@/lib/intake-core/types";

export type IntakeAutosaveStatus = "idle" | "pending" | "saved" | "error";

const SAVED_INDICATOR_MS = 2500;
const DEFAULT_DEBOUNCE_MS = 1000;

/*
 * After every successful save the tab says so on `intake-saved:<token>`, so the agent's other tabs
 * of the same intake (the form beside the presentation, say) can reload what was saved. A page
 * never hears its own saves: it already shows them.
 */
const savedChannel = (token: string) => `intake-saved:${token}`;
const PAGE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export type IntakeSavedMessage = { at: number; from: string };

function announceSaved(token: string): void {
  try {
    const channel = new BroadcastChannel(savedChannel(token));
    const message: IntakeSavedMessage = { at: Date.now(), from: PAGE_ID };
    channel.postMessage(message);
    channel.close();
  } catch {
    /* no BroadcastChannel: other tabs still reload on focus and when they come back into view */
  }
}

/** Calls `onSaved` whenever ANOTHER tab saves this intake; returns the unsubscribe. */
export function subscribeIntakeSaved(
  token: string,
  onSaved: (message: IntakeSavedMessage) => void
): () => void {
  try {
    const channel = new BroadcastChannel(savedChannel(token));
    channel.onmessage = (event) => {
      const message = event.data as IntakeSavedMessage | null;
      if (message && typeof message.at === "number" && message.from !== PAGE_ID) onSaved(message);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}

/*
 * Saves this page still has on the wire, per intake. The presentation unmounts its form on "Back"
 * (which flushes) and mounts a new one on "Confirm my details"; that one must not load a copy
 * from before the flush landed, and it never hears this page's own announcement.
 */
const pendingSaves = new Map<string, Set<Promise<unknown>>>();
const SETTLE_WAIT_MS = 5000;

function trackSave(token: string, promise: Promise<unknown>): void {
  const pending = pendingSaves.get(token) ?? new Set<Promise<unknown>>();
  pending.add(promise);
  pendingSaves.set(token, pending);
  const done = () => {
    pending.delete(promise);
    if (pending.size === 0 && pendingSaves.get(token) === pending) pendingSaves.delete(token);
  };
  promise.then(done, done);
}

/**
 * A save made outside the form (a deck's plan switch): written the same way the form writes, tracked
 * so a form this page mounts next waits for it, and announced so the agent's other tabs reload.
 * Throws when the save fails, so the caller can put its control back.
 */
export async function savePatchAndAnnounce(lob: string, token: string, patch: IntakeData): Promise<void> {
  const promise = saveIntakePatch(lob, token, patch);
  trackSave(token, promise);
  await promise;
  announceSaved(token);
}

/** Resolves once this page's saves for `token` have landed (or after a few seconds at most). */
export function intakeSavesSettled(token: string): Promise<void> {
  const pending = pendingSaves.get(token);
  if (!pending?.size) return Promise.resolve();
  const settled = Promise.all(Array.from(pending, (p) => p.then(() => undefined, () => undefined)));
  return Promise.race([
    settled.then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, SETTLE_WAIT_MS)),
  ]);
}

/** A JSON copy, so the baseline never shares an object with the form's state. */
const copyData = (data: IntakeData): IntakeData => JSON.parse(JSON.stringify(data)) as IntakeData;

type Options = {
  lob: string;
  token: string;
  data: IntakeData;
  debounceMs?: number;
  /** Called after a successful save (e.g. to know the session became in_progress). */
  onSaved?: () => void;
  /**
   * Called when a save settles and leaves nothing to save: no unsaved edit, nothing on the wire or
   * queued (what `isSynced()` checks). A reload that had to wait for this tab's own edit runs here.
   */
  onSynced?: () => void;
};

/** The answers last known to be on the server, and the intake they belong to. */
type Baseline = { lob: string; token: string; data: IntakeData };

/** The request on the wire and what it carries. */
type InFlight = { promise: Promise<boolean>; patch: IntakeData; keepalive: boolean };

/**
 * Autosave for the shared intake form that sends only what changed.
 *
 * The baseline is the last state known to be on the server: what the form loaded (`adoptSaved`)
 * plus every value a save has since confirmed. Each save sends the top-level keys that differ from
 * it, and the server merges them in, so a tab never writes back an answer it didn't change. That
 * is what stops a stale tab from erasing answers typed in another one.
 *
 *  - Nothing saves before the first `adoptSaved`, so opening a form writes nothing.
 *  - One request at a time; edits made meanwhile go in a follow-up, so values land in order. An
 *    edit that leaves the screen as it was before the request (undone while it was on the wire) is
 *    still different from what the request carried, so it is sent once the reply is in.
 *  - A failed save leaves its keys dirty; they go again with the next save.
 *  - Pending edits are flushed on unmount (after any request on the wire), when the tab is hidden,
 *    and on `pagehide` with `keepalive` so the request outlives the page.
 */
export function useIntakeAutosave({
  lob,
  token,
  data,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  onSaved,
  onSynced,
}: Options) {
  const [status, setStatus] = useState<IntakeAutosaveStatus>("idle");
  /*
   * Counts the saves that went through. The screen can still differ from what a save carried (an
   * edit undone while it was on the wire), and nothing re-renders on a reply by itself; a new count
   * makes the debounce look again, so that edit is sent too.
   */
  const [landed, setLanded] = useState(0);
  const dataRef = useRef(data);
  const onSavedRef = useRef(onSaved);
  const onSyncedRef = useRef(onSynced);
  const routeRef = useRef({ lob, token });
  const baselineRef = useRef<Baseline | null>(null);
  const inFlightRef = useRef<InFlight | null>(null);
  /** A follow-up waiting for the request on the wire; it reads the latest answers when it starts. */
  const queuedRef = useRef<Promise<boolean> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  dataRef.current = data;
  onSavedRef.current = onSaved;
  onSyncedRef.current = onSynced;
  routeRef.current = { lob, token };

  const snapshot = JSON.stringify(data);

  /** Answers changed since the baseline (none before the form has loaded). */
  const dirty = useCallback((): IntakeData => {
    const baseline = baselineRef.current;
    return baseline ? diffIntakeData(baseline.data, dataRef.current) : {};
  }, []);

  /** True when everything on screen is on the server: no unsaved edit, no save in flight or queued. */
  const isSynced = useCallback(
    () =>
      baselineRef.current !== null &&
      !inFlightRef.current &&
      !queuedRef.current &&
      Object.keys(dirty()).length === 0,
    [dirty]
  );

  /** Tell the form once a save has left nothing to save. */
  const reportIfSynced = useCallback(() => {
    if (isSynced()) onSyncedRef.current?.();
  }, [isSynced]);

  /** A save went through: the baseline takes exactly the values it carried. */
  const absorb = useCallback((saveLob: string, saveToken: string, sent: IntakeData) => {
    const baseline = baselineRef.current;
    // A baseline adopted for another intake meanwhile has nothing to do with this save.
    if (!baseline || baseline.lob !== saveLob || baseline.token !== saveToken) return;
    baselineRef.current = { ...baseline, data: { ...baseline.data, ...copyData(sent) } };
  }, []);

  /** Send what is dirty right now. Callers make sure nothing else is on the wire. */
  const send = useCallback((): Promise<boolean> => {
    const baseline = baselineRef.current;
    if (!baseline) return Promise.resolve(true);
    const patch = diffIntakeData(baseline.data, dataRef.current);
    if (Object.keys(patch).length === 0) return Promise.resolve(true);

    const { lob: saveLob, token: saveToken } = baseline;
    // Hidden, the page may be frozen or closed before the reply comes: let the request outlive it.
    const keepalive = document.visibilityState === "hidden";
    setStatus("pending");
    const promise: Promise<boolean> = saveIntakePatch(saveLob, saveToken, patch, { keepalive })
      .then(
        () => true,
        () => false
      )
      .then((ok) => {
        if (inFlightRef.current?.promise === promise) inFlightRef.current = null;
        if (!ok) {
          setStatus("error");
          return false;
        }
        absorb(saveLob, saveToken, patch);
        // An edit made while this was on the wire can still be unsaved (one undone back to the old
        // value, say). Then the tab isn't "saved", and the debounce, prompted by `landed`, sends it.
        const unsaved = Object.keys(dirty()).length > 0;
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        if (unsaved) {
          setStatus("idle");
        } else {
          setStatus("saved");
          savedTimerRef.current = setTimeout(() => {
            setStatus((cur) => (cur === "saved" ? "idle" : cur));
          }, SAVED_INDICATOR_MS);
        }
        setLanded((n) => n + 1);
        announceSaved(saveToken);
        onSavedRef.current?.();
        reportIfSynced();
        return true;
      });
    inFlightRef.current = { promise, patch, keepalive };
    trackSave(saveToken, promise);
    return promise;
  }, [absorb, dirty, reportIfSynced]);

  /**
   * Save everything dirty now, after any request already on the wire. Resolves true once nothing
   * on screen is left unsaved, false if the last attempt failed.
   */
  const flush = useCallback((): Promise<boolean> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (queuedRef.current) return queuedRef.current;
    const inFlight = inFlightRef.current;
    if (!inFlight) return send();
    const next = () => {
      queuedRef.current = null;
      const sent = send();
      // Nothing was left to send (the request it waited for carried it all). That save found this
      // follow-up still queued, so it couldn't say everything is saved; say it here.
      if (!inFlightRef.current) reportIfSynced();
      return sent;
    };
    const queued = inFlight.promise.then(next, next);
    queuedRef.current = queued;
    const baseline = baselineRef.current;
    if (baseline) trackSave(baseline.token, queued);
    return queued;
  }, [send, reportIfSynced]);

  useEffect(() => {
    if (Object.keys(dirty()).length === 0) return;
    setStatus((cur) => (cur === "saved" ? "idle" : cur));
    const timer = setTimeout(() => {
      debounceRef.current = null;
      void flush();
    }, debounceMs);
    debounceRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (debounceRef.current === timer) debounceRef.current = null;
    };
  }, [snapshot, landed, debounceMs, dirty, flush]);

  // Unsaved edits go out when the tab is hidden and when the form unmounts (the presentation's
  // "Back" does that); flush waits for a request already on the wire, so values land in order.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      void flush();
    };
  }, [flush]);

  // Leaving the page: send every key not yet confirmed (still dirty, or on the wire, whose reply
  // may never come) with its latest value, with keepalive so the request outlives the page.
  useEffect(() => {
    const onPageHide = () => {
      const baseline = baselineRef.current;
      if (!baseline) return;
      const inFlight = inFlightRef.current;
      const keys = new Set([
        ...Object.keys(inFlight?.patch ?? {}),
        ...Object.keys(diffIntakeData(baseline.data, dataRef.current)),
      ]);
      if (keys.size === 0) return;
      const patch: IntakeData = {};
      for (const key of keys) patch[key] = dataRef.current[key];
      // Already on the wire with keepalive and carrying exactly this: it outlives the page anyway.
      if (inFlight?.keepalive && stableJson(inFlight.patch) === stableJson(patch)) return;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const { lob: saveLob, token: saveToken } = baseline;
      void saveIntakePatch(saveLob, saveToken, patch, { keepalive: true }).then(
        () => {
          absorb(saveLob, saveToken, patch);
          announceSaved(saveToken);
        },
        () => {
          /* the keys stay dirty: a page restored from the back-forward cache sends them again */
        }
      );
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [absorb]);

  /**
   * Take answers just read from the server as the saved state, so they aren't written back. Call it
   * right before putting the same answers in the form's state. Until the first call, nothing saves.
   */
  const adoptSaved = useCallback((saved: IntakeData) => {
    baselineRef.current = { ...routeRef.current, data: copyData(saved ?? {}) };
    // The screen is about to show them too. Until that render, a save set off by the tab hiding
    // would compare them with the old screen and send its stale values for exactly the answers
    // another tab changed.
    dataRef.current = copyData(saved ?? {});
  }, []);

  return { status, saveNow: flush, flush, isSaving: status === "pending", isSynced, adoptSaved };
}
