"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import {
  BIG_INPUT,
  GRADIENT_BTN,
  ChoiceCard,
  CountedDigitsField,
} from "@/components/intake-ui";
import { formatSsn } from "@/lib/intake-shared/format";
import BankNameHint from "@/components/iul-intake/bank-name-hint";
import { UI, tr, pickLocale, type IntakeLocale } from "@/lib/iul-intake/ui-strings";

/**
 * The page a client opens on their own phone to type their SSN and bank details.
 *
 * Unlike the intake form — a ten-step stepper — this is four fields on one screen, so it uses the
 * Final Expense one-thing-at-a-time geometry (`BIG_INPUT`, 18px values). Somebody is doing this
 * standing up, on a phone, while an agent waits on the line.
 *
 * Two deliberate omissions:
 *
 *  - It never shows what is already on file, not even masked. A "we have •••6789" confirmation
 *    would be reassuring and would turn a leaked link into a read oracle for the last four digits.
 *  - There is no progress saving. Four fields submitted once; a half-typed SSN sitting in a
 *    database is a liability with no upside.
 */

type Boot = { firstName: string };
type Phase = "loading" | "ready" | "saving" | "done" | "dead";

export default function SecureCaptureForm({ captureToken }: { captureToken: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [boot, setBoot] = useState<Boot | null>(null);
  const [deadMessage, setDeadMessage] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [ssn, setSsn] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [accountType, setAccountType] = useState("");

  /**
   * The URL decides the language, not the stored session.
   *
   * This page is reached at /en/iul/secure/… or /es/iul/seguro/…, and that path IS the promise
   * made to whoever was sent the link. Reading the language off the session row instead meant a
   * Spanish link rendered in English whenever the session was created before the client's
   * language was known — which is most of the time, since the session is started first.
   */
  const locale: IntakeLocale = pickLocale(useLocale());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/iul-intake/secure-capture/${captureToken}`, {
          credentials: "same-origin",
        });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !json?.success) {
          setDeadMessage(json?.error ?? "This link is not available.");
          setPhase("dead");
          return;
        }
        setBoot({ firstName: json.firstName ?? "" });
        setPhase("ready");
      } catch {
        if (active) {
          setDeadMessage("Could not open this link. Please check your connection.");
          setPhase("dead");
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [captureToken]);

  const digitLabels = {
    looksGood: tr(UI.looksGood, locale),
    remaining: tr(UI.digitsRemaining, locale),
  };

  const complete =
    ssn.replace(/\D/g, "").length === 9 &&
    routing.replace(/\D/g, "").length === 9 &&
    account.replace(/\D/g, "").length >= 4 &&
    Boolean(accountType);

  async function submit() {
    setPhase("saving");
    setFormError(null);
    setErrors({});
    try {
      const res = await fetch(`/api/iul-intake/secure-capture/${captureToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          data: {
            ssn: ssn.replace(/\D/g, ""),
            routingNumber: routing.replace(/\D/g, ""),
            accountNumber: account.replace(/\D/g, ""),
            accountType,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        if (json?.errors) setErrors(json.errors);
        setFormError(json?.error ?? tr(UI.captureSubmitError, locale));
        setPhase("ready");
        return;
      }
      setPhase("done");
    } catch {
      setFormError(tr(UI.captureSubmitError, locale));
      setPhase("ready");
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }

  if (phase === "dead") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </span>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{deadMessage}</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {tr(UI.captureDoneTitle, locale)}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {tr(UI.captureDoneBody, locale)}
        </p>
      </div>
    );
  }

  const saving = phase === "saving";

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-24 pt-8">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <Lock className="h-6 w-6 text-brand" />
        </span>
        <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">
          {boot?.firstName
            ? tr(UI.captureTitleNamed, locale).replace("{name}", boot.firstName)
            : tr(UI.captureTitle, locale)}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {tr(UI.captureIntro, locale)}
        </p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-500">
          <ShieldCheck className="h-4 w-4" /> {tr(UI.captureSecureNote, locale)}
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label htmlFor="cap-ssn" className="mb-1.5 block text-base font-semibold">
            {tr(UI.captureSsnLabel, locale)}
          </label>
          <CountedDigitsField
            id="cap-ssn"
            value={ssn}
            onChange={setSsn}
            format={formatSsn}
            digitsNeeded={9}
            labels={digitLabels}
            placeholder="123-45-6789"
            autoComplete="off"
            disabled={saving}
            invalid={Boolean(errors.ssn)}
          />
        </div>

        <div>
          <label htmlFor="cap-routing" className="mb-1.5 block text-base font-semibold">
            {tr(UI.captureRoutingLabel, locale)}
          </label>
          <CountedDigitsField
            id="cap-routing"
            value={routing}
            onChange={setRouting}
            format={(raw) => raw.replace(/\D/g, "").slice(0, 9)}
            digitsNeeded={9}
            labels={digitLabels}
            placeholder="021000021"
            autoComplete="off"
            disabled={saving}
            invalid={Boolean(errors.routingNumber)}
          />
          <BankNameHint
            routingNumber={routing}
            endpoint={`/api/iul-intake/secure-capture/${captureToken}/bank-name`}
            label={tr(UI.bankNameHint, locale)}
          />
          <p className="mt-1 text-sm text-muted-foreground">{tr(UI.captureRoutingHelp, locale)}</p>
        </div>

        <div>
          <label htmlFor="cap-account" className="mb-1.5 block text-base font-semibold">
            {tr(UI.captureAccountLabel, locale)}
          </label>
          <input
            id="cap-account"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            disabled={saving}
            value={account}
            onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 17))}
            className={`${BIG_INPUT} ${errors.accountNumber ? "border-amber-400" : ""}`}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-base font-semibold">
            {tr(UI.captureAccountTypeLabel, locale)}
          </span>
          <div role="radiogroup" className="grid grid-cols-2 gap-2.5">
            <ChoiceCard
              selected={accountType === "Checking"}
              label={locale === "es" ? "Corriente" : "Checking"}
              onClick={() => setAccountType("Checking")}
              disabled={saving}
            />
            <ChoiceCard
              selected={accountType === "Savings"}
              label={locale === "es" ? "Ahorros" : "Savings"}
              onClick={() => setAccountType("Savings")}
              disabled={saving}
            />
          </div>
        </div>

        {formError && (
          <p className="flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!complete || saving}
          className={`${GRADIENT_BTN} disabled:cursor-not-allowed`}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(UI.captureSending, locale)}
            </>
          ) : (
            tr(UI.captureSend, locale)
          )}
        </button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {tr(UI.captureFooter, locale)}
        </p>
      </div>
    </div>
  );
}
