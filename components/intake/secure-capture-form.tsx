"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { AlertCircle, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { BIG_INPUT, ChoiceCard, CountedDigitsField, GRADIENT_BTN } from "@/components/intake-ui";
import BankNameHint from "@/components/iul-intake/bank-name-hint";
import { getIntakeConfig } from "@/lib/intake-configs";
import { fieldByKey } from "@/lib/intake-core/fields";
import { captureGroups } from "@/lib/intake-core/secure-capture-groups";
import type { IntakeField, IntakeLobConfig } from "@/lib/intake-core/types";
import { UI, fieldLabel, optionLabel, pickLocale, tr, type IntakeLocale } from "@/lib/intake-core/ui-strings";
import { formatSsn } from "@/lib/intake-shared/format";

/**
 * The page a client opens on their own phone to type the numbers they'd rather not say out loud:
 * an SSN or ITIN, an ID number, bank details — only what the link asks for.
 *
 * The IUL page (`components/iul-intake/secure-capture-form.tsx`) for the shared intake engine:
 * one screen, big inputs, nothing already on file shown back (not even masked), and no progress
 * saving — a half-typed SSN sitting in a database is a liability with no upside. The URL decides
 * the language, since that path is what the client was sent.
 */

type Boot = { lob: string; firstName: string; fieldKeys: string[]; kinds: Record<string, string> };
type Phase = "loading" | "ready" | "saving" | "done" | "dead";

const DIGITS: Record<string, number> = { ssn: 9, routingNumber: 9 };
const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** Which kind of number this field is, from the answer that gates its group ("ITIN", "Passport"). */
function kindLabel(config: IntakeLobConfig, key: string, kinds: Record<string, string>, locale: IntakeLocale): string {
  const group = captureGroups(config).find((g) => g.fieldKeys.includes(key) && g.requires);
  const requires = group?.requires ? fieldByKey(config.sections, group.requires) : undefined;
  const option = requires?.options?.find((o) => o.value === kinds[group?.requires ?? ""]);
  return option ? optionLabel(option, locale) : "";
}

function isComplete(field: IntakeField, value: string): boolean {
  if (DIGITS[field.key]) return onlyDigits(value).length === DIGITS[field.key];
  if (field.key === "accountNumber") return onlyDigits(value).length >= 4;
  if (field.type === "select") return Boolean(value);
  return value.trim().length >= 3;
}

export default function IntakeSecureCaptureForm({ captureToken }: { captureToken: string }) {
  const locale = pickLocale(useLocale());
  const [phase, setPhase] = useState<Phase>("loading");
  const [boot, setBoot] = useState<Boot | null>(null);
  const [deadMessage, setDeadMessage] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const endpoint = `/api/intake-capture/${captureToken}`;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(endpoint, { credentials: "same-origin" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok || !json?.success || !getIntakeConfig(json.lob)) {
          setDeadMessage(json?.error ?? "This link is not available.");
          setPhase("dead");
          return;
        }
        setBoot({ lob: json.lob, firstName: json.firstName ?? "", fieldKeys: json.fieldKeys ?? [], kinds: json.kinds ?? {} });
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
  }, [endpoint]);

  const config = boot ? getIntakeConfig(boot.lob) : undefined;
  const fields = (boot?.fieldKeys ?? [])
    .map((key) => (config ? fieldByKey(config.sections, key) : undefined))
    .filter((f): f is IntakeField => Boolean(f));
  const complete = fields.length > 0 && fields.every((f) => isComplete(f, values[f.key] ?? ""));
  const set = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setPhase("saving");
    setFormError(null);
    setErrors({});
    const data: Record<string, string> = {};
    for (const f of fields) {
      const v = values[f.key] ?? "";
      data[f.key] = DIGITS[f.key] || f.key === "accountNumber" ? onlyDigits(v) : v.trim();
    }
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        if (json?.errors) setErrors(json.errors);
        setFormError(json?.code ? json.error : tr(UI.secureSubmitError, locale));
        setPhase(json?.code ? "dead" : "ready");
        if (json?.code) setDeadMessage(json.error);
        return;
      }
      setPhase("done");
    } catch {
      setFormError(tr(UI.secureSubmitError, locale));
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

  if (phase === "dead" || phase === "done") {
    const done = phase === "done";
    return (
      <div className="mx-auto w-full max-w-md px-5 py-16 text-center">
        <span
          className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
            done ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"
          }`}
        >
          {done ? (
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          )}
        </span>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {done ? tr(UI.secureDoneTitle, locale) : deadMessage}
        </h1>
        {done && <p className="mt-3 text-base leading-relaxed text-muted-foreground">{tr(UI.secureDoneBody, locale)}</p>}
      </div>
    );
  }

  const saving = phase === "saving";
  const digitLabels = { looksGood: tr(UI.secureLooksGood, locale), remaining: tr(UI.secureDigitsLeft, locale) };

  return (
    <div className="mx-auto w-full max-w-md px-5 pb-24 pt-8">
      <div className="mb-6 text-center">
        {config?.brandLogo ? (
          <Image
            src={config.brandLogo.src}
            alt={config.brandLogo.alt}
            width={config.brandLogo.width}
            height={config.brandLogo.height}
            priority
            className="mx-auto mb-4 h-9 w-auto rounded-md dark:bg-white dark:p-1"
          />
        ) : (
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <Lock className="h-6 w-6 text-brand" />
          </span>
        )}
        <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">
          {boot?.firstName ? tr(UI.secureTitleNamed, locale).replace("{name}", boot.firstName) : tr(UI.secureTitle, locale)}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">{tr(UI.secureIntro, locale)}</p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-500">
          <ShieldCheck className="h-4 w-4" /> {tr(UI.secureLinkNote, locale)}
        </p>
      </div>

      <div className="space-y-6">
        {fields.map((field) => {
          const id = `cap-${field.key}`;
          const value = values[field.key] ?? "";
          const kind = config && boot ? kindLabel(config, field.key, boot.kinds, locale) : "";
          const invalid = Boolean(errors[field.key]);
          return (
            <div key={field.key}>
              <label htmlFor={id} className="mb-1.5 block text-base font-semibold">
                {fieldLabel(field, locale)}
                {kind && (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 align-middle text-xs font-semibold text-brand">
                    {kind}
                  </span>
                )}
              </label>
              {DIGITS[field.key] ? (
                <CountedDigitsField
                  id={id}
                  value={value}
                  onChange={(v) => set(field.key, v)}
                  format={field.key === "ssn" ? formatSsn : (raw) => onlyDigits(raw).slice(0, 9)}
                  digitsNeeded={DIGITS[field.key]}
                  labels={digitLabels}
                  placeholder={field.key === "ssn" ? "123-45-6789" : "021000021"}
                  autoComplete="off"
                  disabled={saving}
                  invalid={invalid}
                />
              ) : field.type === "select" ? (
                <div role="radiogroup" className="grid grid-cols-2 gap-2.5">
                  {(field.options ?? []).map((option) => (
                    <ChoiceCard
                      key={option.value}
                      selected={value === option.value}
                      label={optionLabel(option, locale)}
                      onClick={() => set(field.key, option.value)}
                      disabled={saving}
                    />
                  ))}
                </div>
              ) : (
                <input
                  id={id}
                  type="text"
                  inputMode={field.key === "accountNumber" ? "numeric" : "text"}
                  autoComplete="off"
                  autoCapitalize={field.key === "accountNumber" ? "off" : "characters"}
                  disabled={saving}
                  value={value}
                  maxLength={field.maxLength ?? 25}
                  onChange={(e) =>
                    set(
                      field.key,
                      field.key === "accountNumber" ? onlyDigits(e.target.value).slice(0, 17) : e.target.value.toUpperCase()
                    )
                  }
                  className={`${BIG_INPUT} ${invalid ? "border-amber-400" : ""}`}
                />
              )}
              {field.key === "routingNumber" && (
                <>
                  <BankNameHint routingNumber={value} endpoint={`${endpoint}/bank-name`} label={tr(UI.secureBankName, locale)} />
                  <p className="mt-1 text-sm text-muted-foreground">{tr(UI.secureRoutingHelp, locale)}</p>
                </>
              )}
            </div>
          );
        })}

        {formError && (
          <p className="flex items-start gap-2 text-sm font-medium text-amber-700 dark:text-amber-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError}
          </p>
        )}

        <button type="button" onClick={submit} disabled={!complete || saving} className={`${GRADIENT_BTN} disabled:cursor-not-allowed`}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(UI.secureSending, locale)}
            </>
          ) : (
            tr(UI.secureSend, locale)
          )}
        </button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">{tr(UI.secureFooter, locale)}</p>
      </div>
    </div>
  );
}
