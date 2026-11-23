"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Lock, Send } from "lucide-react";
import { ChoiceCard, OUTLINE_BTN } from "@/components/intake-ui";
import { UI, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";
import type { IntakeCaptureState } from "@/hooks/use-intake-secure-capture";

/** One thing the link can ask for, as the panel shows it. */
export type CaptureOption = {
  key: string;
  label: string;
  /** False until its type question is answered (which number, which kind of ID). */
  ready: boolean;
  /** The question to answer first, when not ready. */
  needs: string | null;
};

/**
 * The agent's control for the secure link, at the top of the steps it covers. An offer, never a
 * default: most clients read their numbers out. It exists for the ones who won't.
 *
 * The agent ticks what to ask for; this step's own items start ticked. One live link per intake,
 * so a new link replaces the old one, and after a client sends theirs the agent can issue another
 * for whatever is still missing.
 */
export default function SecureCapturePanel({
  locale,
  stepKey,
  options,
  defaultKeys,
  capture,
  url,
  busy,
  error,
  canSend,
  noCrm = false,
  replacedExisting,
  onCreate,
  onCancel,
  onSend,
  delivery,
}: {
  locale: IntakeLocale;
  /** The current step, so the default ticks follow it. */
  stepKey: string;
  options: CaptureOption[];
  defaultKeys: string[];
  capture: IntakeCaptureState | null;
  url: string | null;
  busy: boolean;
  error: string | null;
  canSend: boolean;
  /** The agent area: there is no CRM at all, so the hint never mentions one. */
  noCrm?: boolean;
  replacedExisting: boolean;
  onCreate: (groups: string[]) => void;
  onCancel: () => void;
  onSend: () => Promise<boolean>;
  /** The agent area: WhatsApp / SMS / share buttons for the live link (it has no CRM to send it). */
  delivery?: (url: string) => ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [fresh, setFresh] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  // This step's items, ticked when the panel first shows on it. Reset only on a step change: the
  // agent's own ticks survive an autosave re-render.
  useEffect(() => {
    setSelected(defaultKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const labelOf = (key: string) => options.find((o) => o.key === key)?.label ?? key;
  const errorLine = error && (
    <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {tr(UI.captureError, locale)}
    </p>
  );

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the URL is in the box beside the button */
    }
  }

  async function send() {
    if (await onSend()) {
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    }
  }

  if (capture?.status === "pending") {
    return (
      <div className="mb-5 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {tr(capture.openedAt ? UI.captureOpened : UI.captureWaiting, locale)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(UI.captureAskingFor, locale)} {capture.groups.map(labelOf).join(", ")}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
          />
          <div className="flex gap-2">
            <button type="button" onClick={copy} disabled={!url} className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {tr(copied ? UI.captureCopied : UI.captureCopy, locale)}
            </button>
            {canSend && (
              <button type="button" onClick={send} disabled={busy} className={`${OUTLINE_BTN} w-auto whitespace-nowrap px-4 py-2 text-sm`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {tr(sent ? UI.captureSent : UI.captureSendText, locale)}
              </button>
            )}
          </div>
        </div>
        {delivery && url ? <div className="mt-2">{delivery(url)}</div> : null}
        {!canSend && (
          <p className="mt-2 text-xs text-muted-foreground">{tr(noCrm ? UI.captureSendYourself : UI.captureNoContact, locale)}</p>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-3 text-sm font-medium text-muted-foreground underline hover:text-foreground"
        >
          {tr(UI.captureCancel, locale)}
        </button>
        {errorLine}
      </div>
    );
  }

  if (capture?.status === "submitted" && !fresh) {
    return (
      <div className="mb-5 rounded-2xl border-2 border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <p className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {tr(UI.captureReceived, locale)} {capture.groups.map(labelOf).join(", ")}
        </p>
        {replacedExisting && (
          <p className="mt-1.5 text-sm text-green-800/80 dark:text-green-300/80">{tr(UI.captureReplaced, locale)}</p>
        )}
        <button
          type="button"
          onClick={() => setFresh(true)}
          className="mt-2 text-sm font-medium text-green-800 underline hover:opacity-80 dark:text-green-300"
        >
          {tr(UI.captureAnother, locale)}
        </button>
      </div>
    );
  }

  const chosen = selected.filter((key) => options.some((o) => o.key === key && o.ready));
  return (
    <div className="mb-5 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
      <p className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
        <Lock className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.capturePanelTitle, locale)}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{tr(UI.capturePanelBody, locale)}</p>
      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr(UI.captureAskFor, locale)}
        </legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {options.map((option) => (
            <div key={option.key}>
              <ChoiceCard
                role="checkbox"
                selected={option.ready && selected.includes(option.key)}
                label={option.label}
                disabled={busy || !option.ready}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(option.key) ? prev.filter((k) => k !== option.key) : [...prev, option.key]
                  )
                }
              />
              {!option.ready && option.needs && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {tr(UI.captureNeedsType, locale)} {option.needs}
                </p>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={() => {
          setFresh(false);
          onCreate(chosen);
        }}
        disabled={busy || chosen.length === 0}
        className={`${OUTLINE_BTN} mt-3 w-auto px-4 py-2 text-sm disabled:opacity-50`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {tr(busy ? UI.captureCreating : UI.captureCreate, locale)}
      </button>
      {errorLine}
    </div>
  );
}
