"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Link } from "@/i18n/navigation";
import {
  submitAgentCrmLead,
  type ActionResult,
  type FormValues,
} from "@/app/actions/agent-crm-affiliate";
import AgentCrmCta from "@/components/agent-crm/agent-crm-cta";

/** PhoneInput expects E.164; the server may hand back a formatted value like "(544) 841-5655". */
function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

const initialFormValues: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  message: "",
};

const initialState: ActionResult = { status: null };

/**
 * The soft CTA on /agent-crm — for the agent who read the whole page and still isn't buying
 * software today.
 *
 * Built on the same shape as every other lead form on the site (`health-alternative-lead-form`,
 * `contact-lead-form`, …): `useActionState`, a US-only `PhoneInput` that normalises to E.164, the
 * SMS and marketing consent checkboxes that keep the CRM's opt-in record straight, and the
 * privacy/terms links. One extra field the others don't have — a free-text question — because
 * that is the whole reason an agent uses this instead of just clicking the button.
 *
 * Kept visually quieter than the affiliate CTA on purpose: if this outcompetes the button for
 * attention the page has failed at its actual job, so it sits below the FAQ and the success state
 * still points at the trial.
 */
export default function AgentCrmLeadForm() {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("agentCrm.form");
  const [state, formAction, isPending] = useActionState(submitAgentCrmLead, initialState);

  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if ((state.status === "VALIDATION_ERROR" || state.status === "ERROR") && state.values) {
      setFormValues(state.values);
    }
  }, [state.status, state.values]);

  const inputBase =
    "w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] transition-all duration-200";
  const inputError = "border-red-500 dark:border-red-600";
  const labelBase = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  if (state.status === "SUCCESS") {
    return (
      <div className="py-4 text-center">
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6 shadow-sm dark:border-emerald-800 dark:from-emerald-900/30 dark:to-green-900/20">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 dark:bg-emerald-500/30">
            <svg
              className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
            {t("successTitle")}
          </p>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
            {t("successMessage")}
          </p>
          {/* Answering their question is the promise; starting the trial is still the point. */}
          <p className="mt-5 text-sm text-emerald-800 dark:text-emerald-200">
            {t("successTrialNudge")}
          </p>
          <div className="mt-4 flex justify-center">
            <AgentCrmCta label={t("successCta")} placement="form_success" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <form id="agent-crm-lead-form" action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      {state.status === "ERROR" && state.error && (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="agent-crm-firstName" className={labelBase}>
            {t("firstName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="agent-crm-firstName"
            name="firstName"
            placeholder={isES ? "Ej: María" : "e.g. Maria"}
            value={formValues.firstName}
            onChange={(e) => setFormValues((v) => ({ ...v, firstName: e.target.value }))}
            className={`${inputBase} ${state.errors?.firstName ? inputError : ""}`}
            disabled={isPending}
            autoComplete="given-name"
          />
          {state.errors?.firstName && (
            <p className="mt-1 text-xs text-red-500">{state.errors.firstName}</p>
          )}
        </div>

        <div>
          <label htmlFor="agent-crm-lastName" className={labelBase}>
            {t("lastName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="agent-crm-lastName"
            name="lastName"
            placeholder={isES ? "Ej: García" : "e.g. Garcia"}
            value={formValues.lastName}
            onChange={(e) => setFormValues((v) => ({ ...v, lastName: e.target.value }))}
            className={`${inputBase} ${state.errors?.lastName ? inputError : ""}`}
            disabled={isPending}
            autoComplete="family-name"
          />
          {state.errors?.lastName && (
            <p className="mt-1 text-xs text-red-500">{state.errors.lastName}</p>
          )}
        </div>

        <div>
          <label htmlFor="agent-crm-email" className={labelBase}>
            {t("email")} <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="agent-crm-email"
            name="email"
            placeholder={isES ? "tu@email.com" : "you@email.com"}
            value={formValues.email}
            onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))}
            className={`${inputBase} ${state.errors?.email ? inputError : ""}`}
            disabled={isPending}
            autoComplete="email"
          />
          {state.errors?.email && (
            <p className="mt-1 text-xs text-red-500">{state.errors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="agent-crm-phone" className={labelBase}>
            {t("phone")} <span className="text-red-500">*</span>
          </label>
          <PhoneInput
            id="agent-crm-phone"
            name="phone"
            defaultCountry="US"
            countries={["US"]}
            addInternationalOption={false}
            placeholder="(555) 123-4567"
            value={toE164OrUndefined(formValues.phone)}
            onChange={(value) => setFormValues((v) => ({ ...v, phone: value || "" }))}
            className={`${inputBase} ${state.errors?.phone ? inputError : ""}`}
            disabled={isPending}
            autoComplete="tel"
            limitMaxLength
          />
          {state.errors?.phone && (
            <p className="mt-1 text-xs text-red-500">{state.errors.phone}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="agent-crm-message" className={labelBase}>
          {t("message")}{" "}
          <span className="font-normal text-gray-400 dark:text-gray-500">
            ({t("messageOptional")})
          </span>
        </label>
        <textarea
          id="agent-crm-message"
          name="message"
          rows={3}
          maxLength={1000}
          placeholder={t("messagePlaceholder")}
          value={formValues.message}
          onChange={(e) => setFormValues((v) => ({ ...v, message: e.target.value }))}
          className={`${inputBase} resize-y`}
          disabled={isPending}
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] px-6 py-3.5 font-semibold text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>

      <div className="space-y-3 border-t border-gray-200 pt-2 dark:border-gray-700">
        <label className="group flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="smsConsent"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isPending}
            className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] dark:border-gray-600"
          />
          <span className="text-xs text-gray-600 transition-colors group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">
            {t("smsConsent")}
          </span>
        </label>
        <label className="group flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={isPending}
            className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] dark:border-gray-600"
          />
          <span className="text-xs text-gray-600 transition-colors group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">
            {t("marketingConsent")}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 text-xs text-gray-500 dark:text-gray-400">
        <Link
          href="/privacy-policy"
          className="underline transition-colors hover:text-[hsl(var(--custom))]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("privacyPolicy")}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/terms-of-service"
          className="underline transition-colors hover:text-[hsl(var(--custom))]"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("termsAndConditions")}
        </Link>
      </div>
    </form>
  );
}
