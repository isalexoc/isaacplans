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
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import {
  inspectGmpSelectEvent,
  logFePlaces,
  readPlacePredictionFromGmpSelectEvent,
} from "@/lib/fe-get-covered-places";

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

/** Build ISO `YYYY-MM-DD` from split DOB selects (numeric month/day, 4-digit year). */
function buildDobIsoFromParts(month: string, day: string, year: string): string {
  if (!month?.trim() || !day?.trim() || !year?.trim()) return "";
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  const yNum = Number(year);
  const mNum = Number(month);
  const dNum = Number(day);
  if (!Number.isFinite(yNum) || !Number.isFinite(mNum) || !Number.isFinite(dNum))
    return "";
  const check = new Date(yNum, mNum - 1, dNum);
  if (
    Number.isNaN(check.getTime()) ||
    check.getFullYear() !== yNum ||
    check.getMonth() !== mNum - 1 ||
    check.getDate() !== dNum
  ) {
    return "";
  }
  return `${year}-${m}-${d}`;
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

/**
 * After Places fills the form, small viewports often keep focus/suggestions above the fold.
 * Smooth-scroll to the DOB block on viewports that match our `lg` breakpoint’s “mobile” side (max-width: 1023px).
 */
function scrollDobBlockIntoViewMobileIfNeeded(container: HTMLElement | null) {
  if (typeof window === "undefined" || !container?.isConnected) return;
  if (!window.matchMedia("(max-width: 1023px)").matches) return;

  const run = () => {
    if (!container.isConnected) return;
    const rect = container.getBoundingClientRect();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    if (rect.top >= 40 && rect.bottom <= vh + 32) return;

    container.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(run, 120);
    });
  });
}

type Phase = "contact" | "address" | "done";
type AddressFieldErrorKey = "dob" | "addressLine1" | "city" | "state" | "postalCode";

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
  /** Split DOB is easier than `<input type="date">` for many adults on phones. */
  const [dobMonth, setDobMonth] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [addressScriptLoaded, setAddressScriptLoaded] = useState(false);
  const [addressScriptFailed, setAddressScriptFailed] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addressFieldErrors, setAddressFieldErrors] = useState<Partial<Record<AddressFieldErrorKey, string>>>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);

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
  const selectBase = cn(inputBase, "cursor-pointer");
  const labelBase = "mb-1.5 block text-base font-semibold text-gray-800 dark:text-gray-200";
  const fieldErrorBase = "mt-1.5 text-sm font-medium text-red-600 dark:text-red-400";

  const progress = useMemo(() => (phase === "contact" ? 50 : phase === "address" ? 100 : 100), [phase]);
  const placeAutocompleteContainerRef = useRef<HTMLDivElement | null>(null);
  const dobSectionScrollTargetRef = useRef<HTMLDivElement | null>(null);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  /** After script + importLibrary succeeds, swap line 1 to PlaceAutocompleteElement; until then plain text input (no scary “unavailable” banner). */
  const showPlacesLine1Ui = Boolean(mapsApiKey) && addressScriptLoaded && !addressScriptFailed;

  const dateOfBirth = useMemo(
    () => buildDobIsoFromParts(dobMonth, dobDay, dobYear),
    [dobMonth, dobDay, dobYear],
  );

  const dobBirthYearRange = useMemo(() => {
    const yNow = new Date().getFullYear();
    const max = yNow - 18;
    const min = yNow - 115;
    const years: number[] = [];
    for (let y = max; y >= min; y -= 1) years.push(y);
    return years;
  }, []);
  const pageViewStartedAtRef = useRef<number>(Date.now());
  const startedFieldsRef = useRef<Set<FeGetCoveredFieldId>>(new Set());
  const completedFieldsRef = useRef<Set<FeGetCoveredFieldId>>(new Set());
  const abandonTrackedRef = useRef(false);
  /** Prevents double POST before React re-disables submit (pairs with Meta event_id deduplication server-side). */
  const contactSubmitInFlightRef = useRef(false);

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

  /** `google.maps.importLibrary` is the real readiness signal — not `<Script onLoad>` (that can fire before Maps attaches `importLibrary`). */
  useEffect(() => {
    if (!mapsApiKey) return;
    if (typeof window === "undefined") return;
    const gWin = window as unknown as { google?: { maps?: { importLibrary?: unknown } } };
    if (phase === "address" && gWin.google?.maps?.importLibrary) {
      setAddressScriptLoaded(true);
      setAddressScriptFailed(false);
      logFePlaces("detect:importLibrary-already-available", {});
    }
  }, [mapsApiKey, phase]);

  /** When leaving the address step, reset so a future visit does not reuse stale “loaded” from a half-ready Maps state. */
  useEffect(() => {
    if (phase !== "address") {
      setAddressScriptLoaded(false);
    }
  }, [phase]);

  /** Poll until `importLibrary` exists (script tag loaded ≠ bootstrap complete). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phase !== "address" || !mapsApiKey || addressScriptFailed) return;
    if (addressScriptLoaded) return;

    let attempts = 0;
    const id = window.setInterval(() => {
      attempts += 1;
      const gWin = window as unknown as {
        google?: { maps?: { importLibrary?: unknown } };
      };
      if (gWin.google?.maps?.importLibrary) {
        logFePlaces("poll:importLibrary-ready", {
          attempts,
          elapsedMsApprox: attempts * 100,
        });
        setAddressScriptLoaded(true);
        setAddressScriptFailed(false);
        window.clearInterval(id);
        return;
      }
      if (attempts >= 200) window.clearInterval(id);
    }, 100);

    return () => window.clearInterval(id);
  }, [phase, mapsApiKey, addressScriptLoaded, addressScriptFailed]);

  /** Slow CDN — log only (do not force “manual fallback failed” UX; manual field is always usable). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phase !== "address" || !mapsApiKey) return;
    if (addressScriptLoaded || addressScriptFailed) return;

    const timeoutId = window.setTimeout(() => {
      logFePlaces("slow-load:no-importLibrary-yet-after-25s", {
        tip: 'Check API key referrer restrictions & Maps / Places SKU; set NEXT_PUBLIC_LOG_FE_GET_COVERED_PLACES=true',
      });
    }, 25000);

    return () => window.clearTimeout(timeoutId);
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
      } catch (err) {
        logFePlaces("error", {
          message: String(err instanceof Error ? err.message : err),
          hint: "importLibrary('places') rejected — billing, API enablement, or key restrictions?",
        });
        setAddressScriptFailed(true);
        return;
      }
      if (cancelled || !placeAutocompleteContainerRef.current) return;
      if (!lib || typeof lib !== "object") {
        logFePlaces("error", {
          message: "importLibrary('places') returned empty",
        });
        setAddressScriptFailed(true);
        return;
      }

      const PlaceAutocompleteElement = (lib as { PlaceAutocompleteElement?: new (opts?: object) => HTMLElement })
        .PlaceAutocompleteElement;
      if (!PlaceAutocompleteElement) {
        logFePlaces("error", {
          message: "PlaceAutocompleteElement missing from places library",
          libKeys: Object.keys(lib as object),
        });
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
        inspectGmpSelectEvent(event);
        void (async () => {
          const pred = readPlacePredictionFromGmpSelectEvent(event);
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
              setAddressFieldErrors((prev) => {
                if (!prev.addressLine1) return prev;
                const next = { ...prev };
                delete next.addressLine1;
                return next;
              });
              (el as unknown as { value: string }).value = parsed.line1;
            }
            if (parsed?.city) {
              setCity(parsed.city);
              setAddressFieldErrors((prev) => {
                if (!prev.city) return prev;
                const next = { ...prev };
                delete next.city;
                return next;
              });
            }
            if (parsed?.state) {
              setStateVal(parsed.state);
              setAddressFieldErrors((prev) => {
                if (!prev.state) return prev;
                const next = { ...prev };
                delete next.state;
                return next;
              });
            }
            if (parsed?.zip) {
              setPostalCode(parsed.zip);
              if (/^\d{5}(-\d{4})?$/.test(parsed.zip.trim())) {
                setAddressFieldErrors((prev) => {
                  if (!prev.postalCode) return prev;
                  const next = { ...prev };
                  delete next.postalCode;
                  return next;
                });
              }
            }

            if (parsed?.line1) {
              scrollDobBlockIntoViewMobileIfNeeded(dobSectionScrollTargetRef.current);
            }
          } catch (e) {
            logFePlaces("error", {
              message: String(e instanceof Error ? e.message : e),
              step: "place.fetchFields-or-parse",
            });
            if (process.env.NODE_ENV === "development") {
              console.error("[final-expense/get-covered] Place fetchFields failed:", e);
            }
          }
        })();
      };

      const onInput = () => {
        const value = (el as unknown as { value?: string }).value ?? "";
        setAddressLine1(value);
        if (value.trim()) {
          setAddressFieldErrors((prev) => {
            if (!prev.addressLine1) return prev;
            const next = { ...prev };
            delete next.addressLine1;
            return next;
          });
        }
      };

      setAddressScriptFailed(false);
      el.addEventListener("gmp-select", onSelect as EventListener);
      el.addEventListener("input", onInput);
      if (cancelled || !placeAutocompleteContainerRef.current) return;

      mountRoot.appendChild(el);
      logFePlaces("place-autocomplete:mounted", {});
      try {
        const line = addressLine1.trim();
        if (line && "value" in el) {
          (el as unknown as { value: string }).value = line;
        }
      } catch {
        /* non-fatal */
      }

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

  useEffect(() => {
    if (phase !== "address") return;
    if (!dobMonth && !dobDay && !dobYear) return;
    trackFieldStartedOnce("dob", "address");
    trackFieldCompletedOnce("dob", "address", Boolean(dateOfBirth) && isValidPastOrTodayIsoDate(dateOfBirth));
  }, [
    phase,
    dobMonth,
    dobDay,
    dobYear,
    dateOfBirth,
    trackFieldStartedOnce,
    trackFieldCompletedOnce,
  ]);

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
      if (process.env.NODE_ENV === "development" && capiDispatched !== true) {
        console.warn(
          "[final-expense/get-covered] Meta CAPI Lead was not dispatched. Set META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID; ensure meta.eventId and eventSourceUrl are sent (also sent on duplicate-merge for FE get-covered)."
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

      trackLead(
        {
          contentName: "Final expense — get covered",
          value: 100,
          currency: "USD",
          source: "final_expense_get_covered_ads",
        },
        eventId
      );

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
      contactSubmitInFlightRef.current = false;
      setLoadingContact(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setAddressFieldErrors({});
    trackFeGetCoveredSubmitAttempt({ phase: "address", locale });

    if (!contactId || !email.trim()) {
      setSubmitError(
        isES ? "Sesión inválida. Vuelva a enviar el formulario." : "Invalid session. Please submit the form again."
      );
      return;
    }

    const nextAddressErrors: Partial<Record<AddressFieldErrorKey, string>> = {};
    const dobPartsComplete = Boolean(dobMonth && dobDay && dobYear);
    if (!dobPartsComplete) {
      nextAddressErrors.dob = t("address.requiredDob");
    } else if (!dateOfBirth.trim()) {
      nextAddressErrors.dob = t("address.invalidDob");
    } else if (!isValidPastOrTodayIsoDate(dateOfBirth)) {
      nextAddressErrors.dob = t("address.invalidDob");
    }
    if (!addressLine1.trim()) {
      nextAddressErrors.addressLine1 = tForm("required");
    }
    if (!city.trim()) {
      nextAddressErrors.city = tForm("required");
    }
    if (!stateVal.trim()) {
      nextAddressErrors.state = tForm("required");
    }
    if (!postalCode.trim()) {
      nextAddressErrors.postalCode = tForm("required");
    } else if (!/^\d{5}(-\d{4})?$/.test(postalCode.trim())) {
      nextAddressErrors.postalCode = t("address.invalidZip");
    }
    if (Object.keys(nextAddressErrors).length > 0) {
      setAddressFieldErrors(nextAddressErrors);
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
          dateOfBirth,
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

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      {/* Load Places only on the address step — avoids Maps JS on initial contact step (mobile LCP/TBT). */}
      {mapsApiKey && phase === "address" && (
        <Script
          id="google-maps-places"
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places&loading=async`}
          strategy="afterInteractive"
          onLoad={() => {
            logFePlaces("script:onLoad", {
              note: "Maps JS file loaded; Places mounts only after importLibrary is callable (poll).",
            });
            setAddressScriptFailed(false);
          }}
          onReady={() => {
            logFePlaces("script:onReady", {
              note: "Do not set addressScriptLoaded here — importLibrary may not exist yet.",
            });
            setAddressScriptFailed(false);
          }}
          onError={() => {
            logFePlaces("error", {
              message: "google-maps-places Script failed",
              hint: "Network CSP, blocked key, or Maps JS load error — check DevTools Console/Network.",
            });
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
                      className={cn(phoneInputBase, fieldErrors.phone && "border-red-500")}
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
                      htmlFor="fe-get-covered-street-address-main"
                      className={labelBase}
                    >
                      {t("address.line1")} <span className="text-red-500">*</span>
                    </label>
                    {showPlacesLine1Ui ? (
                      <div
                        className={cn(
                          "min-h-[56px] w-full overflow-visible rounded-lg border-2 border-gray-200 bg-white px-1 transition-all focus-within:border-[hsl(var(--custom))] focus-within:ring-2 focus-within:ring-[hsl(var(--custom)/0.2)] dark:border-gray-700 dark:bg-slate-800/50 dark:focus-within:ring-[hsl(var(--custom)/0.2)]",
                          addressFieldErrors.addressLine1 && "border-red-500",
                        )}
                      >
                        <div ref={placeAutocompleteContainerRef} className="w-full [&_input]:box-border [&_input]:min-h-[52px] [&_input]:w-full [&_input]:rounded-md [&_input]:border-none [&_input]:bg-transparent [&_input]:px-3 [&_input]:py-2 [&_input]:text-[17px]" />
                      </div>
                    ) : (
                      <input
                        id="fe-get-covered-street-address-main"
                        name="streetAddress"
                        type="text"
                        autoComplete="street-address"
                        value={addressLine1}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAddressLine1(value);
                          trackFieldStartedOnce("address_line1", "address");
                          trackFieldCompletedOnce("address_line1", "address", value.trim().length > 0);
                          if (value.trim()) {
                            setAddressFieldErrors((prev) => {
                              if (!prev.addressLine1) return prev;
                              const next = { ...prev };
                              delete next.addressLine1;
                              return next;
                            });
                          }
                        }}
                        className={cn(inputBase, addressFieldErrors.addressLine1 && "border-red-500")}
                        disabled={loadingAddress}
                        aria-label={t("address.line1")}
                      />
                    )}
                    {!showPlacesLine1Ui && mapsApiKey && !addressScriptFailed && (
                      <p className="mt-2 text-[14px] text-slate-500 dark:text-slate-400">{t("address.line1LoadingPlaces")}</p>
                    )}
                    {addressFieldErrors.addressLine1 && (
                      <p className={fieldErrorBase}>{addressFieldErrors.addressLine1}</p>
                    )}
                  </div>

                  {submitError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="fe-get-covered-address2" className={labelBase}>
                      {t("address.line2")}
                    </label>
                    <input
                      id="fe-get-covered-address2"
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className={inputBase}
                      disabled={loadingAddress}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="fe-get-covered-city" className={labelBase}>
                        {t("address.city")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="fe-get-covered-city"
                        type="text"
                        autoComplete="address-level2"
                        value={city}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCity(value);
                          trackFieldStartedOnce("city", "address");
                          trackFieldCompletedOnce("city", "address", value.trim().length > 0);
                          if (value.trim()) {
                            setAddressFieldErrors((prev) => {
                              if (!prev.city) return prev;
                              const next = { ...prev };
                              delete next.city;
                              return next;
                            });
                          }
                        }}
                        className={cn(inputBase, addressFieldErrors.city && "border-red-500")}
                        disabled={loadingAddress}
                      />
                      {addressFieldErrors.city && (
                        <p className={fieldErrorBase}>{addressFieldErrors.city}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelBase} htmlFor="fe-get-covered-state">
                        {t("address.state")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="fe-get-covered-state"
                        title={t("address.state")}
                        value={stateVal}
                        disabled={loadingAddress}
                        aria-label={t("address.state")}
                        onChange={(e) => {
                          const value = e.target.value.slice(0, 2).toUpperCase();
                          setStateVal(value);
                          trackFieldStartedOnce("state", "address");
                          trackFieldCompletedOnce("state", "address", value.trim().length === 2);
                          if (value.length === 2) {
                            setAddressFieldErrors((prev) => {
                              if (!prev.state) return prev;
                              const next = { ...prev };
                              delete next.state;
                              return next;
                            });
                          }
                        }}
                        className={cn(selectBase, addressFieldErrors.state && "border-red-500")}
                      >
                        <option value="">{t("address.chooseState")}</option>
                        {US_STATE_OPTIONS.map((row) => (
                          <option key={row.code} value={row.code}>
                            {row.code} — {row.name}
                          </option>
                        ))}
                      </select>
                      {addressFieldErrors.state && (
                        <p className={fieldErrorBase}>{addressFieldErrors.state}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelBase} htmlFor="fe-get-covered-zip">
                      {t("address.zip")} <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fe-get-covered-zip"
                      type="text"
                      autoComplete="postal-code"
                      inputMode="numeric"
                      value={postalCode}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPostalCode(value);
                        trackFieldStartedOnce("zip", "address");
                        trackFieldCompletedOnce("zip", "address", /^\d{5}(-\d{4})?$/.test(value.trim()));
                        if (/^\d{5}(-\d{4})?$/.test(value.trim())) {
                          setAddressFieldErrors((prev) => {
                            if (!prev.postalCode) return prev;
                            const next = { ...prev };
                            delete next.postalCode;
                            return next;
                          });
                        }
                      }}
                      placeholder="12345"
                      className={cn(inputBase, addressFieldErrors.postalCode && "border-red-500")}
                      disabled={loadingAddress}
                    />
                    {addressFieldErrors.postalCode && (
                      <p className={fieldErrorBase}>{addressFieldErrors.postalCode}</p>
                    )}
                  </div>

                  <div ref={dobSectionScrollTargetRef} className="scroll-mt-6">
                    <p className={labelBase}>
                      {t("address.dob")} <span className="text-red-500">*</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label htmlFor="fe-get-covered-dob-m" className="sr-only">
                          {t("address.month")}
                        </label>
                        <select
                          id="fe-get-covered-dob-m"
                          value={dobMonth}
                          disabled={loadingAddress}
                          onChange={(e) => {
                            setDobMonth(e.target.value);
                            setAddressFieldErrors((prev) => {
                              if (!prev.dob) return prev;
                              const next = { ...prev };
                              delete next.dob;
                              return next;
                            });
                          }}
                          className={cn(selectBase, addressFieldErrors.dob && "border-red-500")}
                          aria-label={t("address.month")}
                        >
                          <option value="">{t("address.month")}</option>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                            <option key={m} value={m}>
                              {m.padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="fe-get-covered-dob-d" className="sr-only">
                          {t("address.day")}
                        </label>
                        <select
                          id="fe-get-covered-dob-d"
                          value={dobDay}
                          disabled={loadingAddress}
                          onChange={(e) => {
                            setDobDay(e.target.value);
                            setAddressFieldErrors((prev) => {
                              if (!prev.dob) return prev;
                              const next = { ...prev };
                              delete next.dob;
                              return next;
                            });
                          }}
                          className={cn(selectBase, addressFieldErrors.dob && "border-red-500")}
                          aria-label={t("address.day")}
                        >
                          <option value="">{t("address.day")}</option>
                          {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                            <option key={d} value={d}>
                              {d.padStart(2, "0")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="fe-get-covered-dob-y" className="sr-only">
                          {t("address.year")}
                        </label>
                        <select
                          id="fe-get-covered-dob-y"
                          value={dobYear}
                          disabled={loadingAddress}
                          onChange={(e) => {
                            setDobYear(e.target.value);
                            setAddressFieldErrors((prev) => {
                              if (!prev.dob) return prev;
                              const next = { ...prev };
                              delete next.dob;
                              return next;
                            });
                          }}
                          className={cn(selectBase, addressFieldErrors.dob && "border-red-500")}
                          aria-label={t("address.year")}
                        >
                          <option value="">{t("address.year")}</option>
                          {dobBirthYearRange.map((y) => (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {addressFieldErrors.dob && <p className={fieldErrorBase}>{addressFieldErrors.dob}</p>}
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
