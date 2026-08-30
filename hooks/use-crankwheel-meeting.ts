"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CrankwheelMeetingKind } from "@/lib/crankwheel/types";

/**
 * Mints, watches and revokes a CrankWheel meeting link.
 *
 * A direct sibling of `hooks/use-iul-secure-capture.ts`, including the polling argument written
 * out there: CLAUDE.md forbids server-side crons that keep Neon awake around the clock, not a
 * browser asking our own API a question while the agent has a panel open. This poll exists only
 * while a live "meet now" link is outstanding, and stops on join, on revoke, on unmount and when
 * the tab is hidden.
 *
 * Scheduled links are never polled: CrankWheel gives them no lifecycle hooks, so there is nothing
 * for a poll to discover.
 */

export type MeetingStatus = "active" | "superseded" | "revoked" | "ended";

export type MeetingState = {
  id: string;
  kind: CrankwheelMeetingKind;
  status: MeetingStatus;
  url: string;
  locale: string;
  contactName: string | null;
  createdAt: string;
  expiresAt: string | null;
  sessionStartedAt: string | null;
  viewerJoinedAt: string | null;
  sentAt: string | null;
  durationSeconds: number | null;
};

/** What identifies the person the meeting is with. One of these is required to mint. */
export type MeetingTarget = {
  intakeToken?: string;
  crmContactId?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  locale?: string;
};

const POLL_MS = 3000;
/** After this long, slow down — a link open for ten minutes is not being watched second by second. */
const BACKOFF_AFTER_MS = 120_000;
const SLOW_POLL_MS = 10_000;
/** Network blips are normal on a laptop mid-call; don't give up on the first one. */
const MAX_ERRORS = 6;

export function useCrankwheelMeeting({ target }: { target: MeetingTarget }) {
  const [meeting, setMeeting] = useState<MeetingState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<number>(Date.now());
  const errorsRef = useRef(0);

  // Keeping the target in a ref stops `create` from being rebuilt on every parent render, which
  // would otherwise restart the poll effect each time the intake form autosaves.
  const targetRef = useRef(target);
  targetRef.current = target;

  const read = useCallback(async (id: string): Promise<MeetingState | null> => {
    const res = await fetch(`/api/crankwheel/meetings/${id}`, { credentials: "same-origin" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
    setMeeting(json.meeting ?? null);
    return json.meeting ?? null;
  }, []);

  /**
   * One read on mount, so a link minted before a page reload is still shown.
   *
   * Without this an agent who refreshes mid-call sees an empty panel and mints a second instant
   * link — which, because instant links truncate each other, would silently kill the one already
   * sitting on the client's phone.
   */
  useEffect(() => {
    const { intakeToken, crmContactId } = targetRef.current;
    if (!intakeToken && !crmContactId) return;
    const qs = new URLSearchParams(
      intakeToken ? { intakeToken } : { crmContactId: crmContactId as string }
    );

    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/crankwheel/meetings?${qs}`, { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!active || !res.ok || !json?.success || !json.meeting) return;
        startedAtRef.current = Date.now();
        setMeeting(json.meeting);
      } catch {
        /* nothing to restore — the idle panel is the correct fallback */
      }
    })();
    return () => {
      active = false;
    };
    // Re-runs when the target identity changes, which on the launcher means a different contact.
  }, [target.intakeToken, target.crmContactId]);

  /**
   * Watch only what can still change: a live instant link whose viewer has not arrived. Once the
   * client joins there is nothing further to learn until the note lands, hours later.
   */
  const shouldPoll =
    meeting?.kind === "now" && meeting.status === "active" && !meeting.viewerJoinedAt;

  useEffect(() => {
    if (!shouldPoll || !meeting) return;
    const id = meeting.id;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      // A backgrounded tab is not being watched; stop asking until it comes back.
      if (document.visibilityState !== "visible") {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const next = await read(id);
        errorsRef.current = 0;
        if (!active) return;
        if (!next || next.status !== "active" || next.viewerJoinedAt) return; // terminal
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
  }, [shouldPoll, meeting, read]);

  const create = useCallback(async (kind: CrankwheelMeetingKind) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crankwheel/meetings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...targetRef.current }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      startedAtRef.current = Date.now();
      errorsRef.current = 0;
      setMeeting(json.meeting);
      return json.meeting as MeetingState;
    } catch (e) {
      setError(e instanceof Error ? e.message : "create");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const revoke = useCallback(async () => {
    if (!meeting) return;
    setBusy(true);
    setError(null);
    try {
      await fetch(`/api/crankwheel/meetings/${meeting.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      setMeeting((m) => (m ? { ...m, status: "revoked" } : m));
    } catch {
      setError("revoke");
    } finally {
      setBusy(false);
    }
  }, [meeting]);

  const send = useCallback(async () => {
    if (!meeting) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crankwheel/meetings/${meeting.id}/send`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "failed");
      if (json.meeting) setMeeting(json.meeting);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "send");
      return false;
    } finally {
      setBusy(false);
    }
  }, [meeting]);

  /** Drop back to the idle state so the agent can mint a fresh link. */
  const reset = useCallback(() => {
    setMeeting(null);
    setError(null);
  }, []);

  return { meeting, busy, error, create, revoke, send, reset };
}
