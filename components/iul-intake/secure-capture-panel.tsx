"use client";

import { useState } from "react";
import { Loader2, Lock, Copy, Check, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { OUTLINE_BTN, ChoiceCard } from "@/components/intake-ui";
import { UI, tr, type IntakeLocale } from "@/lib/iul-intake/ui-strings";
import type { CaptureScope } from "@/lib/iul-intake/fields";
import type { CaptureState } from "@/hooks/use-iul-secure-capture";

/** Label for each scope, and the order they are offered in. "Both" first: it is the common case. */
const SCOPE_LABELS: { scope: CaptureScope; dict: (typeof UI)["captureScopeBoth"] }[] = [
  { scope: "both", dict: UI.captureScopeBoth },
  { scope: "ssn", dict: UI.captureScopeSsn },
  { scope: "bank", dict: UI.captureScopeBank },
];

function scopeLabel(scope: CaptureScope, locale: IntakeLocale): string {
  const found = SCOPE_LABELS.find((s) => s.scope === scope) ?? SCOPE_LABELS[0];
  return tr(found.dict, locale);
}

/**
 * The agent's control for the secure capture link, shown at the top of the payment step.
 *
 * Deliberately an offer, not a default. Most calls never touch it — the client reads their numbers
 * out and Isaac types them. It exists for the ones who won't, which used to be where the
 * conversation stopped.
 *
 * The scope picker exists because the agent frequently already holds half of this: a client who
 * read their bank details off a cheque but went quiet at the SSN should be sent one box, not four.
 * Asking someone to retype a number the agent already has correct is how it becomes wrong.
 */
export default function SecureCapturePanel({
  locale,
  capture,
  url,
  busy,
  error,
  replacedExisting,
  onCreate,
  onCancel,
  onSend,
}: {
  locale: IntakeLocale;
  capture: CaptureState | null;
  url: string | null;
  busy: boolean;
  error: string | null;
  /** True when the client's submission overwrote something the agent had already typed. */
  replacedExisting: boolean;
  onCreate: (scope: CaptureScope) => void;
  onCancel: () => void;
  onSend: () => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  /** Both is the common case, so it is preselected and the picker costs a glance, not a decision. */
  const [scope, setScope] = useState<CaptureScope>("both");

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

  if (capture?.status === "submitted") {
    return (
      <div className="mb-6 rounded-2xl border-2 border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <p className="flex items-center gap-2 font-semibold text-green-800 dark:text-green-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {tr(UI.captureReceived, locale)}
        </p>
        {/* Say it plainly, or the agent will one day wonder why an SSN changed under them. */}
        {replacedExisting && (
          <p className="mt-1.5 text-sm text-green-800/80 dark:text-green-300/80">
            {tr(UI.captureReplaced, locale)}
          </p>
        )}
      </div>
    );
  }

  if (capture?.status === "pending") {
    return (
      <div className="mb-6 rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {capture.openedAt ? tr(UI.captureOpened, locale) : tr(UI.captureWaiting, locale)}
        </p>

        {/* The live link's own scope, not the picker's — a link already in someone's text messages
            asks for what it asked for, whatever the picker happens to be showing now. */}
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(UI.captureAskingFor, locale)} {scopeLabel(capture.scope, locale)}
        </p>

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
          {tr(UI.captureCancel, locale)}
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
        <Lock className="h-4 w-4 shrink-0 text-brand" />
        {tr(UI.capturePanelTitle, locale)}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {tr(UI.capturePanelBody, locale)}
      </p>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
          {tr(UI.captureScopeLegend, locale)}
        </legend>
        {/* A radiogroup, not checkboxes: "neither" is not a link worth sending. */}
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {SCOPE_LABELS.map(({ scope: value, dict }) => (
            <ChoiceCard
              key={value}
              selected={scope === value}
              label={tr(dict, locale)}
              onClick={() => setScope(value)}
              disabled={busy}
            />
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={() => onCreate(scope)}
        disabled={busy}
        className={`${OUTLINE_BTN} mt-3 w-auto px-4 py-2 text-sm`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {busy ? tr(UI.captureCreating, locale) : tr(UI.captureCreate, locale)}
      </button>
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {tr(UI.captureError, locale)}
        </p>
      )}
    </div>
  );
}
