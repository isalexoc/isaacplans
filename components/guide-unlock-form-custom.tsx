"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import type { Guide } from "@/components/guide-card";
import type { GuideLeadFormValues } from "@/lib/consumer-guide-crm";

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

export type GuideUnlockSubmitPayload = GuideLeadFormValues & {
  category: Guide["category"];
  guideName: string;
  guideId: string;
};

type Props = {
  category: Guide["category"];
  guideName: string;
  guideId: string;
  isSubmitting?: boolean;
  onSubmit: (data: GuideUnlockSubmitPayload) => Promise<void>;
};

export default function GuideUnlockFormCustom({
  category,
  guideName,
  guideId,
  isSubmitting = false,
  onSubmit,
}: Props) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("guideDetailPage.form");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inputBase =
    "w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] transition-all duration-200";

  const inputError = "border-red-500 dark:border-red-600";

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = t("required");
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = t("firstNameMinLength");
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t("required");
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = t("lastNameMinLength");
    }

    if (!formData.email.trim()) {
      newErrors.email = t("required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t("invalidEmail");
    }

    const e164 = toE164OrUndefined(formData.phone);
    if (!formData.phone.trim()) {
      newErrors.phone = t("required");
    } else if (!e164) {
      newErrors.phone = t("invalidPhone");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSubmit({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone,
      smsConsent,
      marketingConsent,
      category,
      guideName,
      guideId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label
            htmlFor="guide-firstName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {t("firstName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="guide-firstName"
            value={formData.firstName}
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            className={`${inputBase} ${errors.firstName ? inputError : ""}`}
            disabled={isSubmitting}
            autoComplete="given-name"
            placeholder={isES ? "Ej: María" : "e.g. Maria"}
          />
          {errors.firstName && (
            <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
          )}
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor="guide-lastName"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
          >
            {t("lastName")} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="guide-lastName"
            value={formData.lastName}
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            className={`${inputBase} ${errors.lastName ? inputError : ""}`}
            disabled={isSubmitting}
            autoComplete="family-name"
            placeholder={isES ? "Ej: García" : "e.g. Garcia"}
          />
          {errors.lastName && (
            <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div>
        <label
          htmlFor="guide-email"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("email")} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="guide-email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          className={`${inputBase} ${errors.email ? inputError : ""}`}
          disabled={isSubmitting}
          autoComplete="email"
          placeholder={isES ? "tu@email.com" : "you@email.com"}
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="guide-phone"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {t("phone")} <span className="text-red-500">*</span>
        </label>
        <PhoneInput
          id="guide-phone"
          defaultCountry="US"
          countries={["US"]}
          addInternationalOption={false}
          placeholder={isES ? "(555) 123-4567" : "(555) 123-4567"}
          value={toE164OrUndefined(formData.phone)}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, phone: value || "" }))
          }
          className={`${inputBase} ${errors.phone ? inputError : ""}`}
          disabled={isSubmitting}
          autoComplete="tel"
          limitMaxLength
        />
        {errors.phone && (
          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] hover:from-[hsl(var(--custom)/0.9)] hover:to-[hsl(var(--custom)/0.75)] text-white font-semibold py-3.5 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? t("submitting") : t("submit")}
      </button>

      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isSubmitting}
            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] shrink-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
            {t("smsConsent")}
          </span>
        </label>
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={isSubmitting}
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
