"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

interface LeadMagnetFormProps {
  slug: string;
  category: string;
  leadFormSettings: {
    ctaButtonText: string;
    successMessage: string;
  };
}

export function LeadMagnetForm({ slug, leadFormSettings }: LeadMagnetFormProps) {
  const locale = useLocale();
  const isES = locale.startsWith("es");

  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const contactPhone = process.env.NEXT_PUBLIC_PHONE_NUMBER ?? "";

  const inputBase =
    "w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] transition-all duration-200";
  const inputError = "border-red-500 dark:border-red-600";

  function validate() {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = isES ? "Requerido" : "Required";
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = isES ? "Mínimo 2 caracteres" : "At least 2 characters";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = isES ? "Requerido" : "Required";
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = isES ? "Mínimo 2 caracteres" : "At least 2 characters";
    }

    if (!formData.email.trim()) {
      newErrors.email = isES ? "Requerido" : "Required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = isES ? "Correo inválido" : "Invalid email address";
    }

    const e164 = toE164OrUndefined(formData.phone);
    if (!formData.phone.trim()) {
      newErrors.phone = isES ? "Requerido" : "Required";
    } else if (!e164) {
      newErrors.phone = isES ? "Teléfono inválido" : "Invalid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/lead-magnets/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone,
          smsConsent,
          marketingConsent,
          slug,
          locale,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setSubmitError(data.error ?? (isES ? "Algo salió mal. Intenta de nuevo." : "Something went wrong. Please try again."));
        return;
      }

      setPdfUrl(data.data.pdfUrl);
      setSuccess(true);
      window.open(data.data.pdfUrl, "_blank");
    } catch {
      setSubmitError(isES ? "Algo salió mal. Intenta de nuevo." : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success && pdfUrl) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{leadFormSettings.successMessage}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isES ? "Si la descarga no abrió automáticamente," : "If the download didn't open automatically,"}{" "}
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[hsl(var(--custom))] hover:underline font-medium"
          >
            {isES ? "haz clic aquí" : "click here"}
          </a>
          .
        </p>
        {contactPhone && (
          <p className="text-sm text-gray-600 dark:text-gray-400 pt-2">
            {isES ? "¿Quieres una consulta gratis?" : "Want a free consultation?"}{" "}
            <a href={`tel:${contactPhone}`} className="text-[hsl(var(--custom))] hover:underline font-medium">
              {isES ? "Llámanos ahora" : "Call us now"}
            </a>
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lm-firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {isES ? "Nombre" : "First name"} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lm-firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className={`${inputBase} ${errors.firstName ? inputError : ""}`}
            disabled={isLoading}
            autoComplete="given-name"
            placeholder={isES ? "Ej: María" : "e.g. Maria"}
          />
          {errors.firstName && <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label htmlFor="lm-lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {isES ? "Apellido" : "Last name"} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lm-lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className={`${inputBase} ${errors.lastName ? inputError : ""}`}
            disabled={isLoading}
            autoComplete="family-name"
            placeholder={isES ? "Ej: García" : "e.g. Garcia"}
          />
          {errors.lastName && <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="lm-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {isES ? "Correo electrónico" : "Email address"} <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="lm-email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={`${inputBase} ${errors.email ? inputError : ""}`}
          disabled={isLoading}
          autoComplete="email"
          placeholder={isES ? "tu@email.com" : "you@email.com"}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="lm-phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {isES ? "Teléfono" : "Phone number"} <span className="text-red-500">*</span>
        </label>
        <PhoneInput
          id="lm-phone"
          defaultCountry="US"
          countries={["US"]}
          addInternationalOption={false}
          placeholder="(555) 123-4567"
          value={toE164OrUndefined(formData.phone)}
          onChange={(value) => setFormData((prev) => ({ ...prev, phone: value || "" }))}
          className={`${inputBase} ${errors.phone ? inputError : ""}`}
          disabled={isLoading}
          autoComplete="tel"
          limitMaxLength
        />
        {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
      </div>

      {submitError && <p className="text-sm text-red-600 dark:text-red-400">{submitError}</p>}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-[hsl(var(--custom))] to-[hsl(var(--custom)/0.85)] hover:from-[hsl(var(--custom)/0.9)] hover:to-[hsl(var(--custom)/0.75)] text-white font-semibold py-3.5 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {isES ? "Procesando…" : "Processing…"}
          </span>
        ) : (
          leadFormSettings.ctaButtonText
        )}
      </button>

      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] shrink-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
            {isES
              ? "Acepto recibir mensajes de texto (SMS) relacionados con mi guía e información de seguros. Pueden aplicar tarifas de mensajes y datos."
              : "I agree to receive text messages (SMS) about my guide and insurance information. Message and data rates may apply."}
          </span>
        </label>
        <label className="flex gap-3 items-start cursor-pointer group">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] shrink-0"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors">
            {isES
              ? "Acepto recibir correos electrónicos y comunicaciones de marketing de Isaac Plans Insurance. Puedo cancelar en cualquier momento."
              : "I agree to receive marketing emails and communications from Isaac Plans Insurance. I can unsubscribe at any time."}
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
          {isES ? "Política de Privacidad" : "Privacy Policy"}
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/terms-of-service"
          className="underline hover:text-[hsl(var(--custom))] transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {isES ? "Términos y Condiciones" : "Terms & Conditions"}
        </Link>
      </div>
    </form>
  );
}
