"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Loader2,
  MonitorPlay,
  Send,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { MEET, trm, type MeetingLocale } from "@/lib/crankwheel/ui-strings";
import type { MeetingState } from "@/hooks/use-crankwheel-meeting";
import type { CrankwheelMeetingKind } from "@/lib/crankwheel/types";

/**
 * The agent's control for starting a CrankWheel screen share.
 *
 * Two buttons because there are two genuinely different moments. "Meet now" is for when the agent
 * is already on the phone: the client taps and is in, with no number to read back. "Schedule" is
 * for a link that has to survive until Thursday, where the handshake is the point rather than the
 * friction.
 *
 * Shared by the IUL intake form and the standalone launcher — everything it needs arrives through
 * props, and it never knows which one it is inside.
 */
export default function MeetingPanel({
  locale,
  meeting,
  busy,
  error,
  canSend,
  compact = false,
  onCreate,
  onRevoke,
  onSend,
  onReset,
}: {
  locale: MeetingLocale;
  meeting: MeetingState | null;
  busy: boolean;
  error: string | null;
  /** False when there is no CRM contact — the link can still be copied, just not texted. */
  canSend: boolean;
  /** Slimmer padding for the bar that sits above the intake form's steps. */
  compact?: boolean;
  onCreate: (kind: CrankwheelMeetingKind) => void;
  onRevoke: () => void;
  onSend: () => Promise<boolean>;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  async function copy() {
    if (!meeting) return;
    try {
      await navigator.clipboard.writeText(meeting.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is visible in the field beside the button */
    }
  }

  async function send() {
    const ok = await onSend();
    if (ok) {
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    }
  }

  const shell = `rounded-2xl border-2 border-brand/30 bg-brand/5 ${compact ? "p-3" : "p-4"}`;

  // ── A link that is no longer usable ─────────────────────────────────────────
  if (meeting && (meeting.status === "revoked" || meeting.status === "superseded")) {
    return (
      <div className={`${shell} mb-4`}>
        <p className="text-sm text-muted-foreground">
          {trm(meeting.status === "revoked" ? MEET.revoked : MEET.superseded, locale)}
        </p>
        <button
          type="button"
          onClick={onReset}
          className="mt-2 text-sm font-medium text-brand underline hover:opacity-80"
        >
          {trm(MEET.newLink, locale)}
        </button>
      </div>
    );
  }

  // ── A live link ─────────────────────────────────────────────────────────────
  if (meeting) {
    const joined = Boolean(meeting.viewerJoinedAt);
    const sharing = Boolean(meeting.sessionStartedAt);
    const scheduled = meeting.kind === "scheduled";
    // Past its window an instant link stops skipping the handshake, but keeps working. Only worth
    // saying while nothing has happened yet — once sharing has started the window is moot.
    const windowPassed =
      !scheduled &&
      !sharing &&
      Boolean(meeting.expiresAt) &&
      new Date(meeting.expiresAt as string).getTime() < Date.now();

    const statusText = joined
      ? trm(MEET.clientJoined, locale)
      : scheduled
        ? trm(MEET.scheduledReady, locale)
        : sharing
          ? trm(MEET.sharingStarted, locale)
          : trm(MEET.waitingForClient, locale);

    return (
      <div
        className={`mb-4 rounded-2xl border-2 ${compact ? "p-3" : "p-4"} ${
          joined
            ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
            : "border-brand/30 bg-brand/5"
        }`}
      >
        <p
          className={`flex items-center gap-2 text-sm font-semibold ${
            joined ? "text-green-800 dark:text-green-300" : "text-brand"
          }`}
        >
          {joined ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : scheduled ? (
            <CalendarClock className="h-4 w-4 shrink-0" />
          ) : (
            // A live pulse only while something is genuinely still expected to change.
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
          )}
          {statusText}
        </p>

        {scheduled && !joined && (
          <p className="mt-1 text-sm text-muted-foreground">
            {trm(MEET.scheduledHandshakeNote, locale)}
          </p>
        )}

        {windowPassed && !joined && (
          <p className="mt-1 text-sm text-muted-foreground">{trm(MEET.windowPassed, locale)}</p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={meeting.url}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? trm(MEET.linkCopied, locale) : trm(MEET.copyLink, locale)}
            </button>
            {canSend && (
              <button
                type="button"
                onClick={send}
                disabled={busy}
                className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sent || meeting.sentAt ? trm(MEET.linkSent, locale) : trm(MEET.sendLink, locale)}
              </button>
            )}
          </div>
        </div>

        {!canSend && (
          <p className="mt-2 text-xs text-muted-foreground">{trm(MEET.noContact, locale)}</p>
        )}

        <button
          type="button"
          onClick={onRevoke}
          disabled={busy}
          className="mt-3 text-sm font-medium text-muted-foreground underline hover:text-foreground"
        >
          {trm(MEET.revoke, locale)}
        </button>

        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {trm(MEET.error, locale)}
          </p>
        )}
      </div>
    );
  }

  // ── Idle: offer the two kinds ───────────────────────────────────────────────
  return (
    <div className={`${shell} mb-4`}>
      <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
        <MonitorPlay className="h-4 w-4 shrink-0 text-brand" />
        {trm(MEET.panelTitle, locale)}
      </p>
      {!compact && (
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {trm(MEET.panelBody, locale)}
        </p>
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onCreate("now")}
          disabled={busy}
          className={`${OUTLINE_BTN} flex-col items-start gap-0.5 px-4 py-3 text-left text-sm disabled:opacity-60`}
        >
          <span className="flex items-center gap-2 font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
            {busy ? trm(MEET.creating, locale) : trm(MEET.meetNow, locale)}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {trm(MEET.meetNowHelp, locale)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onCreate("scheduled")}
          disabled={busy}
          className={`${OUTLINE_BTN} flex-col items-start gap-0.5 px-4 py-3 text-left text-sm disabled:opacity-60`}
        >
          <span className="flex items-center gap-2 font-semibold">
            <CalendarClock className="h-4 w-4" />
            {trm(MEET.schedule, locale)}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {trm(MEET.scheduleHelp, locale)}
          </span>
        </button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{trm(MEET.onlyOneNote, locale)}</p>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {trm(MEET.error, locale)}
        </p>
      )}
    </div>
  );
}
