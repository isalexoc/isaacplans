"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Send } from "lucide-react";
import {
  submitAgentCrmLead,
  type AgentCrmLeadResult,
  type AgentCrmLeadValues,
} from "@/app/actions/agent-crm-affiliate";

const EMPTY: AgentCrmLeadValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  message: "",
};

const INITIAL_STATE: AgentCrmLeadResult = { status: null };

/**
 * The soft CTA on /agent-crm — for the agent who read the whole page and still isn't buying
 * software today.
 *
 * Kept visually quieter than the affiliate button on purpose. If this form outcompetes the button
 * for attention the page has failed at its actual job, so it lives below the FAQ, uses the outline
 * treatment, and asks a question rather than making a pitch.
 */
export default function AgentCrmLeadForm() {
  const locale = useLocale();
  const t = useTranslations("agentCrm.form");
  const [state, formAction, isPending] = useActionState(submitAgentCrmLead, INITIAL_STATE);
  const [values, setValues] = useState<AgentCrmLeadValues>(EMPTY);

  useEffect(() => {
    if ((state.status === "VALIDATION_ERROR" || state.status === "ERROR") && state.values) {
      setValues(state.values);
    }
  }, [state]);

  const errors = state.status === "VALIDATION_ERROR" ? state.errors : {};

  if (state.status === "SUCCESS") {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
          <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </span>
        <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
          {t("successTitle")}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
          {t("successBody")}
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 transition-colors focus:border-custom focus:outline-none focus:ring-2 focus:ring-custom/20 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder:text-slate-500";
  const fieldError = "border-red-500 dark:border-red-600";
  const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200";
  const errorClass = "mt-1 text-xs font-medium text-red-600 dark:text-red-400";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="acrm-first" className={labelClass}>
            {t("firstName")}
          </label>
          <input
            id="acrm-first"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            defaultValue={values.firstName}
            aria-invalid={Boolean(errors.firstName)}
            className={`${field} ${errors.firstName ? fieldError : ""}`}
          />
          {errors.firstName && <p className={errorClass}>{errors.firstName}</p>}
        </div>

        <div>
          <label htmlFor="acrm-last" className={labelClass}>
            {t("lastName")}
          </label>
          <input
            id="acrm-last"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            defaultValue={values.lastName}
            aria-invalid={Boolean(errors.lastName)}
            className={`${field} ${errors.lastName ? fieldError : ""}`}
          />
          {errors.lastName && <p className={errorClass}>{errors.lastName}</p>}
        </div>

        <div>
          <label htmlFor="acrm-email" className={labelClass}>
            {t("email")}
          </label>
          <input
            id="acrm-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values.email}
            aria-invalid={Boolean(errors.email)}
            className={`${field} ${errors.email ? fieldError : ""}`}
          />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="acrm-phone" className={labelClass}>
            {t("phone")}
          </label>
          <input
            id="acrm-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            defaultValue={values.phone}
            aria-invalid={Boolean(errors.phone)}
            className={`${field} ${errors.phone ? fieldError : ""}`}
          />
          {errors.phone && <p className={errorClass}>{errors.phone}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="acrm-message" className={labelClass}>
          {t("message")}{" "}
          <span className="font-normal text-slate-400 dark:text-slate-500">
            ({t("messageOptional")})
          </span>
        </label>
        <textarea
          id="acrm-message"
          name="message"
          rows={3}
          maxLength={1000}
          defaultValue={values.message}
          placeholder={t("messagePlaceholder")}
          className={`${field} resize-y`}
        />
      </div>

      {state.status === "ERROR" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300"
        >
          {state.error || t("error")}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-custom bg-transparent px-6 py-3.5 text-base font-bold text-custom transition-colors hover:bg-custom hover:text-custom-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <Send className="h-4 w-4" />
        {isPending ? t("submitting") : t("submit")}
      </button>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{t("consent")}</p>
    </form>
  );
}
