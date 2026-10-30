"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, HeartHandshake, Loader2, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatAmount,
  formatPaymentDay,
  formatStartDate,
  IMPACT_WEBHOOK_ENV,
  impactEnrollmentInputSchema,
  parseAmountToCents,
  type ImpactEnrollmentInput,
  type ImpactLanguage,
} from "@/lib/impact-enrollment/format";
import { fetchImpactEnrollment, fetchImpactStatuses, sendImpactWelcome } from "@/lib/impact-enrollment/api-client";
import { renderCardImage } from "@/lib/impact-enrollment/card-render";
import type { ImpactEnrollmentDetail, ImpactEnrollmentStatus, ImpactSendResult } from "@/lib/impact-enrollment/types";
import { IMPACT_UI, fill } from "@/lib/impact-enrollment/ui-strings";
import { tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MAX_PDF_BYTES = 3 * 1024 * 1024;

function shortDate(iso: string, locale: IntakeLocale): string {
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" });
}

/** "Sent" state for the dashboard rows on screen. Badge-only, so a failed fetch just shows none. */
export function useImpactStatuses(contactIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, ImpactEnrollmentStatus>>({});
  const key = contactIds.join(",");

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    fetchImpactStatuses(key.split(","))
      .then((s) => !cancelled && setStatuses((prev) => ({ ...prev, ...s })))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key]);

  function markSent(contactId: string, status: ImpactEnrollmentStatus) {
    setStatuses((prev) => ({ ...prev, [contactId]: status }));
  }

  return { statuses, markSent };
}

/** Row button that opens the welcome dialog for one CRM contact. */
export default function ImpactEnrollmentButton({
  contactId,
  locale,
  status,
  onSent,
}: {
  contactId: string;
  locale: IntakeLocale;
  status?: ImpactEnrollmentStatus;
  onSent?: (contactId: string, status: ImpactEnrollmentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const sentAt = status?.lastSentAt;

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className={sentAt ? "text-green-700 hover:text-green-800" : "text-brand hover:text-brand"}
        onClick={() => setOpen(true)}
      >
        {sentAt ? <CheckCircle2 className="mr-1 h-4 w-4" /> : <HeartHandshake className="mr-1 h-4 w-4" />}
        {sentAt ? `${tr(IMPACT_UI.buttonSent, locale)} · ${shortDate(sentAt, locale)}` : tr(IMPACT_UI.button, locale)}
      </Button>
      {open && (
        <ImpactEnrollmentDialog
          contactId={contactId}
          locale={locale}
          onClose={() => setOpen(false)}
          onSent={onSent}
        />
      )}
    </>
  );
}

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "form"; detail: ImpactEnrollmentDetail }
  | { kind: "sent"; result: ImpactSendResult };

function ImpactEnrollmentDialog({
  contactId,
  locale,
  onClose,
  onSent,
}: {
  contactId: string;
  locale: IntakeLocale;
  onClose: () => void;
  onSent?: (contactId: string, status: ImpactEnrollmentStatus) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });
    fetchImpactEnrollment(contactId)
      .then((detail) => !cancelled && setPhase({ kind: "form", detail }))
      .catch((e) => !cancelled && setPhase({ kind: "error", message: e instanceof Error ? e.message : "Error" }));
    return () => {
      cancelled = true;
    };
  }, [contactId, attempt]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-brand" /> {tr(IMPACT_UI.title, locale)}
          </DialogTitle>
          <DialogDescription>{tr(IMPACT_UI.description, locale)}</DialogDescription>
        </DialogHeader>

        {phase.kind === "loading" && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr(IMPACT_UI.loading, locale)}
          </div>
        )}

        {phase.kind === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-red-600">{phase.message}</p>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>{tr(IMPACT_UI.cancel, locale)}</Button>
              <Button onClick={() => setAttempt((n) => n + 1)}>{tr(IMPACT_UI.retry, locale)}</Button>
            </DialogFooter>
          </div>
        )}

        {phase.kind === "form" && (
          <ImpactEnrollmentForm
            detail={phase.detail}
            locale={locale}
            onCancel={onClose}
            onSent={(result) => {
              onSent?.(contactId, { sendCount: result.enrollment.sendCount, lastSentAt: result.enrollment.lastSentAt });
              setPhase({ kind: "sent", result });
            }}
          />
        )}

        {phase.kind === "sent" && <SentSummary result={phase.result} locale={locale} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function SentSummary({ result, locale, onClose }: { result: ImpactSendResult; locale: IntakeLocale; onClose: () => void }) {
  const lines = [
    result.emailSent ? tr(IMPACT_UI.sentEmail, locale) : null,
    result.workflowStarted ? tr(IMPACT_UI.sentMessages, locale) : null,
    result.notePosted ? tr(IMPACT_UI.sentNote, locale) : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{tr(IMPACT_UI.sentTitle, locale)}</p>
          {lines.map((line) => (
            <p key={line} className="mt-1">{line}</p>
          ))}
        </div>
      </div>
      {result.workflowFailed && <Warning tone="red" text={tr(IMPACT_UI.workflowFailed, locale)} />}
      {!result.notePosted && <Warning text={tr(IMPACT_UI.noteFailed, locale)} />}
      <DialogFooter>
        <Button onClick={onClose}>{tr(IMPACT_UI.done, locale)}</Button>
      </DialogFooter>
    </div>
  );
}

function Warning({ text, tone = "amber" }: { text: string; tone?: "amber" | "red" }) {
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

type FormValues = {
  language: ImpactLanguage;
  memberId: string;
  startDate: string;
  amount: string;
  paymentDay: string;
  sendEmail: boolean;
  sendMessages: boolean;
};

/** A card picked in this dialog: the PDF plus the front-over-back JPG rendered from it. */
type CardFile = { pdf: File; image: Blob; previewUrl: string; pages: number };

function initialValues(detail: ImpactEnrollmentDetail, locale: IntakeLocale): FormValues {
  const previous = detail.enrollment;
  return {
    language: previous?.language ?? detail.contact.suggestedLanguage ?? locale,
    memberId: previous?.memberId ?? "",
    startDate: previous?.startDate ?? "",
    amount: previous ? (previous.monthlyAmountCents / 100).toFixed(2) : "",
    paymentDay: previous ? String(previous.paymentDay) : "",
    sendEmail: true,
    sendMessages: true,
  };
}

/** Localized first problem, or the input ready to send. Channels arrive already gated by config. */
function validate(
  values: FormValues,
  hasCard: boolean,
  locale: IntakeLocale
): { input: ImpactEnrollmentInput } | { error: string } {
  const cents = parseAmountToCents(values.amount);
  const parsed = impactEnrollmentInputSchema.safeParse({
    language: values.language,
    memberId: values.memberId.trim(),
    startDate: values.startDate,
    monthlyAmountCents: cents ?? 0,
    paymentDay: Number(values.paymentDay) || 0,
    sendEmail: values.sendEmail,
    sendMessages: values.sendMessages,
  });
  if (parsed.success) return hasCard ? { input: parsed.data } : { error: tr(IMPACT_UI.errCard, locale) };
  const field = parsed.error.issues[0]?.path[0];
  if (field === "memberId") return { error: tr(IMPACT_UI.errMemberId, locale) };
  if (field === "startDate") return { error: tr(IMPACT_UI.errStartDate, locale) };
  if (field === "monthlyAmountCents") return { error: tr(IMPACT_UI.errAmount, locale) };
  if (field === "sendEmail") return { error: tr(IMPACT_UI.errChannels, locale) };
  return { error: tr(IMPACT_UI.errPaymentDay, locale) };
}

function ImpactEnrollmentForm({
  detail,
  locale,
  onCancel,
  onSent,
}: {
  detail: ImpactEnrollmentDetail;
  locale: IntakeLocale;
  onCancel: () => void;
  onSent: (result: ImpactSendResult) => void;
}) {
  const { contact, enrollment, webhookConfigured, emailConfigured } = detail;
  const [values, setValues] = useState<FormValues>(() => initialValues(detail, locale));
  const [card, setCard] = useState<CardFile | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Free the preview's object URL when it is replaced or the dialog closes.
  useEffect(
    () => () => {
      if (card) URL.revokeObjectURL(card.previewUrl);
    },
    [card]
  );

  // Any edit clears the last error: it described the values as they were before this change.
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const workflowReady = webhookConfigured[values.language];
  const channels = {
    sendEmail: values.sendEmail && emailConfigured,
    sendMessages: values.sendMessages && workflowReady,
  };
  const storedCardImage = enrollment?.cardPdfUrl ? enrollment.cardImageUrl : null;
  const hasCard = Boolean(card || storedCardImage);
  const canSend = Boolean(contact.email) && (channels.sendEmail || channels.sendMessages) && !sending;

  async function handleSend() {
    const result = validate({ ...values, ...channels }, hasCard, locale);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    if (enrollment?.lastSentAt && !window.confirm(tr(IMPACT_UI.resendConfirm, locale))) return;
    setSending(true);
    setError(null);
    try {
      onSent(await sendImpactWelcome(contact.contactId, result.input, card ? { pdf: card.pdf, image: card.image } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <ContactCard detail={detail} locale={locale} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="impact-language">{tr(IMPACT_UI.messageLanguage, locale)}</Label>
          <select
            id="impact-language"
            value={values.language}
            onChange={(e) => set("language", e.target.value as ImpactLanguage)}
            className={SELECT_CLASS}
          >
            <option value="es">{tr(IMPACT_UI.spanish, locale)}</option>
            <option value="en">{tr(IMPACT_UI.english, locale)}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="impact-member-id">{tr(IMPACT_UI.memberId, locale)}</Label>
          <Input
            id="impact-member-id"
            value={values.memberId}
            autoComplete="off"
            onChange={(e) => set("memberId", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="impact-start-date">{tr(IMPACT_UI.startDate, locale)}</Label>
          <Input
            id="impact-start-date"
            type="date"
            value={values.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="impact-amount">{tr(IMPACT_UI.monthlyAmount, locale)}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input
              id="impact-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="pl-7"
              value={values.amount}
              onChange={(e) => set("amount", e.target.value)}
              onBlur={(e) => {
                const cents = parseAmountToCents(e.target.value);
                if (cents !== null) set("amount", (cents / 100).toFixed(2));
              }}
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="impact-payment-day">{tr(IMPACT_UI.paymentDay, locale)}</Label>
          <select
            id="impact-payment-day"
            value={values.paymentDay}
            onChange={(e) => set("paymentDay", e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">{tr(IMPACT_UI.pickDay, locale)}</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {fill(tr(IMPACT_UI.dayOption, locale), { day: d })}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <CardField
            locale={locale}
            card={card}
            storedImageUrl={storedCardImage}
            onCard={(next) => {
              setCard(next);
              setError(null);
            }}
          />
        </div>
      </div>

      <Preview values={values} locale={locale} />

      <ChannelChecks
        locale={locale}
        values={channels}
        emailAvailable={emailConfigured}
        messagesAvailable={workflowReady}
        onChange={(key, checked) => set(key, checked)}
      />

      {!workflowReady && (
        <Warning
          text={fill(tr(IMPACT_UI.workflowMissing, locale), {
            language: tr(values.language === "es" ? IMPACT_UI.spanish : IMPACT_UI.english, locale),
            env: IMPACT_WEBHOOK_ENV[values.language],
          })}
        />
      )}
      {!emailConfigured && <Warning text={tr(IMPACT_UI.emailMissing, locale)} />}
      {error && <Warning tone="red" text={error} />}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={onCancel} disabled={sending}>
          {tr(IMPACT_UI.cancel, locale)}
        </Button>
        <Button onClick={handleSend} disabled={!canSend}>
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {sending
            ? tr(IMPACT_UI.sending, locale)
            : tr(enrollment?.lastSentAt ? IMPACT_UI.resend : IMPACT_UI.send, locale)}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** PDF picker. Renders the card in the browser right away, so the agent sees it before sending. */
function CardField({
  locale,
  card,
  storedImageUrl,
  onCard,
}: {
  locale: IntakeLocale;
  card: CardFile | null;
  storedImageUrl: string | null;
  onCard: (card: CardFile) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(tr(IMPACT_UI.cardNotPdf, locale));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(tr(IMPACT_UI.cardTooBig, locale));
      return;
    }
    setRendering(true);
    try {
      const rendered = await renderCardImage(file);
      onCard({ pdf: file, image: rendered.image, previewUrl: rendered.previewUrl, pages: rendered.pages });
    } catch (e) {
      console.warn("[impact-card] render failed", e);
      setError(tr(IMPACT_UI.cardReadError, locale));
    } finally {
      setRendering(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const previewSrc = card?.previewUrl ?? storedImageUrl;
  const pick = () => inputRef.current?.click();

  return (
    <div>
      <Label htmlFor="impact-card">{tr(IMPACT_UI.card, locale)}</Label>
      <input
        ref={inputRef}
        id="impact-card"
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {rendering ? (
        <div className="mt-1 flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr(IMPACT_UI.cardRendering, locale)}
        </div>
      ) : previewSrc ? (
        <div className="mt-1 flex items-start gap-3 rounded-md border p-2">
          {/* Big enough to read the name on the card; click opens it full size to double-check. */}
          <a href={previewSrc} target="_blank" rel="noopener noreferrer" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview or CRM media URL */}
            <img src={previewSrc} alt="" className="h-56 w-auto rounded border bg-white object-contain" />
          </a>
          <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted-foreground">
            <span className="break-words">
              {card
                ? `${card.pdf.name} · ${fill(tr(IMPACT_UI.cardPages, locale), { pages: card.pages })}`
                : tr(IMPACT_UI.cardStored, locale)}
            </span>
            <Button type="button" size="sm" variant="outline" className="self-start" onClick={pick}>
              {tr(IMPACT_UI.cardChange, locale)}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="mt-1 w-full border-dashed" onClick={pick}>
          <Upload className="mr-2 h-4 w-4" /> {tr(IMPACT_UI.cardUpload, locale)}
        </Button>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{tr(IMPACT_UI.cardHint, locale)}</p>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ChannelChecks({
  locale,
  values,
  emailAvailable,
  messagesAvailable,
  onChange,
}: {
  locale: IntakeLocale;
  values: { sendEmail: boolean; sendMessages: boolean };
  emailAvailable: boolean;
  messagesAvailable: boolean;
  onChange: (key: "sendEmail" | "sendMessages", checked: boolean) => void;
}) {
  const rows = [
    { key: "sendEmail" as const, label: IMPACT_UI.channelEmail, available: emailAvailable },
    { key: "sendMessages" as const, label: IMPACT_UI.channelMessages, available: messagesAvailable },
  ];
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tr(IMPACT_UI.channels, locale)}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2">
            <Checkbox
              id={`impact-${row.key}`}
              checked={values[row.key]}
              disabled={!row.available}
              onCheckedChange={(checked) => onChange(row.key, checked === true)}
            />
            <Label htmlFor={`impact-${row.key}`} className={row.available ? "" : "text-muted-foreground"}>
              {tr(row.label, locale)}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactCard({ detail, locale }: { detail: ImpactEnrollmentDetail; locale: IntakeLocale }) {
  const { contact, enrollment } = detail;
  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {tr(IMPACT_UI.client, locale)}
        </div>
        <div className="mt-1 font-medium">{contact.name || "—"}</div>
        <div className="text-muted-foreground">{[contact.email, contact.phone].filter(Boolean).join(" · ") || "—"}</div>
        {contact.email && <div className="mt-1 text-xs text-muted-foreground">{tr(IMPACT_UI.emailHint, locale)}</div>}
        {enrollment?.lastSentAt && (
          <div className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">
            {fill(tr(IMPACT_UI.lastSent, locale), {
              date: new Date(enrollment.lastSentAt).toLocaleString(locale === "es" ? "es-US" : "en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
            {enrollment.sendCount > 1 ? ` · ${fill(tr(IMPACT_UI.sentTimes, locale), { count: enrollment.sendCount })}` : ""}
          </div>
        )}
      </div>
      {!contact.email && <Warning tone="red" text={tr(IMPACT_UI.noEmail, locale)} />}
      {contact.email && !contact.phone && <Warning text={tr(IMPACT_UI.noPhone, locale)} />}
    </div>
  );
}

/** The four values exactly as the client will read them, in the messages' language. */
function Preview({ values, locale }: { values: FormValues; locale: IntakeLocale }) {
  const rows = useMemo(() => {
    const cents = parseAmountToCents(values.amount);
    const day = Number(values.paymentDay);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(values.startDate);
    return [
      [IMPACT_UI.memberId, values.memberId.trim()],
      [IMPACT_UI.startDate, validDate ? formatStartDate(values.startDate, values.language) : ""],
      [IMPACT_UI.monthlyAmount, cents !== null && cents > 0 ? formatAmount(cents) : ""],
      [IMPACT_UI.paymentDay, day >= 1 && day <= 31 ? formatPaymentDay(day, values.language) : ""],
    ] as const;
  }, [values]);

  return (
    <div className="rounded-md border border-dashed p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {tr(IMPACT_UI.preview, locale)}
      </div>
      <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label.en} className="contents">
            <dt className="text-muted-foreground">{tr(label, locale)}</dt>
            <dd className="font-medium">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
