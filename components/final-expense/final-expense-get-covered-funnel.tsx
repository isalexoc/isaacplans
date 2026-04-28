"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Contact, Loader2, Phone, Shield } from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT,
  FINAL_EXPENSE_GET_COVERED_VCARD_URL,
  GET_COVERED_FAST_HERO_IMAGE,
} from "@/lib/get-covered-fast/constants";
import { shortTermMedicalFormSchema, capitalizeName } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import { appendAgentCrmBookingPrefill } from "@/lib/agent-crm-booking-url";
import {
  trackFeGetCoveredAbandon,
  trackFeGetCoveredFieldCompleted,
  trackFeGetCoveredFieldStarted,
  trackFeGetCoveredPhase,
  trackFeGetCoveredSubmitAttempt,
  trackFeGetCoveredSubmitSuccess,
  type FeGetCoveredFieldId,
} from "@/lib/analytics/final-expense-get-covered-ga";

/** CRM line — same as site header / contact */
const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";
const WHATSAPP_CHAT_HREF = "https://wa.me/15406813507";
const DOB_ISO_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getTodayIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isValidPastOrTodayIsoDate(value: string): boolean {
  if (!DOB_ISO_REGEX.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return false;
  }
  return value <= getTodayIsoLocal();
}

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

type GoogleAddressComponent = {
  types: string[];
  longText?: string;
  shortText?: string;
};

/** Parses `Place.addressComponents` from the Places API (new `Place` class). */
function parseGooglePlaceAddressComponents(components: GoogleAddressComponent[] | undefined) {
  if (!components?.length) return null;

  const getPart = (type: string, pick: "longText" | "shortText" = "longText") => {
    const c = components.find((x) => x.types?.includes(type));
    if (!c) return "";
    const v = pick === "shortText" ? c.shortText : c.longText;
    return (v ?? "").trim();
  };

  const streetNumber = getPart("street_number");
  const route = getPart("route");
  const locality =
    getPart("locality") ||
    getPart("postal_town") ||
    getPart("administrative_area_level_3");
  const stateShort = getPart("administrative_area_level_1", "shortText");
  const zip = getPart("postal_code");

  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  if (!line1) return null;

  return {
    line1,
    city: locality,
    state: stateShort ? stateShort.toUpperCase() : "",
    zip,
  };
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
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressScriptLoaded, setAddressScriptLoaded] = useState(false);
  const [addressScriptFailed, setAddressScriptFailed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);

  const inputBase =
    "min-h-[56px] w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-[17px] leading-6 text-gray-900 placeholder:text-[15px] placeholder:text-gray-400 transition-all duration-200 focus:border-[hsl(var(--custom))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--custom)/0.2)] dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500";
  const dateInputBase = cn(
    inputBase,
    "appearance-none [-webkit-appearance:none] [&::-webkit-date-and-time-value]:min-h-[1.5rem] [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:leading-6",
  );
  const labelBase = "mb-1.5 block text-base font-semibold text-gray-800 dark:text-gray-200";
  const fieldErrorBase = "mt-1.5 text-sm font-medium text-red-600 dark:text-red-400";

  const progress = useMemo(() => (phase === "contact" ? 50 : phase === "address" ? 100 : 100), [phase]);
  const maxDob = useMemo(() => getTodayIsoLocal(), []);
  const placeAutocompleteContainerRef = useRef<HTMLDivElement | null>(null);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const shouldUseAddressAutocomplete = Boolean(mapsApiKey) && addressScriptLoaded && !addressScriptFailed;
  const pageViewStartedAtRef = useRef<number>(Date.now());
  const startedFieldsRef = useRef<Set<FeGetCoveredFieldId>>(new Set());
  const completedFieldsRef = useRef<Set<FeGetCoveredFieldId>>(new Set());
  const abandonTrackedRef = useRef(false);

  const calendarBookingHref = useMemo(() => {
    const phoneE164 = parsePhoneNumber(phone, "US")?.number?.trim() ?? "";
    return appendAgentCrmBookingPrefill("/final-expense/calendar", {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneE164,
    });
  }, [firstName, lastName, email, phone]);

  /** GA4: one event per funnel phase (contact → address → done). Does not affect Meta Pixel/CAPI. */
  useEffect(() => {
    trackFeGetCoveredPhase({ phase, locale });
  }, [phase, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const trackAbandon = () => {
      if (abandonTrackedRef.current) return;
      if (phase === "done") return;
      const elapsedSeconds = Math.max(0, Math.round((Date.now() - pageViewStartedAtRef.current) / 1000));
      trackFeGetCoveredAbandon({
        phase,
        locale,
        time_on_page_seconds: elapsedSeconds,
      });
      abandonTrackedRef.current = true;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        trackAbandon();
      }
    };

    window.addEventListener("pagehide", trackAbandon);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", trackAbandon);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [phase, locale]);

  useEffect(() => {
    if (!submitError) return;

    const requiredAddressError = t("address.required");
    const invalidZipError = t("address.invalidZip");
    const hasRequiredAddress =
      addressLine1.trim().length > 0 &&
      city.trim().length > 0 &&
      stateVal.trim().length > 0 &&
      postalCode.trim().length > 0;

    if (submitError === requiredAddressError && hasRequiredAddress) {
      setSubmitError(null);
      return;
    }

    if (submitError === invalidZipError && /^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
      setSubmitError(null);
    }
  }, [submitError, addressLine1, city, stateVal, postalCode, t]);

  useEffect(() => {
    if (!mapsApiKey) return;
    if (typeof window === "undefined") return;
    const gWin = window as unknown as { google?: { maps?: { importLibrary?: unknown } } };
    if (gWin.google?.maps?.importLibrary) {
      setAddressScriptLoaded(true);
      setAddressScriptFailed(false);
    }
  }, [mapsApiKey, phase]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phase !== "address") return;
    if (!mapsApiKey) return;
    if (addressScriptLoaded || addressScriptFailed) return;

    const timeoutId = window.setTimeout(() => {
      setAddressScriptFailed(true);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [phase, mapsApiKey, addressScriptLoaded, addressScriptFailed]);

  /** After step 1 (or 2), bring viewport to top — mobile users often stay mid-page after focusing lower fields. */
  useLayoutEffect(() => {
    if (phase === "contact") return;
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== "address") return;
    if (!mapsApiKey) return;
    if (!addressScriptLoaded) return;
    if (typeof window === "undefined") return;

    if (!placeAutocompleteContainerRef.current) return;

    let cancelled = false;
    let detach: (() => void) | undefined;
    const gWin = window as unknown as {
      google?: { maps?: { importLibrary: (name: string) => Promise<unknown> } };
    };

    void (async () => {
      let lib: unknown;
      try {
        lib = await gWin.google?.maps?.importLibrary?.("places");
      } catch {
        setAddressScriptFailed(true);
        return;
      }
      if (cancelled || !placeAutocompleteContainerRef.current) return;
      if (!lib || typeof lib !== "object") {
        setAddressScriptFailed(true);
        return;
      }

      const PlaceAutocompleteElement = (lib as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement })
        .PlaceAutocompleteElement;
      if (!PlaceAutocompleteElement) {
        setAddressScriptFailed(true);
        return;
      }

      const mountRoot = placeAutocompleteContainerRef.current;
      mountRoot.replaceChildren();

      const el = new PlaceAutocompleteElement({
        includedRegionCodes: ["us"],
        requestedLanguage: isES ? "es" : "en",
        requestedRegion: "us",
        placeholder: t("address.searchPlaceholder"),
        name: "streetAddress",
      });
      el.id = "fe-get-covered-street-address";
      el.style.width = "100%";
      el.style.display = "block";
      el.style.colorScheme = "light";
      el.style.boxSizing = "border-box";
      el.style.border = "none";
      el.style.backgroundColor = "transparent";

      const onSelect = (event: Event) => {
        void (async () => {
          const pred = (event as unknown as { placePrediction?: { toPlace: () => unknown } }).placePrediction;
          if (!pred) return;

          try {
            const place = pred.toPlace() as {
              fetchFields: (opts: { fields: string[] }) => Promise<void>;
              addressComponents?: GoogleAddressComponent[];
            };

            await place.fetchFields({ fields: ["addressComponents"] });
            const parsed = parseGooglePlaceAddressComponents(place.addressComponents);
            if (parsed?.line1) {
              setAddressLine1(parsed.line1);
              (el as unknown as { value: string }).value = parsed.line1;
            }
            if (parsed?.city) setCity(parsed.city);
            if (parsed?.state) setStateVal(parsed.state);
            if (parsed?.zip) setPostalCode(parsed.zip);
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("[final-expense/get-covered] Place fetchFields failed:", e);
            }
          }
        })();
      };

      const onInput = () => {
        setAddressLine1((el as unknown as { value?: string }).value ?? "");
      };

      setAddressScriptFailed(false);
      el.addEventListener("gmp-select", onSelect as EventListener);
      el.addEventListener("input", onInput);
      if (cancelled || !placeAutocompleteContainerRef.current) return;

      mountRoot.appendChild(el);

      detach = () => {
        el.removeEventListener("gmp-select", onSelect as EventListener);
        el.removeEventListener("input", onInput);
      };
    })();

    return () => {
      cancelled = true;
      detach?.();
      if (placeAutocompleteContainerRef.current) {
        placeAutocompleteContainerRef.current.replaceChildren();
      }
    };
  }, [phase, mapsApiKey, addressScriptLoaded, isES, t]);

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

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const trackFieldStartedOnce = (fieldId: FeGetCoveredFieldId, phaseForEvent: "contact" | "address") => {
    if (startedFieldsRef.current.has(fieldId)) return;
    startedFieldsRef.current.add(fieldId);
    trackFeGetCoveredFieldStarted({ field_id: fieldId, phase: phaseForEvent, locale });
  };

  const trackFieldCompletedOnce = (
    fieldId: FeGetCoveredFieldId,
    phaseForEvent: "contact" | "address",
    isValidValue: boolean
  ) => {
    if (!isValidValue) return;
    if (completedFieldsRef.current.has(fieldId)) return;
    completedFieldsRef.current.add(fieldId);
    trackFeGetCoveredFieldCompleted({ field_id: fieldId, phase: phaseForEvent, locale });
  };

  useEffect(() => {
    if (phase !== "address") return;

    const line1 = addressLine1.trim();
    const cityTrim = city.trim();
    const stateTrim = stateVal.trim();
    const zipTrim = postalCode.trim();

    if (line1.length > 0) {
      trackFieldStartedOnce("address_line1", "address");
      trackFieldCompletedOnce("address_line1", "address", true);
    }
    if (cityTrim.length > 0) {
      trackFieldStartedOnce("city", "address");
      trackFieldCompletedOnce("city", "address", true);
    }
    if (stateTrim.length > 0) {
      trackFieldStartedOnce("state", "address");
      trackFieldCompletedOnce("state", "address", stateTrim.length >= 2);
    }
    if (zipTrim.length > 0) {
      trackFieldStartedOnce("zip", "address");
      trackFieldCompletedOnce("zip", "address", /^\d{5}(-\d{4})?$/.test(zipTrim));
    }
  }, [phase, addressLine1, city, stateVal, postalCode, trackFieldStartedOnce, trackFieldCompletedOnce]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFieldErrors({});
    trackFeGetCoveredSubmitAttempt({ phase: "contact", locale });

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
            campaign: "final_expense_get_covered",
            targetRegion: "United States",
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
      trackFeGetCoveredSubmitSuccess({ phase: "contact", locale });

      const capiDispatched = (data as { capiDispatched?: boolean }).capiDispatched;
      if (
        process.env.NODE_ENV === "development" &&
        data.isExisting !== true &&
        capiDispatched === false
      ) {
        console.warn(
          "[final-expense/get-covered] New lead saved but Meta CAPI Lead was not sent. Set META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID; ensure meta.eventId and eventSourceUrl are sent."
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
            contentName: "Final expense — get covered",
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
    trackFeGetCoveredSubmitAttempt({ phase: "address", locale });

    if (!contactId || !email.trim()) {
      setSubmitError(
        isES ? "Sesión inválida. Vuelva a enviar el formulario." : "Invalid session. Please submit the form again."
      );
      return;
    }

    if (!dateOfBirth.trim()) {
      setSubmitError(t("address.requiredDob"));
      return;
    }
    if (!isValidPastOrTodayIsoDate(dateOfBirth.trim())) {
      setSubmitError(t("address.invalidDob"));
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
          dateOfBirth: dateOfBirth.trim(),
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

      trackFeGetCoveredSubmitSuccess({ phase: "address", locale });
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

  const handleDateOfBirthChange = (value: string) => {
    setDateOfBirth(value);
    trackFieldStartedOnce("dob", "address");
    trackFieldCompletedOnce("dob", "address", isValidPastOrTodayIsoDate(value.trim()));

    if (!submitError) return;

    const requiredDobError = t("address.requiredDob");
    const invalidDobError = t("address.invalidDob");

    if (submitError === requiredDobError && value.trim()) {
      setSubmitError(null);
      return;
    }

    if (submitError === invalidDobError && isValidPastOrTodayIsoDate(value.trim())) {
      setSubmitError(null);
    }
  };

  const dobErrorMessage =
    submitError === t("address.requiredDob") || submitError === t("address.invalidDob")
      ? submitError
      : null;
  const addressErrorMessage =
    submitError === t("address.required") || submitError === t("address.invalidZip")
      ? submitError
      : null;

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      {/* Prefetch during step 1 so Places is ready (or nearly) when the user reaches the address step */}
      {mapsApiKey && (phase === "contact" || phase === "address") && (
        <Script
          id="google-maps-places"
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places&loading=async`}
          strategy="afterInteractive"
          onLoad={() => {
            setAddressScriptLoaded(true);
            setAddressScriptFailed(false);
          }}
          onReady={() => {
            setAddressScriptLoaded(true);
            setAddressScriptFailed(false);
          }}
          onError={() => {
            setAddressScriptFailed(true);
          }}
        />
      )}
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
                  <p className="text-center text-base leading-relaxed text-slate-700 dark:text-slate-300">
                    {t("contact.intro")}
                  </p>

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
                        trackFieldStartedOnce("first_name", "contact");
                        trackFieldCompletedOnce("first_name", "contact", value.trim().length > 0);
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
                        trackFieldStartedOnce("last_name", "contact");
                        trackFieldCompletedOnce("last_name", "contact", value.trim().length > 0);
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
                        trackFieldStartedOnce("email", "contact");
                        trackFieldCompletedOnce("email", "contact", value.trim().length > 0);
                        if (value.trim()) clearFieldError("email");
                      }}
                      className={cn(inputBase, fieldErrors.email && "border-red-500")}
                      disabled={loadingContact}
                    />
                    {fieldErrors.email && (
                      <p className={fieldErrorBase}>{fieldErrors.email}</p>
                    )}
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
                        trackFieldStartedOnce("phone", "contact");
                        trackFieldCompletedOnce("phone", "contact", Boolean(parsePhoneNumber(value, "US")?.number));
                        if (value.trim()) clearFieldError("phone");
                      }}
                      className={cn(
                        inputBase,
                        fieldErrors.phone && "border-red-500"
                      )}
                      disabled={loadingContact}
                    />
                    {fieldErrors.phone && (
                      <p className={fieldErrorBase}>{fieldErrors.phone}</p>
                    )}
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

              {phase === "address" && (
                <form onSubmit={handleAddressSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="fe-get-covered-dob"
                      className={labelBase}
                    >
                      {t("address.dob")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fe-get-covered-dob"
                      type="date"
                      autoComplete="bday"
                      inputMode="none"
                      value={dateOfBirth}
                      onChange={(e) => handleDateOfBirthChange(e.target.value)}
                      max={maxDob}
                      className={cn(dateInputBase, dobErrorMessage && "border-red-500")}
                      disabled={loadingAddress}
                      aria-label={t("address.dob")}
                    />
                    {dobErrorMessage && <p className={fieldErrorBase}>{dobErrorMessage}</p>}
                  </div>

                  {shouldUseAddressAutocomplete ? (
                    <div>
                      <label
                        htmlFor="fe-get-covered-street-address"
                        className={labelBase}
                      >
                        {t("address.line1")} <span className="text-red-500">*</span>
                      </label>
                      <div
                        className={cn(
                          "min-h-[52px] w-full overflow-visible rounded-lg border-2 border-gray-200 bg-white transition-all focus-within:border-[hsl(var(--custom))] focus-within:ring-2 focus-within:ring-[hsl(var(--custom)/0.2)] dark:border-gray-700 dark:bg-slate-800/50 dark:focus-within:ring-[hsl(var(--custom)/0.2)]",
                          addressErrorMessage && "border-red-500"
                        )}
                        aria-busy={!addressScriptLoaded}
                      >
                        <div ref={placeAutocompleteContainerRef} className="w-full" />
                      </div>
                      {addressErrorMessage && (
                        <p className={fieldErrorBase}>{addressErrorMessage}</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                        {t("address.searchUnavailable")}
                      </p>
                      <div>
                        <label
                          htmlFor="fe-get-covered-street-address-manual"
                          className={labelBase}
                        >
                          {t("address.line1")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="fe-get-covered-street-address-manual"
                          name="streetAddress"
                          type="text"
                          autoComplete="street-address"
                          value={addressLine1}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAddressLine1(value);
                            trackFieldStartedOnce("address_line1", "address");
                            trackFieldCompletedOnce("address_line1", "address", value.trim().length > 0);
                          }}
                          className={cn(inputBase, addressErrorMessage && "border-red-500")}
                          disabled={loadingAddress}
                        />
                        {addressErrorMessage && (
                          <p className={fieldErrorBase}>{addressErrorMessage}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {submitError && !dobErrorMessage && !addressErrorMessage && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className={labelBase}>
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
                      <label className={labelBase}>
                        {t("address.city")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCity(value);
                          trackFieldStartedOnce("city", "address");
                          trackFieldCompletedOnce("city", "address", value.trim().length > 0);
                        }}
                        className={inputBase}
                        disabled={loadingAddress}
                      />
                    </div>
                    <div>
                      <label className={labelBase}>
                        {t("address.state")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={stateVal}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setStateVal(value);
                          trackFieldStartedOnce("state", "address");
                          trackFieldCompletedOnce("state", "address", value.trim().length >= 2);
                        }}
                        maxLength={2}
                        className={inputBase}
                        disabled={loadingAddress}
                        aria-label={t("address.state")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelBase}>
                      {t("address.zip")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      value={postalCode}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPostalCode(value);
                        trackFieldStartedOnce("zip", "address");
                        trackFieldCompletedOnce("zip", "address", /^\d{5}(-\d{4})?$/.test(value.trim()));
                      }}
                      className={inputBase}
                      disabled={loadingAddress}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loadingAddress}
                    size="lg"
                    className="h-16 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-lg font-semibold text-white shadow-lg"
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
                          {t("done.headshotAlt")}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-snug text-slate-500 dark:text-slate-400">
                      {(() => {
                        const subline = t("done.callerSubline");
                        const [beforePhone, ...afterParts] = subline.split(CRM_PHONE_DISPLAY);

                        if (afterParts.length === 0) {
                          return subline;
                        }

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
                      <Contact
                        className="h-5 w-5 shrink-0"
                        strokeWidth={2.25}
                        aria-hidden
                      />
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
                        <Link href={calendarBookingHref as "/final-expense/calendar"}>
                          {t("done.bookCta")}
                        </Link>
                      </Button>
                    </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
