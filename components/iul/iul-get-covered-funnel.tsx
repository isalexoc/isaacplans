"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronsUpDown,
  Contact,
  Loader2,
  Phone,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT,
  FINAL_EXPENSE_GET_COVERED_VCARD_URL,
  getIulGetCoveredHeroImageUrl,
} from "@/lib/get-covered-fast/constants";
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import { shortTermMedicalFormSchema, capitalizeName } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import { appendAgentCrmBookingPrefill } from "@/lib/agent-crm-booking-url";
import {
  trackIulGetCoveredAbandon,
  trackIulGetCoveredFieldCompleted,
  trackIulGetCoveredFieldStarted,
  trackIulGetCoveredPhase,
  trackIulGetCoveredSubmitAttempt,
  trackIulGetCoveredSubmitSuccess,
  type IulGetCoveredFieldId,
} from "@/lib/analytics/iul-get-covered-ga";

/** CRM line — same as site header / contact */
const CRM_PHONE_TEL = "tel:+15404261804";
const CRM_PHONE_DISPLAY = "540-426-1804";
const WHATSAPP_CHAT_HREF = "https://wa.me/15406813507";

/** Lead value reported to Meta. IUL is higher-value than FE — tune for value-based bidding. */
const IUL_LEAD_VALUE = 100;

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  const parsed = parsePhoneNumber(phone, "US");
  return parsed?.number;
}

/** Quiz answers stored as keys for selection; mapped to readable labels for the CRM note. */
const RETIREMENT_OPTIONS = ["within-10", "within-20", "within-30", "retired", "other"] as const;
const RETIREMENT_LABELS: Record<string, string> = {
  "within-10": "Within 10 Years",
  "within-20": "Within 20 Years",
  "within-30": "Within 30 Years",
  retired: "Currently Retired",
};
const SAVINGS_OPTIONS = ["less-300", "300-500", "500-1000", "more-1000"] as const;
const SAVINGS_LABELS: Record<string, string> = {
  "less-300": "Less than $300",
  "300-500": "$300 - $500",
  "500-1000": "$500 - $1,000",
  "more-1000": "More than $1,000",
};
const INVESTMENT_OPTIONS = [
  { key: "401k", value: "401(k)" },
  { key: "ira", value: "IRA" },
  { key: "cashSavings", value: "Cash Savings" },
  { key: "activeTrading", value: "Active Trading" },
  { key: "selfDirected", value: "Self Directed Brokerage Account" },
  { key: "none", value: "No current investments" },
] as const;

const QUIZ_STEPS = ["age", "state", "savings", "retirement", "investments"] as const;
type QuizStep = (typeof QUIZ_STEPS)[number];
type Phase = "contact" | "quiz" | "done";

export default function IulGetCoveredFunnel() {
  const locale = useLocale();
  const isES = locale.startsWith("es");
  const t = useTranslations("iulGetCoveredPage.funnel");
  const tForm = useTranslations("contactPage.info.form");
  const tQuiz = useTranslations("iulQuote.form");

  const [phase, setPhase] = useState<Phase>("contact");

  // Contact (Step 1)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [contactId, setContactId] = useState<string | null>(null);

  // Quiz (Step 2)
  const [quizIndex, setQuizIndex] = useState(0);
  const [retirementTimeline, setRetirementTimeline] = useState("");
  const [retirementOther, setRetirementOther] = useState("");
  const [monthlySavings, setMonthlySavings] = useState("");
  const [investments, setInvestments] = useState<string[]>([]);
  const [age, setAge] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [stateOpen, setStateOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [quizError, setQuizError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);

  const quizStep: QuizStep = QUIZ_STEPS[quizIndex];

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
  const optionBase =
    "flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-[16px] transition-all";
  const optionClass = (selected: boolean) =>
    cn(
      optionBase,
      selected
        ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.06)] dark:bg-[hsl(var(--custom)/0.12)]"
        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
    );

  const progress = phase === "contact" ? 50 : 100;

  const pageViewStartedAtRef = useRef<number>(Date.now());
  const startedFieldsRef = useRef<Set<IulGetCoveredFieldId>>(new Set());
  const completedFieldsRef = useRef<Set<IulGetCoveredFieldId>>(new Set());
  const abandonTrackedRef = useRef(false);
  /** Prevents double POST before React re-disables submit (pairs with Meta event_id dedup server-side). */
  const contactSubmitInFlightRef = useRef(false);
  const quizSubmitInFlightRef = useRef(false);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quizCardRef = useRef<HTMLDivElement | null>(null);

  const calendarBookingHref = useMemo(() => {
    const phoneE164 = parsePhoneNumber(phone, "US")?.number?.trim() ?? "";
    return appendAgentCrmBookingPrefill("/iul/calendar", {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phoneE164,
    });
  }, [firstName, lastName, email, phone]);

  /** GA4: one event per funnel phase (contact → quiz → done). Does not affect Meta Pixel/CAPI. */
  useEffect(() => {
    trackIulGetCoveredPhase({ phase, locale });
  }, [phase, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const trackAbandon = () => {
      if (abandonTrackedRef.current) return;
      if (phase === "done") return;
      const elapsedSeconds = Math.max(
        0,
        Math.round((Date.now() - pageViewStartedAtRef.current) / 1000)
      );
      trackIulGetCoveredAbandon({
        phase: phase as "contact" | "quiz",
        locale,
        time_on_page_seconds: elapsedSeconds,
      });
      abandonTrackedRef.current = true;
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") trackAbandon();
    };
    window.addEventListener("pagehide", trackAbandon);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", trackAbandon);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [phase, locale]);

  /** Position the TOP of the form card in view when entering quiz / done and on each
   *  quiz step (mobile-first: phones vary in height). We defer to the next frame so the
   *  new step's layout is committed first, and the card's `scroll-mt-*` offsets the
   *  pinned (Headroom) header so the question heading is never hidden under it. */
  useLayoutEffect(() => {
    if (phase === "contact") return;
    if (typeof window === "undefined") return;
    const el = quizCardRef.current;
    if (!el) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "auto", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, quizIndex]);

  useEffect(() => {
    if (!stateOpen) setStateSearch("");
  }, [stateOpen]);

  useEffect(
    () => () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    },
    []
  );

  const trackFieldStartedOnce = (
    fieldId: IulGetCoveredFieldId,
    phaseForEvent: "contact" | "quiz"
  ) => {
    if (startedFieldsRef.current.has(fieldId)) return;
    startedFieldsRef.current.add(fieldId);
    trackIulGetCoveredFieldStarted({ field_id: fieldId, phase: phaseForEvent, locale });
  };

  const trackFieldCompletedOnce = (
    fieldId: IulGetCoveredFieldId,
    phaseForEvent: "contact" | "quiz",
    isValidValue: boolean
  ) => {
    if (!isValidValue) return;
    if (completedFieldsRef.current.has(fieldId)) return;
    completedFieldsRef.current.add(fieldId);
    trackIulGetCoveredFieldCompleted({ field_id: fieldId, phase: phaseForEvent, locale });
  };

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
    trackIulGetCoveredSubmitAttempt({ phase: "contact", locale });

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
          iulLeadGenData: {
            language: isES ? "es" : "en",
            source: "iul_get_covered_ads",
            campaign: "iul_get_covered",
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
        throw new Error(
          isES ? "Respuesta inválida del servidor." : "Invalid server response."
        );
      }
      trackIulGetCoveredSubmitSuccess({ phase: "contact", locale });

      const capiDispatched = (data as { capiDispatched?: boolean }).capiDispatched;
      if (process.env.NODE_ENV === "development" && capiDispatched !== true) {
        console.warn(
          "[iul/get-covered] Meta CAPI Lead was not dispatched. Set META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID; ensure meta.eventId and eventSourceUrl are sent (also sent on duplicate-merge for the iul_get_covered_ads source)."
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
          contentName: "IUL — get covered",
          value: IUL_LEAD_VALUE,
          currency: "USD",
          source: "iul_get_covered_ads",
        },
        eventId
      );

      setPhase("quiz");
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

  const ageNum = Number(age);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 85;

  /** Readable retirement answer ("Other" → the typed text). */
  const retirementValue =
    retirementTimeline === "other"
      ? retirementOther.trim()
      : RETIREMENT_LABELS[retirementTimeline] || retirementTimeline;

  /**
   * Fire-and-forget background save of Step-2 answers to the CRM. Never awaited, errors
   * swallowed, `keepalive` so it completes even if the user navigates away. The contact
   * already exists (created in Step 1), so this only enriches it.
   */
  const saveStep2Partial = (partial: Record<string, unknown>) => {
    if (!contactId || !email.trim()) return;
    const phoneE164 = parsePhoneNumber(phone, "US")?.number;
    try {
      void fetch("/api/contact-append-iul", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          contactId,
          email: email.trim().toLowerCase(),
          phone: phoneE164,
          ...partial,
        }),
      }).catch(() => {});
    } catch {
      /* fire-and-forget */
    }
  };

  /** The CRM payload for the current step's answer (used when advancing forward). */
  const buildStepPartial = (step: QuizStep): Record<string, unknown> | null => {
    switch (step) {
      case "age":
        return age.trim() ? { age: age.trim() } : null;
      case "state":
        return stateVal ? { state: stateVal } : null;
      case "savings":
        return monthlySavings
          ? { monthlySavings: SAVINGS_LABELS[monthlySavings] || monthlySavings }
          : null;
      case "retirement":
        return retirementValue ? { retirementTimeline: retirementValue } : null;
      case "investments":
        return investments.length ? { investments } : null;
      default:
        return null;
    }
  };

  const goNextQuiz = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setQuizError(null);
    setQuizIndex((i) => Math.min(i + 1, QUIZ_STEPS.length - 1));
  };

  const goBackQuiz = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setQuizError(null);
    setQuizIndex((i) => Math.max(0, i - 1));
  };

  const scheduleAutoAdvance = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      setQuizError(null);
      setQuizIndex((i) => Math.min(i + 1, QUIZ_STEPS.length - 1));
    }, 500);
  };

  const canProceedQuiz = (step: QuizStep): boolean => {
    switch (step) {
      case "retirement":
        return retirementTimeline === "other"
          ? retirementOther.trim().length > 0
          : !!retirementTimeline;
      case "savings":
        return !!monthlySavings;
      case "investments":
        return investments.length > 0;
      case "age":
        return ageValid;
      case "state":
        return !!stateVal;
      default:
        return false;
    }
  };

  const handleQuizNext = () => {
    if (canProceedQuiz(quizStep)) {
      // Save the current answer in the background, then advance (also covers back-edits).
      const partial = buildStepPartial(quizStep);
      if (partial) saveStep2Partial(partial);
      goNextQuiz();
      return;
    }
    if (quizStep === "investments") setQuizError(t("quiz.investmentsError"));
    else if (quizStep === "age") setQuizError(t("quiz.ageError"));
    else setQuizError(t("quiz.selectError"));
  };

  const handleInvestmentToggle = (value: string) => {
    setQuizError(null);
    setInvestments((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
    trackFieldStartedOnce("investments", "quiz");
  };

  const handleQuizSubmit = () => {
    setSubmitError(null);
    if (!investments.length) {
      setQuizError(t("quiz.investmentsError"));
      return;
    }
    if (!contactId || !email.trim()) {
      setSubmitError(t("quiz.sessionError"));
      return;
    }
    if (quizSubmitInFlightRef.current) return;
    quizSubmitInFlightRef.current = true;
    trackIulGetCoveredSubmitAttempt({ phase: "quiz", locale });

    // Final save: full snapshot + lead_source_details. Background (keepalive) — go to done now.
    saveStep2Partial({
      age: age.trim() || undefined,
      state: stateVal || undefined,
      monthlySavings: monthlySavings
        ? SAVINGS_LABELS[monthlySavings] || monthlySavings
        : undefined,
      retirementTimeline: retirementValue || undefined,
      investments,
      final: true,
    });

    trackIulGetCoveredSubmitSuccess({ phase: "quiz", locale });
    setPhase("done");
  };

  const isLastQuizStep = quizStep === "investments";

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
            src={getIulGetCoveredHeroImageUrl(locale)}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 0px, 46vw"
            className="object-cover object-center"
          />
          {/* Targeted scrim over the mid-image gap (between the couple and the agent) where
              the headline sits — keeps the couple up top and the agent below both bright. */}
          <div
            className="absolute inset-0 bg-[radial-gradient(135%_62%_at_42%_42%,rgba(0,0,0,0.7),rgba(0,0,0,0.12)_72%)]"
            aria-hidden
          />
          {/* Headline centered in the gap between the couple (top) and the agent (bottom). */}
          <div className="absolute inset-x-0 top-[42%] flex -translate-y-1/2 flex-col px-10 xl:px-12">
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
            {/* Mobile-only hero — desktop uses the split image panel */}
            <div className="mb-6 lg:hidden">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.1)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.2)]">
                <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("hero.badge")}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {t("hero.title")}
              </h1>
              <p className="mt-2 text-sm leading-snug text-slate-600 dark:text-slate-400 sm:text-base">
                {t("hero.mobileSubtitle")}
              </p>
            </div>

            {/* Step 1 keeps the exact FE progress chrome; the quiz hides it on purpose. */}
            {phase === "contact" && (
              <>
                <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:text-xs">
                    {t("progress.step", { current: 1, total: 2 })}
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
                        i === 0
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
              </>
            )}

            <div
              ref={quizCardRef}
              className="mt-7 scroll-mt-24 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 sm:p-7 sm:px-8"
            >
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
                        trackFieldStartedOnce("phone", "contact");
                        trackFieldCompletedOnce(
                          "phone",
                          "contact",
                          Boolean(parsePhoneNumber(value, "US")?.number)
                        );
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

              {phase === "quiz" && (
                <div className="space-y-6">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={quizStep}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      {quizStep === "retirement" && (
                        <div>
                          <Label className="mb-4 block text-lg font-semibold text-slate-900 dark:text-white">
                            {tQuiz("steps.1.title")}
                          </Label>
                          <RadioGroup
                            value={retirementTimeline}
                            onValueChange={(value) => {
                              setRetirementTimeline(value);
                              setQuizError(null);
                              if (value === "other") {
                                // Wait for the typed value + Next (no auto-advance).
                                if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
                                return;
                              }
                              trackFieldCompletedOnce("retirement_timeline", "quiz", true);
                              saveStep2Partial({
                                retirementTimeline: RETIREMENT_LABELS[value] || value,
                              });
                              scheduleAutoAdvance();
                            }}
                            className="space-y-3"
                          >
                            {RETIREMENT_OPTIONS.map((opt) => (
                              <label
                                key={opt}
                                htmlFor={`retire-${opt}`}
                                className={optionClass(retirementTimeline === opt)}
                              >
                                <RadioGroupItem value={opt} id={`retire-${opt}`} />
                                <span className="flex-1">
                                  {opt === "other"
                                    ? t("quiz.retirementOther.label")
                                    : tQuiz(`steps.1.options.${opt}`)}
                                </span>
                              </label>
                            ))}
                          </RadioGroup>
                          {retirementTimeline === "other" && (
                            <Input
                              type="text"
                              value={retirementOther}
                              onChange={(e) => {
                                setRetirementOther(e.target.value);
                                setQuizError(null);
                              }}
                              placeholder={t("quiz.retirementOther.placeholder")}
                              className="mt-3 h-14 text-[17px]"
                              autoFocus
                            />
                          )}
                        </div>
                      )}

                      {quizStep === "savings" && (
                        <div>
                          <Label className="mb-4 block text-lg font-semibold text-slate-900 dark:text-white">
                            {tQuiz("steps.3.title")}
                          </Label>
                          <RadioGroup
                            value={monthlySavings}
                            onValueChange={(value) => {
                              setMonthlySavings(value);
                              setQuizError(null);
                              trackFieldCompletedOnce("monthly_savings", "quiz", true);
                              saveStep2Partial({
                                monthlySavings: SAVINGS_LABELS[value] || value,
                              });
                              scheduleAutoAdvance();
                            }}
                            className="space-y-3"
                          >
                            {SAVINGS_OPTIONS.map((opt) => (
                              <label
                                key={opt}
                                htmlFor={`save-${opt}`}
                                className={optionClass(monthlySavings === opt)}
                              >
                                <RadioGroupItem value={opt} id={`save-${opt}`} />
                                <span className="flex-1">{tQuiz(`steps.3.options.${opt}`)}</span>
                              </label>
                            ))}
                          </RadioGroup>
                        </div>
                      )}

                      {quizStep === "investments" && (
                        <div>
                          <Label className="mb-1 block text-lg font-semibold text-slate-900 dark:text-white">
                            {tQuiz("steps.2.title")}
                          </Label>
                          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
                            {tQuiz("steps.2.subtitle")}
                          </p>
                          <div className="space-y-3">
                            {INVESTMENT_OPTIONS.map(({ key, value }) => (
                              <label
                                key={key}
                                htmlFor={`inv-${key}`}
                                className={optionClass(investments.includes(value))}
                              >
                                <Checkbox
                                  id={`inv-${key}`}
                                  checked={investments.includes(value)}
                                  onCheckedChange={() => handleInvestmentToggle(value)}
                                />
                                <span className="flex-1">{tQuiz(`steps.2.options.${key}`)}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {quizStep === "age" && (
                        <div>
                          <Label htmlFor="iul-age" className="mb-4 block text-lg font-semibold text-slate-900 dark:text-white">
                            {tQuiz("steps.4.title")}
                          </Label>
                          <Input
                            id="iul-age"
                            type="number"
                            inputMode="numeric"
                            min={18}
                            max={85}
                            value={age}
                            onChange={(e) => {
                              setAge(e.target.value.replace(/\D/g, "").slice(0, 3));
                              setQuizError(null);
                              trackFieldStartedOnce("age", "quiz");
                            }}
                            placeholder={t("quiz.age.placeholder")}
                            className="h-14 text-[17px]"
                          />
                        </div>
                      )}

                      {quizStep === "state" && (
                        <div>
                          <Label className="mb-4 block text-lg font-semibold text-slate-900 dark:text-white">
                            {tQuiz("steps.5.title")}
                          </Label>
                          <Popover open={stateOpen} onOpenChange={setStateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={stateOpen}
                                className="h-14 w-full justify-between text-base font-normal"
                              >
                                {stateVal
                                  ? US_STATE_OPTIONS.find((s) => s.code === stateVal)?.name
                                  : tQuiz("steps.5.placeholder")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[var(--radix-popover-trigger-width)] p-0"
                              align="start"
                            >
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder={tQuiz("steps.5.searchPlaceholder")}
                                  value={stateSearch}
                                  onValueChange={setStateSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>{tQuiz("steps.5.noResults")}</CommandEmpty>
                                  <CommandGroup>
                                    {(() => {
                                      const searchLower = stateSearch.toLowerCase().trim();
                                      const filtered = US_STATE_OPTIONS.filter((s) => {
                                        if (!searchLower) return true;
                                        const nameLower = s.name.toLowerCase();
                                        const codeLower = s.code.toLowerCase();
                                        if (
                                          nameLower.startsWith(searchLower) ||
                                          codeLower.startsWith(searchLower)
                                        )
                                          return true;
                                        if (
                                          nameLower
                                            .split(/\s+/)
                                            .some((w) => w.startsWith(searchLower))
                                        )
                                          return true;
                                        if (searchLower.length >= 3 && nameLower.includes(searchLower))
                                          return true;
                                        return false;
                                      });
                                      return filtered.map((s) => (
                                        <CommandItem
                                          key={s.code}
                                          value={`${s.name} ${s.code}`}
                                          onSelect={() => {
                                            setStateVal(s.code);
                                            setStateOpen(false);
                                            setStateSearch("");
                                            setQuizError(null);
                                            trackFieldCompletedOnce("state", "quiz", true);
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              stateVal === s.code ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {s.name}
                                        </CommandItem>
                                      ));
                                    })()}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {quizError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {quizError}
                    </div>
                  )}
                  {submitError && (
                    <div className="rounded-lg border-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {submitError}
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    {quizIndex > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={goBackQuiz}
                        className="h-14 shrink-0 gap-2 rounded-xl border-2 px-4 text-base"
                      >
                        <ArrowLeft className="h-4 w-4 shrink-0" />
                        <span className="whitespace-nowrap">{t("quiz.back")}</span>
                      </Button>
                    )}

                    {isLastQuizStep ? (
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleQuizSubmit}
                        className="h-14 min-w-0 flex-1 rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-base font-semibold text-white shadow-lg"
                      >
                        <span className="truncate">{t("quiz.cta")}</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="lg"
                        onClick={handleQuizNext}
                        className="h-14 min-w-0 flex-1 gap-2 rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-base font-semibold text-white shadow-lg"
                      >
                        <span className="truncate">{t("quiz.next")}</span>
                        <ArrowRight className="h-4 w-4 shrink-0" />
                      </Button>
                    )}
                  </div>
                </div>
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
                        <Link href={calendarBookingHref as "/iul/calendar"}>
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
                      <Link href="/iul/apply">{t("done.applyCta")}</Link>
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
