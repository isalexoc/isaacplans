"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAcaConfirmationBadges, fetchAcaConfirmationRecord } from "@/lib/aca-confirmation/api-client";
import type { AcaConfirmationBadge, AcaConfirmationRecord } from "@/lib/aca-confirmation/types";

/**
 * Status for the ACA confirmation: dashboard badges, and the live card in the dialog.
 *
 * Polling, not push, like the IUL secure-capture link (hooks/use-iul-secure-capture.ts): the repo
 * has no SSE/WebSocket channel to browsers. On CLAUDE.md's "no polling" rule: that forbids
 * server-side crons hitting Neon around the clock. This runs only while the agent has the dialog
 * open with a request actually moving, slows down after two minutes, stops after fifteen, skips
 * reads while the tab is hidden, and ends on unmount. A phone call's worth of reads.
 */

/** Badges for the rows on screen: one fetch per change of the id list. Failures just show none. */
export function useAcaConfirmationBadges(contactIds: string[]) {
  const [badges, setBadges] = useState<Record<string, AcaConfirmationBadge>>({});
  const key = Array.from(new Set(contactIds)).join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchAcaConfirmationBadges(key.split(","))
      .then((next) => !cancelled && setBadges((prev) => ({ ...prev, ...next })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  const update = useCallback((contactId: string, badge: AcaConfirmationBadge | null) => {
    setBadges((prev) => {
      const next = { ...prev };
      if (badge) next[contactId] = badge;
      else delete next[contactId];
      return next;
    });
  }, []);

  return { badges, update };
}

const POLL_MS = 3000;
const BACKOFF_AFTER_MS = 120_000;
const SLOW_POLL_MS = 10_000;
const STOP_AFTER_MS = 15 * 60_000;
const MAX_ERRORS = 6;

/**
 * Still worth watching: waiting for the client, or signed with a post-signing step (archive,
 * Documents copy when configured, note, tag) not finished yet.
 */
export function isLive(record: AcaConfirmationRecord | null, fileFieldConfigured: boolean): boolean {
  if (!record) return false;
  if (record.state === "pending") return true;
  if (record.state !== "signed") return false;
  return !record.pdfStored || !record.notePosted || !record.tagged || (fileFieldConfigured && !record.crmFileSaved);
}

/**
 * Re-reads one request while it is live and hands every fresh copy to `onRecord`.
 * `polling` is true only while reads are actually scheduled, so the dialog never shows a spinner
 * for updates that won't come; `stopped` (15 minutes) and `error` (6 failures in a row) say why it
 * ended, and `restart()` starts it again.
 */
export function useAcaConfirmationLive(
  record: AcaConfirmationRecord | null,
  { fileFieldConfigured, onRecord }: { fileFieldConfigured: boolean; onRecord: (record: AcaConfirmationRecord) => void }
): { polling: boolean; error: boolean; stopped: boolean; restart: () => void } {
  const [error, setError] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [run, setRun] = useState(0);
  const onRecordRef = useRef(onRecord);
  useEffect(() => {
    onRecordRef.current = onRecord;
  }, [onRecord]);

  const id = record?.id ?? null;
  const live = isLive(record, fileFieldConfigured);

  useEffect(() => {
    if (!id || !live) return;
    let active = true;
    let errors = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    setError(false);
    setStopped(false);

    const tick = async () => {
      if (!active) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed > STOP_AFTER_MS) {
        setStopped(true);
        return;
      }
      if (document.visibilityState === "visible") {
        try {
          const next = await fetchAcaConfirmationRecord(id);
          errors = 0;
          if (!active) return;
          onRecordRef.current(next); // a final state flips `live`, which tears this effect down
        } catch {
          errors += 1;
          if (errors >= MAX_ERRORS) {
            if (active) setError(true);
            return;
          }
        }
      }
      if (active) timer = setTimeout(tick, elapsed > BACKOFF_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, live, run]);

  const restart = useCallback(() => {
    setError(false);
    setStopped(false);
    setRun((n) => n + 1);
  }, []);

  return { polling: live && !error && !stopped, error, stopped, restart };
}
