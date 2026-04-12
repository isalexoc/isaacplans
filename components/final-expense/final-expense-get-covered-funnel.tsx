"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, MapPin, Shield } from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  GET_COVERED_FAST_HERO_IMAGE,
} from "@/lib/get-covered-fast/constants";
import { shortTermMedicalFormSchema, capitalizeName } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

type Phase = "contact" | "address" | "done";

export default function FinalExpenseGetCoveredFunnel() {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("finalExpenseGetCoveredPage.funnel");
  const tForm = useTranslations("contactPage.info.form");

  const [phase, setPhase] = useState<Phase>("contact");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [contactId, setContactId] = useState<string | null>(null);

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("VA");
  const [postalCode, setPostalCode] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const inputBase =
    "w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] transition-all duration-200";

  const progress = useMemo(() => (phase === "contact" ? 50 : phase === "address" ? 100 : 100), [phase]);

  const translateIssue = (messageKey: string) => {
    if (messageKey === "required") return tForm("required");
    if (messageKey === "invalidEmail") return tForm("invalidEmail");
    if (messageKey === "invalidPhone") return tForm("invalidPhone");
    if (messageKey === "firstNameMinLength") return tForm("firstNameMinLength");
    if (messageKey === "lastNameMinLength") return tForm("lastNameMinLength");
    if (messageKey === "firstNameMaxLength") return tForm("firstNameMaxLength");
    if (messageKey === "lastNameMaxLength") return tForm("lastNameMaxLength");
    return tForm("required");
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const parsed = shortTermMedicalFormSchema.safeParse({
      firstName,
      lastName,
      email,
      phone,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) errors[field] = translateIssue(issue.message);
      }
      setFieldErrors(errors);
      return;
    }

    const phoneE164 = parsePhoneNumber(phone, "US")?.number;
    if (!phoneE164) {
      setFieldErrors({ phone: tForm("invalidPhone") });
      return;
    }

    setLoadingContact(true);
    try {
      const eventId = generateEventId();
      const { fbp, fbc } = getFacebookCookies();

      const capFirst = capitalizeName(parsed.data.firstName.trim());
      const capLast = capitalizeName(parsed.data.lastName.trim());
      const emailNorm = parsed.data.email.trim().toLowerCase();
      const phoneDigits = phoneE164.replace(/\D/g, "");
      const phonePayload =
        phoneDigits.length === 11 && phoneDigits.startsWith("1")
          ? `+${phoneDigits}`
          : `+1${phoneDigits}`;

      const res = await fetch("/api/create-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: capFirst,
          lastName: capLast,
          email: emailNorm,
          phone: phonePayload,
          finalExpenseData: {
            language: isES ? "es" : "en",
            source: "final_expense_get_covered_ads",
            campaign: "virginia_in_person",
            targetRegion: "Virginia",
            smsConsent,
            marketingConsent,
          },
          meta: {
            eventId,
            fbp,
            fbc,
            eventSourceUrl:
              typeof window !== "undefined" ? window.location.href : "",
          },
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : isES
              ? "Error al procesar."
              : "Something went wrong."
        );
      }

      const id = data.contactId as string | undefined;
      if (!id) {
        throw new Error(
          isES ? "Respuesta inválida del servidor." : "Invalid server response."
        );
      }

      setContactId(id);

      const userData = {
        em: emailNorm,
        fn: capFirst.toLowerCase(),
        ln: capLast.toLowerCase(),
        ph: phoneDigits.replace(/^1/, ""),
      };
      void updateAdvancedMatching(userData);

      const isNew = data.isExisting !== true;
      if (isNew) {
        trackLead(
          {
            contentName: "Final expense — get covered (VA ads)",
            value: 100,
            currency: "USD",
            source: "final_expense_get_covered_ads",
          },
          eventId
        );
      }

      setPhase("address");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : isES
            ? "Error inesperado."
            : "Unexpected error."
      );
    } finally {
      setLoadingContact(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!contactId || !email.trim()) {
      setSubmitError(
        isES ? "Sesión inválida. Vuelva a enviar el formulario." : "Invalid session. Please submit the form again."
      );
      return;
    }

    if (!addressLine1.trim() || !city.trim() || !stateVal.trim() || !postalCode.trim()) {
      setSubmitError(t("address.required"));
      return;
    }

    const zipOk = /^\d{5}(-\d{4})?$/.test(postalCode.trim());
    if (!zipOk) {
      setSubmitError(t("address.invalidZip"));
      return;
    }

    const phoneE164 = parsePhoneNumber(phone, "US")?.number;
    if (!phoneE164) {
      setSubmitError(
        isES
          ? "Teléfono no válido. Vuelva al paso anterior o recargue la página."
          : "Invalid phone. Go back to step 1 or refresh the page."
      );
      return;
    }

    setLoadingAddress(true);
    try {
      const res = await fetch("/api/contact-append-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          email: email.trim().toLowerCase(),
          phone: phoneE164,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: stateVal.trim(),
          postalCode: postalCode.trim(),
          country: "US",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : isES
              ? "No se pudo guardar la dirección."
              : "Could not save address."
        );
      }

      setPhase("done");
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : isES
            ? "Error inesperado."
            : "Unexpected error."
      );
    } finally {
      setLoadingAddress(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--custom)/0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,hsl(var(--custom)/0.08),transparent_50%)]"
        aria-hidden
      />

      <div className="relative z-10 bg-[hsl(var(--custom))] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/95 sm:text-xs sm:tracking-wide">
        {t("banner")}
      </div>

      <div className="relative z-10 mx-auto flex min-h-0 max-w-6xl flex-col lg:min-h-[min(100vh,920px)] lg:flex-row lg:items-stretch">
        <div className="relative hidden overflow-hidden bg-slate-900 lg:sticky lg:block lg:top-0 lg:min-h-[min(100vh,920px)] lg:w-[46%] lg:shrink-0">
          <Image
            src={GET_COVERED_FAST_HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 0px, 46vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-slate-950/25"
            aria-hidden
          />
          <div className="absolute inset-0 flex flex-col justify-center p-10 pb-10 xl:p-12">
            <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-md sm:text-xs [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
              {t("hero.badge")}
            </p>
            <h1 className="text-[1.65rem] font-bold leading-[1.2] tracking-tight text-white xl:text-4xl [text-shadow:0_2px_28px_rgba(0,0,0,0.9),0_1px_3px_rgba(0,0,0,0.95)]">
              {t("hero.title")}
            </h1>
            <p className="mt-4 max-w-xl text-base leading-snug text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.88)]">
              {t("hero.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:justify-center lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-lg">
            <h1 className="sr-only lg:hidden">{t("hero.title")}</h1>

            <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:text-xs">
                {phase === "done"
                  ? t("progress.done")
                  : t("progress.step", {
                      current: phase === "contact" ? 1 : 2,
                      total: 2,
                    })}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
                <Shield
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
                {t("secureNote")}
              </p>
            </div>

            <div className="mb-4 flex justify-center gap-1.5 sm:gap-2" aria-hidden>
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 sm:h-2",
                    (phase === "address" || phase === "done" ? i <= 1 : i === 0)
                      ? "w-6 bg-[hsl(var(--custom))] sm:w-8"
                      : "w-1.5 bg-slate-200 dark:bg-slate-700 sm:w-2"
                  )}
                />
              ))}
            </div>

            <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 shadow-sm transition-[width] duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 sm:p-7 sm:px-8">
              {phase === "contact" && (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                    {t("contact.intro")}
                  </p>

                  {submitError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tForm("firstName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={cn(inputBase, fieldErrors.firstName && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.firstName && (
                      <p className="mt-1 text-xs text-red-500">{fieldErrors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tForm("lastName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={cn(inputBase, fieldErrors.lastName && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.lastName && (
                      <p className="mt-1 text-xs text-red-500">{fieldErrors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tForm("email")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn(inputBase, fieldErrors.email && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.email && (
                      <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {tForm("phone")} <span className="text-red-500">*</span>
                    </label>
                    <PhoneInput
                      defaultCountry="US"
                      countries={["US"]}
                      addInternationalOption={false}
                      value={toE164OrUndefined(phone)}
                      onChange={(v) => setPhone(v || "")}
                      className={cn(
                        inputBase,
                        fieldErrors.phone && "border-red-500"
                      )}
                      disabled={loadingContact}
                    />
                    {fieldErrors.phone && (
                      <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p>
                    )}
                  </div>

                  <div className="space-y-3 border-t border-gray-200 pt-2 dark:border-gray-700">
                    <label className="group flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                        disabled={loadingContact}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] dark:border-gray-600"
                      />
                      <span className="text-xs text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">
                        {tForm("smsConsent")}
                      </span>
                    </label>
                    <label className="group flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={marketingConsent}
                        onChange={(e) => setMarketingConsent(e.target.checked)}
                        disabled={loadingContact}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] dark:border-gray-600"
                      />
                      <span className="text-xs text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-200">
                        {tForm("marketingConsent")}
                      </span>
                    </label>
                  </div>

                  <Button
                    type="submit"
                    disabled={loadingContact}
                    size="lg"
                    className="h-14 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-base font-semibold text-white shadow-lg"
                  >
                    {loadingContact ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                        {tForm("submitting")}
                      </>
                    ) : (
                      t("contact.cta")
                    )}
                  </Button>
                </form>
              )}

              {phase === "address" && (
                <form onSubmit={handleAddressSubmit} className="space-y-4">
                  <div className="mb-2 flex items-start gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--custom))]" />
                    <p className="text-sm leading-relaxed">{t("address.intro")}</p>
                  </div>

                  {submitError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("address.line1")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="street-address"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      className={inputBase}
                      disabled={loadingAddress}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("address.line2")}
                    </label>
                    <input
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className={inputBase}
                      disabled={loadingAddress}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("address.city")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputBase}
                        disabled={loadingAddress}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t("address.state")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stateVal}
                        onChange={(e) => setStateVal(e.target.value.toUpperCase())}
                        maxLength={2}
                        className={inputBase}
                        disabled={loadingAddress}
                        aria-label={t("address.state")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t("address.zip")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className={inputBase}
                      disabled={loadingAddress}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loadingAddress}
                    size="lg"
                    className="h-14 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-base font-semibold text-white shadow-lg"
                  >
                    {loadingAddress ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
                        {tForm("submitting")}
                      </>
                    ) : (
                      t("address.cta")
                    )}
                  </Button>
                </form>
              )}

              {phase === "done" && (
                <div className="py-2 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
                    <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t("done.title")}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {t("done.body")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
