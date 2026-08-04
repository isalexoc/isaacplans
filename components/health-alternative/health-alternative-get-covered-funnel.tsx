"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Compass, Contact, ExternalLink, Loader2, Phone, Shield } from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT,
  FINAL_EXPENSE_GET_COVERED_VCARD_URL,
  getHealthAlternativeGetCoveredHeroImageUrl,
} from "@/lib/get-covered-fast/constants";
import { PIVOT_DIRECT_QUOTE_URL } from "@/lib/pivot-direct-quote";
import { shortTermMedicalFormSchema, capitalizeName } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import { appendAgentCrmBookingPrefill } from "@/lib/agent-crm-booking-url";

/** CRM line — same as site header / contact */
const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";
const WHATSAPP_CHAT_HREF = "https://wa.me/15406813507";

/** Lead value reported to Meta — matches the other get-covered ads funnels. */
const HEALTH_ALTERNATIVE_LEAD_VALUE = 100;

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

type Phase = "contact" | "done";

export default function HealthAlternativeGetCoveredFunnel({
  heroImageUrl,
}: {
  /** Admin-overridable hero image (lib/ads-images/settings.ts); falls back to the built-in default. */
  heroImageUrl?: string;
}) {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("healthAlternativeGetCoveredPage.funnel");
  const tForm = useTranslations("contactPage.info.form");

  const [phase, setPhase] = useState<Phase>("contact");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const inputBase =
    "min-h-[56px] w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-[17px] leading-6 text-gray-900 placeholder:text-[15px] placeholder:text-gray-400 transition-all duration-200 focus:border-[hsl(var(--custom))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500";
  const phoneInputBase = cn(
    inputBase,
    "flex items-center gap-2",
    "[&_.PhoneInputCountry]:m-0 [&_.PhoneInputCountry]:self-stretch [&_.PhoneInputCountry]:rounded-md [&_.PhoneInputCountry]:bg-transparent",
    "[&_.PhoneInputCountrySelect]:h-full [&_.PhoneInputCountrySelect]:rounded-md [&_.PhoneInputCountrySelect]:bg-transparent",
    "[&_.PhoneInputCountrySelectArrow]:text-gray-500 dark:[&_.PhoneInputCountrySelectArrow]:text-gray-300",
    "[&_.PhoneInputCountryIcon]:shadow-none",
    "[&_.PhoneInputInput]:h-full [&_.PhoneInputInput]:min-h-[48px] [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:p-0 [&_.PhoneInputInput]:text-[17px] [&_.PhoneInputInput]:leading-6 [&_.PhoneInputInput]:text-gray-900 [&_.PhoneInputInput]:outline-none dark:[&_.PhoneInputInput]:text-white"
  );
  const labelBase = "mb-1.5 block text-base font-semibold text-gray-800 dark:text-gray-200";
  const fieldErrorBase = "mt-1.5 text-sm font-medium text-red-600 dark:text-red-400";

  /** Prevents double POST before React re-disables submit (pairs with Meta event_id dedup server-side). */
  const contactSubmitInFlightRef = useRef(false);

  const calendarBookingHref = (() => {
    const phoneE164 = parsePhoneNumber(phone, "US")?.number?.trim() ?? "";
    return appendAgentCrmBookingPrefill("/health-alternative/calendar", {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneE164,
    });
  })();

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

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

    if (contactSubmitInFlightRef.current) return;
    contactSubmitInFlightRef.current = true;

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
          healthAlternativeData: {
            language: isES ? "es" : "en",
            source: "health_alternative_get_covered_ads",
            smsConsent,
            marketingConsent,
          },
          meta: {
            eventId,
            fbp,
            fbc,
            eventSourceUrl: typeof window !== "undefined" ? window.location.href : "",
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
        throw new Error(isES ? "Respuesta inválida del servidor." : "Invalid server response.");
      }

      const capiDispatched = (data as { capiDispatched?: boolean }).capiDispatched;
      if (process.env.NODE_ENV === "development" && capiDispatched !== true) {
        console.warn(
          "[health-alternative/get-covered] Meta CAPI Lead was not dispatched. Set META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID; ensure meta.eventId and eventSourceUrl are sent (also sent on duplicate-merge for the health_alternative_get_covered_ads source)."
        );
      }

      const userData = {
        em: emailNorm,
        fn: capFirst.toLowerCase(),
        ln: capLast.toLowerCase(),
        ph: phoneDigits.replace(/^1/, ""),
      };
      void updateAdvancedMatching(userData);

      trackLead(
        {
          contentName: "Health Coverage Alternative — get covered",
          value: HEALTH_ALTERNATIVE_LEAD_VALUE,
          currency: "USD",
          source: "health_alternative_get_covered_ads",
        },
        eventId
      );

      setPhase("done");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : isES ? "Error inesperado." : "Unexpected error."
      );
    } finally {
      contactSubmitInFlightRef.current = false;
      setLoadingContact(false);
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
            src={heroImageUrl ?? getHealthAlternativeGetCoveredHeroImageUrl(locale)}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 0px, 46vw"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(135%_62%_at_42%_42%,rgba(0,0,0,0.7),rgba(0,0,0,0.12)_72%)]"
            aria-hidden
          />
          <div className="absolute inset-x-0 top-[42%] flex -translate-y-1/2 flex-col px-10 xl:px-12">
            <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-md sm:text-xs [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
              <Compass className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
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
            {/* Mobile-only hero — desktop uses the split image panel */}
            <div className="mb-6 lg:hidden">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.2)]">
                <Compass className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("hero.badge")}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t("hero.title")}
              </h1>
              <p className="mt-2 text-sm leading-snug text-slate-600 dark:text-slate-400 sm:text-base">
                {t("hero.mobileSubtitle")}
              </p>
            </div>

            {phase === "contact" && (
              <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="flex items-center gap-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
                  <Shield
                    className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden
                  />
                  {t("secureNote")}
                </p>
              </div>
            )}

            <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 sm:p-7 sm:px-8">
              {phase === "contact" && (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  {submitError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className={labelBase}>
                      {tForm("firstName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFirstName(value);
                        if (value.trim()) clearFieldError("firstName");
                      }}
                      className={cn(inputBase, fieldErrors.firstName && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.firstName && (
                      <p className={fieldErrorBase}>{fieldErrors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelBase}>
                      {tForm("lastName")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setLastName(value);
                        if (value.trim()) clearFieldError("lastName");
                      }}
                      className={cn(inputBase, fieldErrors.lastName && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.lastName && (
                      <p className={fieldErrorBase}>{fieldErrors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelBase}>
                      {tForm("email")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEmail(value);
                        if (value.trim()) clearFieldError("email");
                      }}
                      className={cn(inputBase, fieldErrors.email && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.email && <p className={fieldErrorBase}>{fieldErrors.email}</p>}
                  </div>

                  <div>
                    <label className={labelBase}>
                      {tForm("phone")} <span className="text-red-500">*</span>
                    </label>
                    <PhoneInput
                      defaultCountry="US"
                      countries={["US"]}
                      addInternationalOption={false}
                      value={toE164OrUndefined(phone)}
                      onChange={(v) => {
                        const value = v || "";
                        setPhone(value);
                        if (value.trim()) clearFieldError("phone");
                      }}
                      className={cn(phoneInputBase, fieldErrors.phone && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.phone && <p className={fieldErrorBase}>{fieldErrors.phone}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loadingContact}
                    size="lg"
                    className="h-16 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-lg font-semibold text-white shadow-lg"
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

                  <div className="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <label className="group flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                        disabled={loadingContact}
                        className="mt-1 h-4 w-4 shrink-0 rounded border-2 border-gray-300 text-[hsl(var(--custom))] focus:ring-[hsl(var(--custom)/0.3)] dark:border-gray-600"
                      />
                      <span className="text-sm leading-relaxed text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
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
                      <span className="text-sm leading-relaxed text-gray-700 group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
                        {tForm("marketingConsent")}
                      </span>
                    </label>
                  </div>
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

                  <div
                    className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-slate-200/90 bg-slate-50/95 p-4 text-left shadow-sm dark:border-slate-600/60 dark:bg-slate-800/60 sm:mt-7 sm:p-5"
                    role="region"
                    aria-label={`${t("done.callerIntro")} ${t("done.callerSubline")}`}
                  >
                    <p className="text-sm font-medium leading-snug text-slate-600 dark:text-slate-300">
                      {t("done.callerIntro")}
                    </p>
                    <div className="mt-3 flex min-w-0 items-center gap-3 sm:mt-4 sm:gap-4">
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-slate-200 shadow-md ring-2 ring-slate-200/80 dark:border-slate-700 dark:bg-slate-700 dark:ring-slate-600 sm:h-24 sm:w-24">
                        <Image
                          src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
                          alt={t("done.headshotAlt")}
                          width={256}
                          height={256}
                          className="h-full w-full object-cover object-[center_20%] sm:object-center"
                          sizes="(max-width: 640px) 80px, 96px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-slate-900 dark:text-white sm:text-base">
                          {t("done.agentName")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                          {t("done.agentTitle")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-snug text-slate-500 dark:text-slate-400">
                      {(() => {
                        const subline = t("done.callerSubline");
                        const [beforePhone, ...afterParts] = subline.split(CRM_PHONE_DISPLAY);
                        if (afterParts.length === 0) return subline;
                        return (
                          <>
                            {beforePhone}
                            <strong className="font-semibold text-slate-700 dark:text-slate-200">
                              {CRM_PHONE_DISPLAY}
                            </strong>
                            {afterParts.join(CRM_PHONE_DISPLAY)}
                          </>
                        );
                      })()}
                    </p>

                    <a
                      href={FINAL_EXPENSE_GET_COVERED_VCARD_URL}
                      download="Isaac-Orraiz-Isaac-Plans.vcf"
                      rel="noopener noreferrer"
                      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-[hsl(var(--custom))] bg-white px-4 text-sm font-semibold text-[hsl(var(--custom))] shadow-sm transition-colors active:bg-slate-50 dark:bg-slate-900/40 dark:text-[hsl(var(--custom))] dark:active:bg-slate-800 sm:mt-4"
                      aria-label={t("done.saveContactAria")}
                    >
                      <Contact className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                      {t("done.saveContactCta")}
                    </a>
                  </div>

                  <p className="mt-6 text-sm font-medium text-slate-800 dark:text-slate-200 sm:mt-7">
                    {t("done.optionIntro")}
                  </p>
                  <div className="mt-4 flex w-full flex-col gap-3">
                    <div>
                      <Button
                        asChild
                        size="lg"
                        className="h-16 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-lg font-semibold text-white shadow-lg"
                      >
                        <Link href={calendarBookingHref as "/health-alternative/calendar"}>
                          {t("done.bookCta")}
                        </Link>
                      </Button>
                    </div>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-16 w-full rounded-xl border-2 border-[hsl(var(--custom))] bg-white text-lg font-semibold text-[hsl(var(--custom))] shadow-sm hover:bg-[hsl(var(--custom)/0.06)] dark:bg-slate-900/40 dark:text-[hsl(var(--custom))] dark:hover:bg-slate-800"
                    >
                      <a
                        href={PIVOT_DIRECT_QUOTE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2"
                      >
                        {t("done.selfEnrollCta")}
                        <ExternalLink className="h-5 w-5 shrink-0" aria-hidden />
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-16 w-full rounded-xl border-2 border-slate-300 bg-white text-lg font-semibold text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50 dark:text-white dark:hover:bg-slate-800"
                    >
                      <a
                        href={CRM_PHONE_TEL}
                        className="inline-flex w-full items-center justify-center gap-2"
                        aria-label={t("done.callAria")}
                      >
                        <Phone className="h-5 w-5 shrink-0" aria-hidden />
                        {t("done.callCta")}
                      </a>
                    </Button>
                    {isES && (
                      <Button
                        asChild
                        size="lg"
                        className="h-16 w-full rounded-xl border-0 bg-[#25D366] text-lg font-semibold text-white shadow-lg hover:bg-[#20bd5a]"
                      >
                        <a
                          href={WHATSAPP_CHAT_HREF}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex w-full items-center justify-center"
                          aria-label={t("done.whatsappAria")}
                        >
                          {t("done.whatsappCta")}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {phase !== "done" && (
                <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
                  {t("helpLine")}{" "}
                  <a
                    href={CRM_PHONE_TEL}
                    className="font-medium text-[hsl(var(--custom))] underline-offset-2 hover:underline"
                  >
                    {CRM_PHONE_DISPLAY}
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
