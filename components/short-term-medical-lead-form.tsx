"use client";

import { useActionState, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  submitShortTermMedicalForm,
  type ActionResult,
  type FormValues,
} from "@/app/actions/short-term-medical";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { Link } from "@/i18n/navigation";

const initialFormValues: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const initialState: ActionResult = { status: null };

type Props = {
  onSubmitSuccess?: () => void;
  onCloseModal?: () => void;
};

export default function ShortTermMedicalLeadForm({
  onSubmitSuccess,
  onCloseModal,
}: Props) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("guideDetailPage.form");
  const [state, formAction, isPending] = useActionState(
    submitShortTermMedicalForm,
    initialState
  );

  const [formValues, setFormValues] = useState<FormValues>(initialFormValues);
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  useEffect(() => {
    if (
      (state.status === "VALIDATION_ERROR" || state.status === "ERROR") &&
      state.values
    ) {
      setFormValues(state.values);
    }
  }, [state.status, state.values]);

  useEffect(() => {
    if (state.status === "SUCCESS") {
      onSubmitSuccess?.();
    }
  }, [state.status, onSubmitSuccess]);

  const inputBase =
    "w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] transition-all duration-200";

  const inputError = "border-red-500 dark:border-red-600";

  if (state.status === "SUCCESS") {
    return (
      <div className="py-4 text-center">
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 border-2 border-green-200 dark:border-green-800 p-6 shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-green-500/20 dark:bg-green-500/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600 dark:text-green-400"
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
          <p className="text-lg font-semibold text-green-800 dark:text-green-200">
            {isES
              ? "¡Gracias! Hemos recibido su información."
              : "Thank you! We've received your information."}
          </p>
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            {isES
              ? "Me comunicaré con usted pronto para discutir sus opciones."
              : "I'll reach out shortly to discuss your options."}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            {onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="px-5 py-2.5 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
              >
                {t("successClose")}
              </button>
            )}
            <Link
              href={
                (formValues.firstName || formValues.lastName || formValues.email || formValues.phone
                  ? `/short-term-medical/calendar?${new URLSearchParams({
                      first_name: formValues.firstName,
                      last_name: formValues.lastName,
                      email: formValues.email,
                      phone: formValues.phone,
                    }).toString()}`
                  : "/short-term-medical/calendar") as "/short-term-medical/calendar"
              }
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] text-white font-medium hover:from-[hsl(var(--custom)/0.9)] hover:to-[hsl(var(--custom)/0.75)] transition-all shadow-md hover:shadow-lg"
            >
              {t("successScheduleAppointment")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      id="stm-lead-form"
      action={formAction}
      className="space-y-4"
    >
      <input type="hidden" name="locale" value={locale} />

      {state.status === "ERROR" && state.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        </div>
      )}

      <div>
        <label
          htmlFor="stm-firstName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("firstName")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="stm-firstName"
          name="firstName"
          placeholder={isES ? "Ej: María" : "e.g. Maria"}
          value={formValues.firstName}
          onChange={(e) =>
            setFormValues((v) => ({ ...v, firstName: e.target.value }))
          }
          className={`${inputBase} ${state.errors?.firstName ? inputError : ""}`}
          disabled={isPending}
          autoComplete="given-name"
        />
        {state.errors?.firstName && (
          <p className="text-red-500 text-xs mt-1">{state.errors.firstName}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="stm-lastName"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("lastName")} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="stm-lastName"
          name="lastName"
          placeholder={isES ? "Ej: García" : "e.g. Garcia"}
          value={formValues.lastName}
          onChange={(e) =>
            setFormValues((v) => ({ ...v, lastName: e.target.value }))
          }
          className={`${inputBase} ${state.errors?.lastName ? inputError : ""}`}
          disabled={isPending}
          autoComplete="family-name"
        />
        {state.errors?.lastName && (
          <p className="text-red-500 text-xs mt-1">{state.errors.lastName}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="stm-email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("email")} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="stm-email"
          name="email"
          placeholder={isES ? "tu@email.com" : "you@email.com"}
          value={formValues.email}
          onChange={(e) =>
            setFormValues((v) => ({ ...v, email: e.target.value }))
          }
          className={`${inputBase} ${state.errors?.email ? inputError : ""}`}
          disabled={isPending}
          autoComplete="email"
        />
        {state.errors?.email && (
          <p className="text-red-500 text-xs mt-1">{state.errors.email}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="stm-phone"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("phone")} <span className="text-red-500">*</span>
        </label>
        <PhoneInput
          id="stm-phone"
          name="phone"
          defaultCountry="US"
          countries={["US"]}
          addInternationalOption={false}
          placeholder={isES ? "(555) 123-4567" : "(555) 123-4567"}
          value={formValues.phone || undefined}
          onChange={(value) =>
            setFormValues((v) => ({ ...v, phone: value || "" }))
          }
          className={`${inputBase} ${state.errors?.phone ? inputError : ""}`}
          disabled={isPending}
          autoComplete="tel"
          limitMaxLength
        />
        {state.errors?.phone && (
          <p className="text-red-500 text-xs mt-1">{state.errors.phone}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] hover:from-[hsl(var(--custom)/0.9)] hover:to-[hsl(var(--custom)/0.75)] text-white font-semibold py-3.5 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
      >
        {isPending
          ? t("submitting", { default: "Submitting..." })
          : isES
            ? "Enviar — Recibir mi cotización"
            : "Get My Free Quote"}
      </button>

      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            name="smsConsent"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isPending}
            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] shrink-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
            {t("smsConsent")}
          </span>
        </label>
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            name="marketingConsent"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={isPending}
            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] shrink-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
            {t("marketingConsent")}
          </span>
        </label>
      </div>

      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 pt-2">
        <Link
          href="/privacy-policy"
          className="underline hover:text-[hsl(var(--custom))] transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("privacyPolicy")}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/terms-of-service"
          className="underline hover:text-[hsl(var(--custom))] transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("termsAndConditions")}
        </Link>
      </div>
    </form>
  );
}
