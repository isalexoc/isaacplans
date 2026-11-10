"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { AlertCircle, CheckCircle2, FileSignature, Loader2, Phone } from "lucide-react";
import { GRADIENT_BTN } from "@/components/intake-ui/styles";
import ConfirmationDocument from "@/components/aca-confirmation/confirmation-document";
import SignatureInput, { type SignatureValue } from "@/components/aca-confirmation/signature-pad";
import { PAGE_UI, fill, tr } from "@/lib/aca-confirmation/page-strings";
import {
  fetchConfirmationView,
  submitConfirmationSignature,
  type DeadOutcome,
} from "@/lib/aca-confirmation/public-api-client";
import type { AcaConfirmationLanguage, AcaConfirmationPublicView } from "@/lib/aca-confirmation/types";

/**
 * The page a client opens from the email to review and sign their ACA application review
 * confirmation, usually on their phone while the agent waits on the line.
 *
 * The view is fetched here, in the browser, never on the server: that fetch is what marks the link
 * as opened, and a link preview or mail scanner that runs no JavaScript never makes it.
 *
 * Language: the URL decides the first one (the link says /es/ or /en/, the promise made to the
 * client), and the toggle switches it on the spot. The form comes in both languages, and the one
 * shown when they tap Sign is the one they signed.
 */

type Phase =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; view: AcaConfirmationPublicView }
  | { kind: "done"; view: AcaConfirmationPublicView; signedAtLocal: string }
  | { kind: "dead"; dead: DeadOutcome };

const ISSUE_MESSAGES: Record<string, keyof typeof PAGE_UI> = {
  signature_too_short: "errSignatureShort",
  typed_name_required: "errTypedName",
  signature_image: "errSignatureImage",
  typed_not_allowed: "errTypedNotAllowed",
};

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export default function AcaConfirmationSignForm({ token }: { token: string }) {
  const urlLocale = useLocale();
  const [language, setLanguage] = useState<AcaConfirmationLanguage>(urlLocale === "es" ? "es" : "en");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "loading" });
    fetchConfirmationView(token).then((outcome) => {
      if (cancelled) return;
      if (outcome.kind === "ok") setPhase({ kind: "ready", view: outcome.view });
      else if (outcome.kind === "dead") setPhase({ kind: "dead", dead: outcome });
      else setPhase({ kind: "error" });
    });
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  // The Sign button sits at the bottom of a long page. When the result replaces the form, the page
  // gets short but the browser keeps the old offset, which leaves the result's title under the
  // sticky header. Bring the top back into view.
  useEffect(() => {
    if (phase.kind === "done" || phase.kind === "dead") window.scrollTo({ top: 0, behavior: "auto" });
  }, [phase.kind]);

  const onSigned = useCallback(
    (view: AcaConfirmationPublicView, signedAtLocal: string) => setPhase({ kind: "done", view, signedAtLocal }),
    []
  );
  const onDead = useCallback((dead: DeadOutcome) => setPhase({ kind: "dead", dead }), []);

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-6 sm:pt-10">
      <div className="mb-4 flex justify-end">
        <LanguageToggle language={language} onChange={setLanguage} />
      </div>

      {phase.kind === "loading" && (
        <div className="flex items-center justify-center py-24 text-base text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(PAGE_UI.loading, language)}
        </div>
      )}

      {phase.kind === "error" && (
        <Notice tone="red" icon={<AlertCircle className="h-6 w-6" />} title={tr(PAGE_UI.errLoad, language)}>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${GRADIENT_BTN} mt-5`}>
            {tr(PAGE_UI.retry, language)}
          </button>
        </Notice>
      )}

      {phase.kind === "dead" && <DeadLink dead={phase.dead} language={language} />}

      {phase.kind === "done" && (
        <Notice
          tone="green"
          icon={<CheckCircle2 className="h-7 w-7" />}
          title={fill(tr(PAGE_UI.doneTitle, language), { name: phase.view.firstName })}
        >
          <p className="mt-2 text-base leading-relaxed text-gray-700">
            {fill(tr(PAGE_UI.doneBody, language), { date: phase.signedAtLocal })}
          </p>
          <p className="mt-1 text-base leading-relaxed text-gray-700">{tr(PAGE_UI.doneNext, language)}</p>
        </Notice>
      )}

      {phase.kind === "ready" && (
        <SignView token={token} view={phase.view} language={language} onSigned={onSigned} onDead={onDead} />
      )}
    </div>
  );
}

function LanguageToggle({
  language,
  onChange,
}: {
  language: AcaConfirmationLanguage;
  onChange: (language: AcaConfirmationLanguage) => void;
}) {
  const item = (value: AcaConfirmationLanguage, label: string) => (
    <button
      type="button"
      lang={value}
      aria-pressed={language === value}
      onClick={() => onChange(value)}
      className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
        language === value ? "bg-brand text-white" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white p-1 shadow-sm">
      {item("es", "Español")}
      {item("en", "English")}
    </div>
  );
}

function SignView({
  token,
  view,
  language,
  onSigned,
  onDead,
}: {
  token: string;
  view: AcaConfirmationPublicView;
  language: AcaConfirmationLanguage;
  onSigned: (view: AcaConfirmationPublicView, signedAtLocal: string) => void;
  onDead: (dead: DeadOutcome) => void;
}) {
  const [signature, setSignature] = useState<SignatureValue | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = view.form[language];
  const ready = Boolean(signature) && agreed && !signing;

  const onSignature = useCallback((value: SignatureValue | null) => {
    setSignature(value);
    setError(null);
  }, []);

  async function sign() {
    if (!signature || !agreed) {
      setError(tr(PAGE_UI.needSignature, language));
      return;
    }
    setSigning(true);
    setError(null);
    const outcome = await submitConfirmationSignature(token, {
      language,
      agreed: true,
      method: signature.method,
      png: signature.png,
      ...(signature.method === "drawn" ? { strokes: signature.strokes } : { typedName: signature.typedName }),
    });
    if (outcome.kind === "ok") {
      onSigned(view, outcome.result.signedAtLocal);
      return;
    }
    if (outcome.kind === "dead") {
      onDead(outcome);
      return;
    }
    setSigning(false);
    setError(
      outcome.kind === "invalid"
        ? tr(PAGE_UI[ISSUE_MESSAGES[outcome.issue ?? ""] ?? "errGeneric"], language)
        : tr(PAGE_UI.errNetwork, language)
    );
  }

  return (
    <div>
      <div className="mb-5 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <FileSignature className="h-6 w-6 text-brand" />
        </span>
        <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{tr(PAGE_UI.title, language)}</h1>
        <p className="mt-2 text-base leading-relaxed text-gray-600 dark:text-gray-300">
          {fill(tr(PAGE_UI.intro, language), { agent: view.agent.name })}
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{tr(PAGE_UI.readFirst, language)}</p>
      </div>

      <ConfirmationDocument form={form} />

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm [color-scheme:light] sm:p-5">
        <h2 className="mb-3 text-lg font-bold text-gray-900">{tr(PAGE_UI.signatureHeading, language)}</h2>
        <SignatureInput
          language={language}
          allowTyped={view.allowTypedSignature}
          defaultTypedName={view.consumerName}
          disabled={signing}
          onChange={onSignature}
        />

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-gray-200 p-3 text-gray-900 has-[:checked]:border-brand">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setError(null);
            }}
            disabled={signing}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#0077B6]"
          />
          <span className="text-[15px] leading-snug">{form.consent}</span>
        </label>

        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <button type="button" onClick={sign} disabled={!ready} className={`${GRADIENT_BTN} mt-4`}>
          {signing ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSignature className="h-5 w-5" />}
          {tr(signing ? PAGE_UI.signing : PAGE_UI.sign, language)}
        </button>
        <p className="mt-3 text-center text-xs leading-relaxed text-gray-500">{tr(PAGE_UI.recorded, language)}</p>
      </section>

      <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-300">
        {fill(tr(PAGE_UI.questions, language), { agent: view.agent.name })}{" "}
        <a href={telHref(view.agent.phone)} className="inline-flex items-center gap-1 font-semibold text-brand">
          <Phone className="h-3.5 w-3.5" /> {view.agent.phone}
        </a>
      </p>
    </div>
  );
}

function DeadLink({ dead, language }: { dead: DeadOutcome; language: AcaConfirmationLanguage }) {
  const message =
    dead.code === "signed"
      ? dead.signedAtLocal
        ? fill(tr(PAGE_UI.deadSignedOn, language), { date: dead.signedAtLocal })
        : tr(PAGE_UI.deadSigned, language)
      : dead.code === "cancelled"
        ? tr(PAGE_UI.deadCancelled, language)
        : dead.code === "expired"
          ? tr(PAGE_UI.deadExpired, language)
          : tr(PAGE_UI.deadNotFound, language);
  const signed = dead.code === "signed";
  return (
    <Notice
      tone={signed ? "green" : "amber"}
      icon={signed ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
      title={signed ? message : tr(PAGE_UI.deadTitle, language)}
    >
      {!signed && <p className="mt-2 text-base leading-relaxed text-gray-700">{message}</p>}
      {dead.agentName && (
        <p className="mt-4 text-sm text-gray-600">
          {fill(tr(PAGE_UI.deadContact, language), { agent: dead.agentName })}
          {dead.agentPhone && (
            <>
              {" · "}
              <a href={telHref(dead.agentPhone)} className="font-semibold text-brand">
                {dead.agentPhone}
              </a>
            </>
          )}
        </p>
      )}
    </Notice>
  );
}

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: "green" | "amber" | "red";
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  const circle =
    tone === "green" ? "bg-green-100 text-green-700" : tone === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm [color-scheme:light]">
      <span className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${circle}`}>{icon}</span>
      <h1 className="text-xl font-bold leading-snug text-gray-900">{title}</h1>
      {children}
    </div>
  );
}
