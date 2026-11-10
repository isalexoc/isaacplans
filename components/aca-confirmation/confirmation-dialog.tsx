"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  ExternalLink,
  FileSignature,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmationDocument from "@/components/aca-confirmation/confirmation-document";
import { useAcaConfirmationLive } from "@/hooks/use-aca-confirmation-status";
import {
  acaConfirmationPdfHref,
  actOnAcaConfirmation,
  createAcaConfirmation,
  fetchAcaConfirmationDetail,
} from "@/lib/aca-confirmation/api-client";
import { ACA_CONF_UI as UI, fill, tr } from "@/lib/aca-confirmation/dialog-strings";
import { renderConfirmationForm } from "@/lib/aca-confirmation/form-text";
import { cleanPersonName } from "@/lib/aca-confirmation/format";
import type {
  AcaConfirmationBadge,
  AcaConfirmationContact,
  AcaConfirmationDetail,
  AcaConfirmationLanguage,
  AcaConfirmationRecord,
} from "@/lib/aca-confirmation/types";

/**
 * The agent's side of the CMS application review confirmation, on the ACA intake dashboard.
 *
 * Mirrors the Impact enrollment dialog (components/intake/impact-enrollment-dialog.tsx): a row
 * button that opens a dialog loading the contact from the CRM. What differs is time. The agent is
 * on the phone, the application is filled in but NOT submitted, and the rule is: submit only after
 * the client has signed. So the dialog's main job is the live card (sent → opened → signed),
 * polled while it is open.
 */

type Locale = AcaConfirmationLanguage;

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function when(iso: string | null, locale: Locale, withTime = true): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(locale === "es" ? "es-US" : "en-US", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function badgeOf(record: AcaConfirmationRecord | undefined): AcaConfirmationBadge | null {
  if (!record) return null;
  return { id: record.id, state: record.state, at: record.signedAt ?? record.lastSentAt ?? record.createdAt };
}

/** Row button that opens the confirmation dialog for one CRM contact. */
export default function AcaConfirmationButton({
  contactId,
  intakeSessionId,
  locale,
  badge,
  onChange,
}: {
  contactId: string;
  intakeSessionId?: string;
  locale: Locale;
  badge?: AcaConfirmationBadge;
  onChange?: (contactId: string, badge: AcaConfirmationBadge | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const look =
    badge?.state === "signed"
      ? { className: "text-green-700 hover:text-green-800", icon: <CheckCircle2 className="mr-1 h-4 w-4" />, label: `${tr(UI.badgeSigned, locale)} · ${when(badge.at, locale, false)}` }
      : badge?.state === "pending"
        ? { className: "text-amber-700 hover:text-amber-800", icon: <FileSignature className="mr-1 h-4 w-4" />, label: `${tr(UI.badgeSent, locale)} · ${when(badge.at, locale, false)}` }
        : badge?.state === "expired"
          ? { className: "text-muted-foreground", icon: <FileSignature className="mr-1 h-4 w-4" />, label: tr(UI.badgeExpired, locale) }
          : { className: "text-brand hover:text-brand", icon: <FileSignature className="mr-1 h-4 w-4" />, label: tr(UI.button, locale) };

  return (
    <>
      <Button size="sm" variant="ghost" className={look.className} onClick={() => setOpen(true)}>
        {look.icon}
        {look.label}
      </Button>
      {open && (
        <AcaConfirmationDialog
          contactId={contactId}
          intakeSessionId={intakeSessionId}
          locale={locale}
          onClose={() => setOpen(false)}
          onChange={onChange}
        />
      )}
    </>
  );
}

type Phase = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; detail: AcaConfirmationDetail };

function AcaConfirmationDialog({
  contactId,
  intakeSessionId,
  locale,
  onClose,
  onChange,
}: {
  contactId: string;
  intakeSessionId?: string;
  locale: Locale;
  onClose: () => void;
  onChange?: (contactId: string, badge: AcaConfirmationBadge | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });
    fetchAcaConfirmationDetail(contactId, intakeSessionId)
      .then((detail) => !cancelled && setPhase({ kind: "ready", detail }))
      .catch((e) => !cancelled && setPhase({ kind: "error", message: e instanceof Error ? e.message : "Error" }));
    return () => {
      cancelled = true;
    };
  }, [contactId, intakeSessionId, attempt]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-brand" /> {tr(UI.title, locale)}
          </DialogTitle>
          <DialogDescription>{tr(UI.description, locale)}</DialogDescription>
        </DialogHeader>

        <Warning tone="amber" text={tr(UI.reminder, locale)} />

        {phase.kind === "loading" && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr(UI.loading, locale)}
          </div>
        )}

        {phase.kind === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{phase.message}</p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{tr(UI.close, locale)}</Button>
              <Button onClick={() => setAttempt((n) => n + 1)}>{tr(UI.retry, locale)}</Button>
            </DialogFooter>
          </div>
        )}

        {phase.kind === "ready" && (
          <ReadyView
            contactId={contactId}
            intakeSessionId={intakeSessionId}
            detail={phase.detail}
            locale={locale}
            onClose={onClose}
            onChange={onChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadyView({
  contactId,
  intakeSessionId,
  detail,
  locale,
  onClose,
  onChange,
}: {
  contactId: string;
  intakeSessionId?: string;
  detail: AcaConfirmationDetail;
  locale: Locale;
  onClose: () => void;
  onChange?: (contactId: string, badge: AcaConfirmationBadge | null) => void;
}) {
  const [records, setRecords] = useState<AcaConfirmationRecord[]>(detail.history);
  // The form needs the CRM contact; without it (merged/deleted) the dialog is history only.
  const canSend = Boolean(detail.contact);
  const [showForm, setShowForm] = useState(detail.history.length === 0 && canSend);
  const [emailError, setEmailError] = useState<string | null>(null);
  /** Shown above the live card, e.g. why a send showed an existing request instead (409). */
  const [notice, setNotice] = useState<string | null>(null);
  const current = showForm ? null : (records[0] ?? null);

  const upsert = useCallback((record: AcaConfirmationRecord) => {
    setRecords((prev) =>
      [record, ...prev.filter((r) => r.id !== record.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }, []);

  // Keep the dashboard badge in step with the newest request (also corrects a stale badge on open).
  const newest = records[0];
  const badgeKey = newest ? `${newest.id}|${newest.state}|${newest.signedAt ?? newest.lastSentAt ?? ""}` : "";
  useEffect(() => {
    onChange?.(contactId, badgeOf(newest));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- badgeKey captures what the badge shows
  }, [badgeKey, contactId]);

  const live = useAcaConfirmationLive(current, {
    fileFieldConfigured: detail.config.fileFieldConfigured,
    onRecord: upsert,
  });

  const history = records.filter((r) => r.id !== current?.id);

  return (
    <div className="space-y-4">
      {!canSend && <Warning tone="amber" text={tr(UI.contactUnavailable, locale)} />}
      {notice && <Warning tone="amber" text={notice} />}
      {(showForm || !current) && detail.contact ? (
        <NewRequestForm
          contactId={contactId}
          intakeSessionId={intakeSessionId}
          detail={detail}
          contact={detail.contact}
          locale={locale}
          onCancel={records.length > 0 ? () => setShowForm(false) : onClose}
          onCreated={(record, error, pendingMessage) => {
            setEmailError(error);
            setNotice(pendingMessage);
            upsert(record);
            setShowForm(false);
          }}
        />
      ) : current ? (
        <LiveCard
          record={current}
          detail={detail}
          locale={locale}
          canSend={canSend}
          emailError={emailError}
          live={live}
          onRecord={(record, error) => {
            setEmailError(error);
            setNotice(null);
            upsert(record);
          }}
          onNew={() => {
            setEmailError(null);
            setNotice(null);
            setShowForm(true);
          }}
        />
      ) : null}

      {history.length > 0 && <History records={history} locale={locale} />}

      {!showForm && current && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tr(UI.close, locale)}</Button>
        </DialogFooter>
      )}
    </div>
  );
}

// ─── New request ─────────────────────────────────────────────────────────────

function NewRequestForm({
  contactId,
  intakeSessionId,
  detail,
  contact,
  locale,
  onCancel,
  onCreated,
}: {
  contactId: string;
  intakeSessionId?: string;
  detail: AcaConfirmationDetail;
  contact: AcaConfirmationContact;
  locale: Locale;
  onCancel: () => void;
  /** `pendingMessage`: set when the server answered with an existing pending request instead (409). */
  onCreated: (record: AcaConfirmationRecord, emailError: string | null, pendingMessage: string | null) => void;
}) {
  const { agent, emailIssue, config } = detail;
  const [name, setName] = useState(detail.suggestedName);
  const [language, setLanguage] = useState<Locale>(contact.language);
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consumerName = cleanPersonName(name);
  const canSend = Boolean(agent) && !emailIssue && consumerName.length >= 3 && !sending;

  const preview = useMemo(
    () =>
      agent && showPreview
        ? renderConfirmationForm(config.formVersion, language, {
            consumerName: consumerName || "—",
            consumerEmail: contact.email || "—",
            agent,
            reviewedAt: null,
          })
        : null,
    [agent, showPreview, config.formVersion, language, consumerName, contact.email]
  );

  async function send() {
    if (consumerName.length < 3) {
      setError(tr(UI.errName, locale));
      return;
    }
    setSending(true);
    setError(null);
    try {
      const outcome = await createAcaConfirmation(contactId, { consumerName, language, intakeSessionId });
      if (outcome.kind === "pending_exists") onCreated(outcome.record, null, outcome.error);
      else onCreated(outcome.record, outcome.emailSent ? null : outcome.emailError, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr(UI.client, locale)}</div>
        <div className="mt-1 font-medium">{contact.name || "—"}</div>
        <div className="text-muted-foreground">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}</div>
      </div>
      {emailIssue === "missing" && <Warning tone="red" text={tr(UI.emailMissing, locale)} />}
      {emailIssue === "agency_domain" && <Warning tone="red" text={tr(UI.emailAgency, locale)} />}

      <div>
        <Label htmlFor="aca-conf-name">{tr(UI.legalName, locale)}</Label>
        <Input
          id="aca-conf-name"
          value={name}
          autoComplete="off"
          maxLength={120}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          onBlur={(e) => setName(cleanPersonName(e.target.value))}
        />
        <p className="mt-1 text-xs text-muted-foreground">{tr(UI.legalNameHint, locale)}</p>
      </div>

      <div>
        <Label htmlFor="aca-conf-lang">{tr(UI.language, locale)}</Label>
        <select
          id="aca-conf-lang"
          value={language}
          onChange={(e) => setLanguage(e.target.value === "en" ? "en" : "es")}
          className={SELECT_CLASS}
        >
          <option value="es">{tr(UI.spanish, locale)}</option>
          <option value="en">{tr(UI.english, locale)}</option>
        </select>
        <p className="mt-1 text-xs text-muted-foreground">{tr(UI.languageHint, locale)}</p>
      </div>

      <div className="rounded-md border p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr(UI.agent, locale)}</div>
        {agent ? (
          <div className="mt-1">
            <span className="font-medium">{agent.name}</span> · NPN {agent.npn}
          </div>
        ) : (
          <div className="mt-2">
            <Warning tone="red" text={tr(UI.agentMissing, locale)} />
          </div>
        )}
      </div>

      {config.formNotice === "py2028" && <Warning tone="amber" text={tr(UI.py2028, locale)} />}
      {!config.fileFieldConfigured && <Warning tone="amber" text={tr(UI.fileFieldMissing, locale)} />}

      {agent && (
        <div>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {tr(showPreview ? UI.hidePreview : UI.preview, locale)}
          </button>
          {preview && (
            <div className="mt-2">
              <ConfirmationDocument form={preview} compact />
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{fill(tr(UI.linkExpiry, locale), { days: config.linkTtlDays })}</p>
      {error && <Warning tone="red" text={error} />}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} disabled={sending}>
          {tr(UI.cancel, locale)}
        </Button>
        <Button onClick={send} disabled={!canSend}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {tr(sending ? UI.sending : UI.send, locale)}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Live card ───────────────────────────────────────────────────────────────

function LiveCard({
  record,
  detail,
  locale,
  canSend,
  emailError,
  live,
  onRecord,
  onNew,
}: {
  record: AcaConfirmationRecord;
  detail: AcaConfirmationDetail;
  locale: Locale;
  /** False when the CRM contact is gone: history only, no resend or new request. */
  canSend: boolean;
  emailError: string | null;
  live: { polling: boolean; error: boolean; stopped: boolean; restart: () => void };
  onRecord: (record: AcaConfirmationRecord, emailError: string | null) => void;
  onNew: () => void;
}) {
  const [busy, setBusy] = useState<"resend" | "cancel" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { state } = record;
  const signed = state === "signed";
  const waiting = state === "pending";
  // Spinners only while reads are actually scheduled; otherwise an honest empty circle.
  const spinning = live.polling;

  async function act(action: "resend" | "cancel") {
    if (!window.confirm(tr(action === "resend" ? UI.resendConfirm : UI.cancelConfirm, locale))) return;
    setBusy(action);
    setActionError(null);
    setNotice(null);
    try {
      const result = await actOnAcaConfirmation(record.id, action);
      const failed = action === "resend" && result.emailSent === false;
      onRecord(result.record, failed ? (result.emailError ?? null) : null);
      if (action === "resend" && !failed) setNotice(tr(UI.resent, locale));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!record.url) return;
    try {
      await navigator.clipboard.writeText(record.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  const signedDetail = [
    record.signatureMethod ? tr(record.signatureMethod === "drawn" ? UI.methodDrawn : UI.methodTyped, locale) : null,
    record.signerDevice,
    record.signerLocation,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3 rounded-md border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr(UI.liveTitle, locale)}</div>
          <div className="font-medium">{record.consumerName}</div>
          <div className="text-xs text-muted-foreground">{record.contactEmail}</div>
        </div>
        {waiting && spinning && (
          <span className="relative flex h-3 w-3" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-brand" />
          </span>
        )}
      </div>

      {signed && <Banner tone="green" text={tr(UI.signedBanner, locale)} />}
      {state === "expired" && <Banner tone="amber" text={tr(UI.expiredBanner, locale)} />}
      {state === "cancelled" && <Banner tone="gray" text={tr(UI.cancelledBanner, locale)} />}

      <ol className="space-y-2 text-sm">
        {record.lastSentAt ? (
          <StepRow done label={tr(UI.stepSent, locale)} detail={[when(record.lastSentAt, locale), record.sendCount > 1 ? fill(tr(UI.stepSentTimes, locale), { count: record.sendCount }) : null].filter(Boolean).join(" · ")} />
        ) : (
          <StepRow failed label={tr(UI.stepNotSent, locale)} detail={emailError ?? ""} />
        )}
        {record.firstViewedAt ? (
          <StepRow done label={tr(UI.stepOpened, locale)} detail={[when(record.firstViewedAt, locale), record.viewCount > 1 ? fill(tr(UI.views, locale), { count: record.viewCount }) : null].filter(Boolean).join(" · ")} />
        ) : (
          <StepRow pending={waiting && spinning} label={tr(UI.stepWaitingOpen, locale)} />
        )}
        {record.signedAt ? (
          <StepRow done label={tr(UI.stepSigned, locale)} detail={[when(record.signedAt, locale), signedDetail].filter(Boolean).join(" · ")} />
        ) : (
          <StepRow label={tr(UI.stepWaitingSign, locale)} />
        )}
      </ol>
      {record.lastSentAt && emailError && <Warning tone="red" text={emailError} />}
      {record.signerIpMatchesAgent && <Warning tone="red" text={tr(UI.ipMatch, locale)} />}

      {signed && (
        <div className="rounded-md bg-muted/40 p-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr(UI.afterTitle, locale)}</div>
          <ol className="space-y-1.5 text-sm">
            <StepRow done={record.pdfStored} pending={!record.pdfStored && spinning} label={tr(UI.afterPdf, locale)} />
            {detail.config.fileFieldConfigured && (
              <StepRow done={record.crmFileSaved} pending={!record.crmFileSaved && spinning} label={tr(UI.afterFile, locale)} />
            )}
            <StepRow done={record.notePosted} pending={!record.notePosted && spinning} label={tr(UI.afterNote, locale)} />
            <StepRow done={record.tagged} pending={!record.tagged && spinning} label={tr(UI.afterTag, locale)} />
          </ol>
          {!detail.config.fileFieldConfigured && (
            <p className="mt-2 text-xs text-muted-foreground">{tr(UI.fileFieldMissing, locale)}</p>
          )}
        </div>
      )}

      {(live.error || live.stopped) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <span>{tr(live.error ? UI.pollError : UI.pollStopped, locale)}</span>
          <Button size="sm" variant="outline" onClick={live.restart}>
            <RotateCcw className="mr-1 h-4 w-4" /> {tr(UI.refresh, locale)}
          </Button>
        </div>
      )}
      {actionError && <Warning tone="red" text={actionError} />}
      {notice && <p className="text-sm text-green-700">{notice}</p>}

      <div className="flex flex-wrap gap-2 pt-1">
        {waiting && record.url && (
          <Button size="sm" variant="secondary" onClick={copy}>
            {copied ? <CheckCircle2 className="mr-1 h-4 w-4 text-green-600" /> : <Copy className="mr-1 h-4 w-4" />}
            {tr(copied ? UI.copied : UI.copyLink, locale)}
          </Button>
        )}
        {canSend && (waiting || state === "expired") && (
          <Button size="sm" variant="outline" onClick={() => act("resend")} disabled={busy !== null}>
            {busy === "resend" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1 h-4 w-4" />}
            {tr(UI.resend, locale)}
          </Button>
        )}
        {(waiting || state === "expired") && (
          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => act("cancel")} disabled={busy !== null}>
            {busy === "cancel" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <XCircle className="mr-1 h-4 w-4" />}
            {tr(UI.cancelRequest, locale)}
          </Button>
        )}
        {signed && (
          <>
            <Button size="sm" variant="secondary" asChild>
              <a href={acaConfirmationPdfHref(record.id)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" /> {tr(UI.viewPdf, locale)}
              </a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={acaConfirmationPdfHref(record.id, true)}>
                <Download className="mr-1 h-4 w-4" /> {tr(UI.downloadPdf, locale)}
              </a>
            </Button>
          </>
        )}
        {/* Only a pending request blocks a new one: a stuck post-signing step must never stop the next
            application or plan change from getting its own confirmation. */}
        {canSend && !waiting && (
          <Button size="sm" onClick={onNew}>
            <Plus className="mr-1 h-4 w-4" /> {tr(UI.newConfirmation, locale)}
          </Button>
        )}
      </div>
      {waiting && record.url && <p className="text-xs text-muted-foreground">{tr(UI.copyHint, locale)}</p>}
    </div>
  );
}

function StepRow({
  label,
  detail,
  done = false,
  pending = false,
  failed = false,
}: {
  label: string;
  detail?: string;
  done?: boolean;
  pending?: boolean;
  failed?: boolean;
}) {
  const icon = done ? (
    <CheckCircle2 className="h-4 w-4 text-green-600" />
  ) : failed ? (
    <XCircle className="h-4 w-4 text-red-600" />
  ) : pending ? (
    <Loader2 className="h-4 w-4 animate-spin text-brand" />
  ) : (
    <Circle className="h-4 w-4 text-muted-foreground" />
  );
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className={done ? "" : failed ? "text-red-700" : "text-muted-foreground"}>
        <span className={done ? "font-medium" : ""}>{label}</span>
        {detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
      </span>
    </li>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

function History({ records, locale }: { records: AcaConfirmationRecord[]; locale: Locale }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr(UI.history, locale)}</div>
      <ul className="divide-y rounded-md border text-sm">
        {records.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <div className="truncate font-medium">{r.consumerName}</div>
              <div className="text-xs text-muted-foreground">
                {r.state === "signed"
                  ? fill(tr(UI.historySigned, locale), { date: when(r.signedAt, locale) })
                  : r.state === "cancelled"
                    ? tr(UI.historyCancelled, locale)
                    : r.state === "expired"
                      ? tr(UI.historyExpired, locale)
                      : fill(tr(UI.historySent, locale), { date: when(r.lastSentAt ?? r.createdAt, locale) })}
              </div>
            </div>
            {r.state === "signed" && (
              <Button size="sm" variant="ghost" asChild>
                <a href={acaConfirmationPdfHref(r.id, true)}>
                  <Download className="mr-1 h-4 w-4" /> {tr(UI.downloadPdf, locale)}
                </a>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function Warning({ text, tone }: { text: string; tone: "amber" | "red" }) {
  const colors =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100";
  return (
    <p className={`flex items-start gap-2 rounded-md border p-3 text-sm ${colors}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {text}
    </p>
  );
}

function Banner({ text, tone }: { text: string; tone: "green" | "amber" | "gray" }) {
  const colors =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
        : "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200";
  return (
    <p className={`flex items-center gap-2 rounded-md border p-3 text-sm font-semibold ${colors}`}>
      {tone === "green" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
      {text}
    </p>
  );
}
