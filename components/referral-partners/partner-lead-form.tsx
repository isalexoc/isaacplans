"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { CheckCircle2, ExternalLink, Loader2, MessageCircle, Phone, Zap } from "lucide-react";
import { PIVOT_SELF_ENROLL_URL } from "@/lib/pivot-direct-quote";
import { shortTermMedicalFormSchema } from "@/lib/validation/shortTermMedicalSchema";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";

/** Same CRM line the rest of the site uses. */
const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";
const WHATSAPP_CHAT_HREF = "https://wa.me/15406813507";

/** Lead value reported to Meta — matches the other health-alternative funnels. */
const PARTNER_LEAD_VALUE = 100;

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const EMPTY: FormValues = { firstName: "", lastName: "", email: "", phone: "" };

type Props = {
  partnerSlug: string;
  /** Hex from the partner record — tints the submit button so the form feels co-branded. */
  accentColor: string;
};

export default function PartnerLeadForm({ partnerSlug, accentColor }: Props) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("partnerReferral.form");

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);

  const messageForIssue = (key: string): string => {
    switch (key) {
      case "invalidEmail":
        return t("invalidEmail");
      case "invalidPhone":
        return t("invalidPhone");
      case "firstNameMinLength":
        return t("firstNameMinLength");
      case "lastNameMinLength":
        return t("lastNameMinLength");
      case "firstNameMaxLength":
        return t("firstNameMaxLength");
      case "lastNameMaxLength":
        return t("lastNameMaxLength");
      default:
        return t("required");
    }
  };

  const setField = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const parsed = shortTermMedicalFormSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        if (nextErrors[field]) continue;
        nextErrors[field] = messageForIssue(issue.message);
      }
      setErrors(nextErrors);
      return;
    }

    setIsPending(true);
    try {
      // Pixel + CAPI share one eventId so Meta deduplicates the browser and server events.
      const eventId = generateEventId();
      const { fbp, fbc } = getFacebookCookies();

      const response = await fetch("/api/partners/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: partnerSlug,
          ...parsed.data,
          locale: isES ? "es" : "en",
          smsConsent,
          marketingConsent,
          meta: {
            eventId,
            eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
            fbp,
            fbc,
          },
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { success?: boolean };
      if (!response.ok || !data.success) {
        setSubmitError(t("error"));
        return;
      }

      void updateAdvancedMatching({
        em: parsed.data.email.trim().toLowerCase(),
        fn: parsed.data.firstName.trim().toLowerCase(),
        ln: parsed.data.lastName.trim().toLowerCase(),
        ph: parsed.data.phone.replace(/\D/g, "").replace(/^1/, ""),
      });

      trackLead(
        {
          contentName: `Referral partner — ${partnerSlug}`,
          value: PARTNER_LEAD_VALUE,
          currency: "USD",
          source: `partner_referral_${partnerSlug.replace(/-/g, "_")}`,
        },
        eventId
      );

      setDone(true);
    } catch {
      setSubmitError(t("error"));
    } finally {
      setIsPending(false);
    }
  }

  const inputBase =
    "w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder:text-slate-500";
  const inputErrorClass = "border-red-500 dark:border-red-500";

  if (done) {
    return (
      <div className="text-center">
        {/* Confirmation. Deliberately light on green — the old all-emerald panel shouted, and the
            real job of this screen is to offer the next step, not to celebrate. */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 ring-8 ring-emerald-500/5">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t("successTitle")}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {t("successMessage")}
        </p>

        {/* Self-enrollment. Highest-intent action on the screen, so it gets the accent panel:
            someone who wants to buy right now should not have to wait for a callback. */}
        {/* --pa-* come from the page's accent theme and are already contrast-corrected per mode;
            the raw hex would go near-invisible on the dark card. */}
        <div
          className="mt-6 rounded-2xl border p-5 text-left"
          style={{ backgroundColor: "var(--pa-soft)", borderColor: "var(--pa-soft)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--pa-soft)" }}
            >
              <Zap className="h-4 w-4" style={{ color: "var(--pa-text)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {t("successSelfEnrollTitle")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {t("successSelfEnrollBody")}
              </p>
            </div>
          </div>
          <a
            href={PIVOT_SELF_ENROLL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-sm transition-all hover:brightness-110"
            style={{ backgroundColor: accentColor }}
          >
            {t("successSelfEnrollCta")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Divider — makes "or talk to a person" read as an alternative, not a competing CTA. */}
        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t("successOr")}
          </span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={CRM_PHONE_TEL}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Phone className="h-4 w-4 flex-shrink-0" />
            {CRM_PHONE_DISPLAY}
          </a>
          <a
            href={WHATSAPP_CHAT_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <MessageCircle className="h-4 w-4 flex-shrink-0" />
            {t("successWhatsapp")}
          </a>
        </div>

        <button
          type="button"
          onClick={() => {
            setValues(EMPTY);
            setSmsConsent(false);
            setMarketingConsent(false);
            setDone(false);
          }}
          className="mt-5 text-sm font-medium text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {t("successAnother")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="partner-first-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("firstName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-first-name"
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={values.firstName}
            onChange={(e) => setField("firstName", e.target.value)}
            placeholder={t("firstNamePlaceholder")}
            disabled={isPending}
            aria-invalid={Boolean(errors.firstName)}
            className={`${inputBase} ${errors.firstName ? inputErrorClass : ""}`}
            style={{ ["--tw-ring-color" as string]: `${accentColor}40` }}
          />
          {errors.firstName && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label htmlFor="partner-last-name" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t("lastName")} <span className="text-red-500">*</span>
          </label>
          <input
            id="partner-last-name"
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(e) => setField("lastName", e.target.value)}
            placeholder={t("lastNamePlaceholder")}
            disabled={isPending}
            aria-invalid={Boolean(errors.lastName)}
            className={`${inputBase} ${errors.lastName ? inputErrorClass : ""}`}
            style={{ ["--tw-ring-color" as string]: `${accentColor}40` }}
          />
          {errors.lastName && (
            <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.lastName}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="partner-phone" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("phone")} <span className="text-red-500">*</span>
        </label>
        <PhoneInput
          id="partner-phone"
          international={false}
          defaultCountry="US"
          countries={["US"]}
          limitMaxLength
          value={values.phone}
          onChange={(value) => setField("phone", value ?? "")}
          placeholder={t("phonePlaceholder")}
          disabled={isPending}
          className={`${inputBase} ${errors.phone ? inputErrorClass : ""}`}
          style={{ ["--tw-ring-color" as string]: `${accentColor}40` }}
        />
        {errors.phone && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.phone}</p>
        )}
      </div>

      <div>
        <label htmlFor="partner-email" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
          {t("email")} <span className="text-red-500">*</span>
        </label>
        <input
          id="partner-email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setField("email", e.target.value)}
          placeholder={t("emailPlaceholder")}
          disabled={isPending}
          aria-invalid={Boolean(errors.email)}
          className={`${inputBase} ${errors.email ? inputErrorClass : ""}`}
          style={{ ["--tw-ring-color" as string]: `${accentColor}40` }}
        />
        {errors.email && (
          <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{errors.email}</p>
        )}
      </div>

      <div className="space-y-2.5 pt-1">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            disabled={isPending}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 dark:border-slate-600"
          />
          <span>{t("smsConsent")}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
            disabled={isPending}
            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 dark:border-slate-600"
          />
          <span>{t("marketingConsent")}</span>
        </label>
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-bold text-white shadow-lg transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: accentColor }}
      >
        {isPending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {t("submitting")}
          </>
        ) : (
          t("submit")
        )}
      </button>

      <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {t("privacyNote")}
      </p>
    </form>
  );
}
