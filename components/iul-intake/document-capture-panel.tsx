"use client";

import { useState } from "react";
import {
  Loader2,
  Paperclip,
  Copy,
  Check,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { OUTLINE_BTN } from "@/components/intake-ui";
import { UI, tr, type IntakeLocale } from "@/lib/iul-intake/ui-strings";
import type { DocumentCaptureState } from "@/hooks/use-iul-document-capture";

/**
 * The agent's control for the document-upload link, shown at the top of the Documents step.
 *
 * A sibling of `SecureCapturePanel`, with one difference that drives the whole layout: that link
 * disappears once the client submits, because it is spent. This one **stays on screen while
 * documents keep arriving**, so the live state is not "waiting" but "3 received, still open" —
 * the agent needs to see both at once to decide whether to keep waiting or close it.
 *
 * There is no scope picker here. The agent rarely knows in advance whether they need a licence, a
 * green card, or both sides of one card, and a link that asked for a named document would be
 * wrong more often than right.
 */
export default function DocumentCapturePanel({
  locale,
  capture,
  url,
  busy,
  error,
  onCreate,
  onCancel,
  onSend,
}: {
  locale: IntakeLocale;
  capture: DocumentCaptureState | null;
  url: string | null;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
  onCancel: () => void;
  onSend: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
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

  if (capture?.status === "pending") {
    const received = capture.uploadCount ?? 0;
    return (
      <div className="mb-6 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {capture.openedAt ? tr(UI.docOpened, locale) : tr(UI.docWaiting, locale)}
        </p>

        {/* Shown alongside "still open", never instead of it: the agent has to be able to see that
            three arrived AND that the client can still send a fourth. */}
        {received > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {tr(UI.docReceivedCount, locale).replace("{n}", String(received))}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              disabled={!url}
              className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? tr(UI.linkCopied, locale) : tr(UI.copyLink, locale)}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={busy}
              className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sent ? tr(UI.linkSent, locale) : tr(UI.sendLink, locale)}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-3 text-sm font-medium text-muted-foreground underline hover:text-foreground"
        >
          {tr(UI.docRevoke, locale)}
        </button>

        {error && (
          <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {tr(UI.captureError, locale)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
        <Paperclip className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.docPanelTitle, locale)}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {tr(UI.docPanelBody, locale)}
      </p>

      {/* A closed link that collected something still says so — otherwise revoking looks like it
          threw the documents away, when they are on the contact and listed below. */}
      {capture?.status === "cancelled" && (capture.uploadCount ?? 0) > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {tr(UI.docReceivedCount, locale).replace("{n}", String(capture.uploadCount))}
        </p>
      )}

      <button
        type="button"
        onClick={onCreate}
        disabled={busy}
        className={`${OUTLINE_BTN} mt-3 w-auto px-4 py-2 text-sm`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        {busy ? tr(UI.docCreating, locale) : tr(UI.docCreate, locale)}
      </button>

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {tr(UI.captureError, locale)}
        </p>
      )}
    </div>
  );
}
