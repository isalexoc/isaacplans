"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AcaLeadForm from "@/components/aca-lead-form";
import ContactLeadForm from "@/components/contact-lead-form";
import DentalVisionLeadForm from "@/components/dental-vision-lead-form";
import { QuoteModalGeneral } from "@/components/form-modal-general";
import { QuoteModal as DentalQuoteModal } from "@/components/form-modal-dental";
import { QuoteModal as HospitalIndemnityQuoteModal } from "@/components/form-modal-hi";
import { ShortTermMedicalQuoteModal } from "@/components/form-modal-short-term-medical";
import HospitalIndemnityLeadForm from "@/components/hospital-indemnity-lead-form";
import ShortTermMedicalLeadForm from "@/components/short-term-medical-lead-form";
import { GCF_CARRIER_LOGOS } from "@/lib/get-covered-fast/carrier-logos";
import {
  GET_COVERED_FAST_HERO_IMAGE,
  HEALTH_SHERPA_AGENT_URL,
} from "@/lib/get-covered-fast/constants";
import {
  DENTAL_VISION_SELF_ENROLL_PATHNAME,
  HOSPITAL_INDEMNITY_SELF_ENROLL_PATHNAME,
  getRecommendation,
  pathToPathname,
  withGcfQuery,
  type GetCoveredFastAnswers,
  type Intent,
  type RecommendationPath,
} from "@/lib/get-covered-fast/recommendations";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Laptop,
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  Shield,
  User,
  UserPlus,
  UsersRound,
  Zap,
} from "lucide-react";

const TOTAL_STEPS = 5;
/** Pause after a choice so the selection reads before the next step animates in. */
const QUIZ_SELECTION_DELAY_MS = 300;

/** Passed to embedded lead forms so CRM can attribute the lead to this funnel. */
const GCF_LEAD_SOURCE = "get_covered_fast";

const INTENTS: Intent[] = [
  "aca",
  "temporary",
  "dentalVision",
  "hospitalIndemnity",
  "unsure",
];

const WHO_KEYS = ["self", "family", "other"] as const;

const WHO_OPTIONS: { key: (typeof WHO_KEYS)[number]; Icon: LucideIcon }[] = [
  { key: "self", Icon: User },
  { key: "family", Icon: UsersRound },
  { key: "other", Icon: UserPlus },
];
const TIMING_KEYS = ["asap", "thisMonth", "exploring"] as const;

const TIMING_OPTIONS: { key: (typeof TIMING_KEYS)[number]; Icon: LucideIcon }[] = [
  { key: "asap", Icon: Zap },
  { key: "thisMonth", Icon: CalendarDays },
  { key: "exploring", Icon: Compass },
];
const PREF_KEYS = ["selfEnroll", "helpFirst"] as const;

const PREF_OPTIONS: { key: (typeof PREF_KEYS)[number]; Icon: LucideIcon }[] = [
  { key: "selfEnroll", Icon: Laptop },
  { key: "helpFirst", Icon: MessageCircle },
];

type Props = {
  licensedStateCount: number;
};

export default function GetCoveredFastFunnel({ licensedStateCount }: Props) {
  const t = useTranslations("getCoveredFastPage.funnel");
  const tHero = useTranslations("getCoveredFastPage.hero");
  const locale = useLocale();
  const isES = locale.startsWith("es");

  const [phase, setPhase] = useState<"quiz" | "result">("quiz");
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<GetCoveredFastAnswers>({});

  const [zipError, setZipError] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipSearchLine, setZipSearchLine] = useState(0);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [isAdvancingStep, setIsAdvancingStep] = useState(false);
  const quizAdvanceTimeoutRef = useRef<number | null>(null);

  const clearQuizAdvanceTimer = useCallback(() => {
    if (quizAdvanceTimeoutRef.current) {
      clearTimeout(quizAdvanceTimeoutRef.current);
      quizAdvanceTimeoutRef.current = null;
    }
    setIsAdvancingStep(false);
  }, []);

  /** Clears any pending timer and runs `action` after the delay (re-starts if user taps another option). */
  const scheduleAfterSelection = useCallback((action: () => void) => {
    if (quizAdvanceTimeoutRef.current) {
      clearTimeout(quizAdvanceTimeoutRef.current);
      quizAdvanceTimeoutRef.current = null;
    }
    setIsAdvancingStep(true);
    quizAdvanceTimeoutRef.current = window.setTimeout(() => {
      action();
      setIsAdvancingStep(false);
      quizAdvanceTimeoutRef.current = null;
    }, QUIZ_SELECTION_DELAY_MS);
  }, []);

  useEffect(() => () => clearQuizAdvanceTimer(), [clearQuizAdvanceTimer]);

  const zipSearchingLines = useMemo(
    () => [
      t("steps.zip.searchingLine1"),
      t("steps.zip.searchingLine2"),
      t("steps.zip.searchingLine3"),
    ],
    [t]
  );

  useEffect(() => {
    if (!zipLoading) {
      setZipSearchLine(0);
      return;
    }
    const id = window.setInterval(() => {
      setZipSearchLine((i) => (i + 1) % zipSearchingLines.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [zipLoading, zipSearchingLines.length]);

  const recommendation = useMemo(
    () => (phase === "result" ? getRecommendation(answers) : null),
    [phase, answers]
  );

  const progressPct = ((step + 1) / TOTAL_STEPS) * 100;

  const canNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        return /^\d{5}$/.test(answers.zip?.trim() ?? "");
      case 1:
        return !!answers.intent;
      case 2:
        return !!answers.who;
      case 3:
        return !!answers.timing;
      case 4:
        return !!answers.preference;
      default:
        return false;
    }
  }, [step, answers]);

  const validateZipFormat = (): boolean => {
    const z = answers.zip?.trim() ?? "";
    if (!/^\d{5}$/.test(z)) {
      setZipError(t("steps.zip.invalid"));
      return false;
    }
    setZipError(null);
    return true;
  };

  const goNext = async () => {
    if (step === 0) {
      if (!validateZipFormat()) return;
      setZipLoading(true);
      setZipError(null);
      try {
        const res = await fetch(
          `/api/zip-lookup?zip=${encodeURIComponent(answers.zip!.trim())}`
        );
        const data = (await res.json()) as {
          state?: string;
          stateName?: string;
          placeName?: string;
          error?: string;
        };
        if (!res.ok) {
          setZipError(t("steps.zip.lookupFailed"));
          return;
        }
        setAnswers((a) => ({
          ...a,
          state: data.state,
          stateName: data.stateName,
          placeName: data.placeName,
        }));
        setStep(1);
      } catch {
        setZipError(t("steps.zip.lookupFailed"));
      } finally {
        setZipLoading(false);
      }
      return;
    }

    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      setPhase("result");
    }
  };

  const goBack = () => {
    clearQuizAdvanceTimer();
    if (step > 0) {
      setStep((s) => s - 1);
      if (step === 1) {
        setZipError(null);
      }
    }
  };

  const restart = () => {
    clearQuizAdvanceTimer();
    setPhase("quiz");
    setStep(0);
    setAnswers({});
    setZipError(null);
    setContactModalOpen(false);
  };

  const renderResultLeadForm = (path: RecommendationPath) => {
    switch (path) {
      case "aca":
        return <AcaLeadForm source={GCF_LEAD_SOURCE} />;
      case "temporary":
        return <ShortTermMedicalLeadForm source={GCF_LEAD_SOURCE} />;
      case "dentalVision":
        return <DentalVisionLeadForm source={GCF_LEAD_SOURCE} />;
      case "hospitalIndemnity":
        return <HospitalIndemnityLeadForm source={GCF_LEAD_SOURCE} />;
      case "carriers":
      case "contact":
        return <ContactLeadForm source={GCF_LEAD_SOURCE} />;
      default:
        return <ContactLeadForm source={GCF_LEAD_SOURCE} />;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        if (zipLoading) {
          return (
            <div
              className="flex min-h-[280px] flex-col items-center justify-center py-4 text-center"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="relative mx-auto mb-8 h-28 w-28">
                <span
                  className="absolute inset-0 rounded-full bg-[hsl(var(--custom)/0.12)] motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
                  aria-hidden
                />
                <span
                  className="absolute inset-3 rounded-full bg-[hsl(var(--custom)/0.1)] motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
                  style={{ animationDelay: "0.6s" }}
                  aria-hidden
                />
                <span
                  className="absolute inset-6 rounded-full bg-[hsl(var(--custom)/0.08)] motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]"
                  style={{ animationDelay: "1.2s" }}
                  aria-hidden
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--custom)/0.25)] to-blue-600/25 shadow-lg ring-2 ring-[hsl(var(--custom)/0.2)] dark:from-[hsl(var(--custom)/0.2)] dark:to-blue-500/20">
                    <Search
                      className="h-8 w-8 text-[hsl(var(--custom))] motion-safe:animate-[pulse_2s_ease-in-out_infinite]"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                {t("steps.zip.searchingTitle")}
              </h2>
              <div className="relative mx-auto mt-3 min-h-[1.5rem] max-w-sm">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={zipSearchLine}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="text-sm text-slate-600 dark:text-slate-400"
                  >
                    {zipSearchingLines[zipSearchLine]}
                  </motion.p>
                </AnimatePresence>
              </div>
              <div className="relative mt-10 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <motion.div
                  className="absolute inset-y-0 w-2/5 rounded-full bg-gradient-to-r from-[hsl(var(--custom))] via-cyan-400 to-blue-600 shadow-sm"
                  animate={{ left: ["-40%", "100%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.35,
                    ease: "easeInOut",
                  }}
                />
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.zip.title")}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("steps.zip.subtitle")}
            </p>
            <div className="relative mx-auto mt-8 max-w-md">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder={t("steps.zip.placeholder")}
                aria-invalid={!!zipError}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-4 text-center text-xl font-medium tracking-[0.35em] text-slate-900 shadow-inner outline-none transition focus:border-[hsl(var(--custom))] focus:ring-2 focus:ring-[hsl(var(--custom)/0.25)] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                value={answers.zip ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                  setAnswers((a) => ({
                    ...a,
                    zip: v,
                    state: undefined,
                    stateName: undefined,
                    placeName: undefined,
                  }));
                  setZipError(null);
                }}
              />
            </div>
            {zipError && (
              <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                {zipError}
              </p>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.intent.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("steps.intent.subtitle")}
            </p>
            <div
              className="mx-auto mt-6 max-w-md space-y-2 text-left"
              aria-busy={isAdvancingStep}
            >
              {INTENTS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setAnswers((a) => ({ ...a, intent: key }));
                    scheduleAfterSelection(() => setStep(2));
                  }}
                  className={cn(
                    "w-full rounded-xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all duration-200",
                    answers.intent === key
                      ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.1)] text-slate-900 shadow-sm dark:text-white"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/80",
                    isAdvancingStep && answers.intent === key && "motion-safe:scale-[1.02] ring-2 ring-[hsl(var(--custom)/0.35)]"
                  )}
                >
                  {t(`options.intent.${key}`)}
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.who.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("steps.who.subtitle")}
            </p>
            <div
              className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
              aria-busy={isAdvancingStep}
            >
              {WHO_OPTIONS.map(({ key, Icon }) => {
                const selected = answers.who === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setAnswers((a) => ({ ...a, who: key }));
                      scheduleAfterSelection(() => setStep(3));
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-5 text-center transition-all duration-200",
                      "motion-safe:sm:hover:-translate-y-0.5 motion-safe:sm:hover:shadow-md",
                      selected
                        ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.12)] shadow-md ring-2 ring-[hsl(var(--custom)/0.25)] dark:bg-[hsl(var(--custom)/0.15)]"
                        : "border-slate-200 bg-white hover:border-[hsl(var(--custom)/0.45)] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-[hsl(var(--custom)/0.5)]",
                      isAdvancingStep && selected && "motion-safe:scale-[1.03]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200",
                        selected
                          ? "bg-[hsl(var(--custom))] text-white shadow-inner"
                          : "bg-slate-100 text-slate-600 group-hover:bg-[hsl(var(--custom)/0.15)] group-hover:text-[hsl(var(--custom))] dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-[hsl(var(--custom)/0.2)] dark:group-hover:text-[hsl(var(--custom))]"
                      )}
                    >
                      <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold leading-snug",
                        selected
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-800 dark:text-slate-100"
                      )}
                    >
                      {t(`options.who.${key}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.timing.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("steps.timing.subtitle")}
            </p>
            <div
              className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
              aria-busy={isAdvancingStep}
            >
              {TIMING_OPTIONS.map(({ key, Icon }) => {
                const selected = answers.timing === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setAnswers((a) => ({
                        ...a,
                        timing: key as GetCoveredFastAnswers["timing"],
                      }));
                      scheduleAfterSelection(() => setStep(4));
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-5 text-center transition-all duration-200",
                      "motion-safe:sm:hover:-translate-y-0.5 motion-safe:sm:hover:shadow-md",
                      selected
                        ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.12)] shadow-md ring-2 ring-[hsl(var(--custom)/0.25)] dark:bg-[hsl(var(--custom)/0.15)]"
                        : "border-slate-200 bg-white hover:border-[hsl(var(--custom)/0.45)] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-[hsl(var(--custom)/0.5)]",
                      isAdvancingStep && selected && "motion-safe:scale-[1.03]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200",
                        selected
                          ? "bg-[hsl(var(--custom))] text-white shadow-inner"
                          : "bg-slate-100 text-slate-600 group-hover:bg-[hsl(var(--custom)/0.15)] group-hover:text-[hsl(var(--custom))] dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-[hsl(var(--custom)/0.2)] dark:group-hover:text-[hsl(var(--custom))]"
                      )}
                    >
                      <Icon className="h-7 w-7" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "text-sm font-semibold leading-snug",
                        selected
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-800 dark:text-slate-100"
                      )}
                    >
                      {t(`options.timing.${key}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
              {t("steps.preference.title")}
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t("steps.preference.subtitle")}
            </p>
            <div
              className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2"
              aria-busy={isAdvancingStep}
            >
              {PREF_OPTIONS.map(({ key, Icon }) => {
                const selected = answers.preference === key;
                const isSelfEnroll = key === "selfEnroll";
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setAnswers((a) => ({
                        ...a,
                        preference: key as "selfEnroll" | "helpFirst",
                      }));
                      scheduleAfterSelection(() => {
                        setPhase("result");
                        if (key === "helpFirst") {
                          setContactModalOpen(true);
                        }
                      });
                    }}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-2xl border-2 px-4 py-6 text-center transition-all duration-200",
                      "motion-safe:sm:hover:-translate-y-0.5 motion-safe:sm:hover:shadow-md",
                      selected
                        ? "border-[hsl(var(--custom))] bg-[hsl(var(--custom)/0.12)] shadow-md ring-2 ring-[hsl(var(--custom)/0.25)] dark:bg-[hsl(var(--custom)/0.15)]"
                        : isSelfEnroll
                          ? "border-[hsl(var(--custom)/0.4)] bg-[hsl(var(--custom)/0.06)] hover:border-[hsl(var(--custom)/0.55)] dark:border-[hsl(var(--custom)/0.45)] dark:bg-[hsl(var(--custom)/0.1)]"
                          : "border-slate-200 bg-white hover:border-[hsl(var(--custom)/0.45)] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-[hsl(var(--custom)/0.5)]",
                      isAdvancingStep && selected && "motion-safe:scale-[1.03]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-200",
                        selected
                          ? "bg-[hsl(var(--custom))] text-white shadow-inner"
                          : isSelfEnroll
                            ? "bg-[hsl(var(--custom)/0.2)] text-[hsl(var(--custom))] dark:bg-[hsl(var(--custom)/0.25)]"
                            : "bg-slate-100 text-slate-600 group-hover:bg-[hsl(var(--custom)/0.15)] group-hover:text-[hsl(var(--custom))] dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-[hsl(var(--custom)/0.2)] dark:group-hover:text-[hsl(var(--custom))]"
                      )}
                    >
                      <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span
                      className={cn(
                        "px-1 text-sm font-semibold leading-snug",
                        selected
                          ? "text-slate-900 dark:text-white"
                          : "text-slate-800 dark:text-slate-100"
                      )}
                    >
                      {t(`options.preference.${key}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (phase === "result" && recommendation) {
    const showPrimaryAcaHero = recommendation.primaryPath === "aca";
    const leadFormPath: RecommendationPath =
      answers.intent === "aca" ||
      (answers.intent === "unsure" && answers.timing === "asap")
        ? "aca"
        : recommendation.primaryPath;

    const helpModalHospitalIndemnity =
      answers.intent === "hospitalIndemnity";
    const helpModalDental = answers.intent === "dentalVision";
    const helpModalTemporary = answers.intent === "temporary";
    const helpModalAca =
      answers.intent === "aca" ||
      (answers.intent === "unsure" && answers.timing === "asap");
    const helpModalProduct =
      helpModalHospitalIndemnity ||
      helpModalDental ||
      helpModalTemporary;

    const primaryHref = withGcfQuery(
      pathToPathname(recommendation.primaryPath),
      recommendation.primaryPath
    );

    const carriersHref = withGcfQuery(pathToPathname("carriers"), "carriers");
    const dentalSelfEnrollHref = withGcfQuery(
      DENTAL_VISION_SELF_ENROLL_PATHNAME,
      "dentalVision"
    );
    const hospitalIndemnitySelfEnrollHref = withGcfQuery(
      HOSPITAL_INDEMNITY_SELF_ENROLL_PATHNAME,
      "hospitalIndemnity"
    );
    /** Temporary → carriers hub; dental & vision / hospital indemnity → carrier self-enrollment picker. */
    const primaryResultHref =
      recommendation.primaryPath === "temporary"
        ? carriersHref
        : recommendation.primaryPath === "dentalVision"
          ? dentalSelfEnrollHref
          : recommendation.primaryPath === "hospitalIndemnity"
            ? hospitalIndemnitySelfEnrollHref
            : primaryHref;
    const temporaryPageHref = withGcfQuery(
      pathToPathname("temporary"),
      "temporary"
    );
    const contactPageHref = withGcfQuery(pathToPathname("contact"), "contact");

    const primaryCtaLabel =
      recommendation.primaryPath === "contact"
        ? t("result.contactCta")
        : t("result.primaryCta");

    const renderRichSecondaryBlock = () => {
      const p = recommendation.primaryPath;
      if (p === "aca") {
        return (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex gap-3 sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Shield className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t("result.tempCoverageTitle")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.tempCoverageSubtitle")}
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="group mt-5 h-12 w-full border-2 border-[hsl(var(--custom)/0.4)] bg-white/90 font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition-all hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.06)] hover:shadow-md motion-safe:hover:-translate-y-px dark:border-[hsl(var(--custom)/0.35)] dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/5 dark:hover:bg-[hsl(var(--custom)/0.12)]"
                >
                  <Link
                    href={carriersHref as never}
                    className="inline-flex w-full items-center justify-center gap-2.5 px-4"
                  >
                    <Building2
                      className="h-5 w-5 shrink-0 text-[hsl(var(--custom))]"
                      strokeWidth={2}
                      aria-hidden
                    />
                    <span>{t("result.secondaryCta")}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      }
      if (p === "temporary" && recommendation.secondaryPath === "aca") {
        return (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex gap-3 sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Shield className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t("result.richSecondary.majorMedicalTitle")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.richSecondary.majorMedicalSubtitle")}
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="group mt-5 h-12 w-full border-2 border-[hsl(var(--custom)/0.4)] bg-white/90 font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition-all hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.06)] hover:shadow-md motion-safe:hover:-translate-y-px dark:border-[hsl(var(--custom)/0.35)] dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/5 dark:hover:bg-[hsl(var(--custom)/0.12)]"
                >
                  <a
                    href={HEALTH_SHERPA_AGENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2.5 px-4"
                  >
                    {t("result.primaryCta")}
                    <ExternalLink
                      className="h-4 w-4 shrink-0 opacity-80"
                      aria-hidden
                    />
                  </a>
                </Button>
                <p className="mt-3 text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {t("result.acaPrimaryHint")}
                </p>
              </div>
            </div>
          </div>
        );
      }
      if (p === "temporary" || p === "dentalVision") {
        return null;
      }
      if (p === "hospitalIndemnity") {
        return (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex gap-3 sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Zap className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t("result.richSecondary.hospitalAltTitle")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.richSecondary.hospitalAltSubtitle")}
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="group mt-5 h-12 w-full border-2 border-[hsl(var(--custom)/0.4)] bg-white/90 font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition-all hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.06)] hover:shadow-md motion-safe:hover:-translate-y-px dark:border-[hsl(var(--custom)/0.35)] dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/5 dark:hover:bg-[hsl(var(--custom)/0.12)]"
                >
                  <Link
                    href={temporaryPageHref as never}
                    className="inline-flex w-full items-center justify-center gap-2.5 px-4"
                  >
                    <span>{t("result.richSecondary.hospitalAltCta")}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      }
      if (p === "carriers") {
        return (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex gap-3 sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <MessageCircle className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t("result.richSecondary.wantGuidanceTitle")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.richSecondary.wantGuidanceSubtitle")}
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="group mt-5 h-12 w-full border-2 border-[hsl(var(--custom)/0.4)] bg-white/90 font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition-all hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.06)] hover:shadow-md motion-safe:hover:-translate-y-px dark:border-[hsl(var(--custom)/0.35)] dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/5 dark:hover:bg-[hsl(var(--custom)/0.12)]"
                >
                  <Link
                    href={contactPageHref as never}
                    className="inline-flex w-full items-center justify-center gap-2.5 px-4"
                  >
                    <span>{t("result.contactCta")}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      }
      if (p === "contact") {
        return (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/50 p-5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex gap-3 sm:items-start">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t("result.richSecondary.browseCarriersTitle")}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.richSecondary.browseCarriersSubtitle")}
                </p>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="group mt-5 h-12 w-full border-2 border-[hsl(var(--custom)/0.4)] bg-white/90 font-semibold text-slate-800 shadow-sm ring-1 ring-slate-900/[0.04] transition-all hover:border-[hsl(var(--custom))] hover:bg-[hsl(var(--custom)/0.06)] hover:shadow-md motion-safe:hover:-translate-y-px dark:border-[hsl(var(--custom)/0.35)] dark:bg-slate-800/90 dark:text-slate-100 dark:ring-white/5 dark:hover:bg-[hsl(var(--custom)/0.12)]"
                >
                  <Link
                    href={carriersHref as never}
                    className="inline-flex w-full items-center justify-center gap-2.5 px-4"
                  >
                    <span>{t("result.secondaryCta")}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden
                    />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        );
      }
      return null;
    };

    return (
      <>
        <div className="relative min-h-screen bg-[#f4f6f9] pb-20 dark:bg-slate-950">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--custom)/0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,hsl(var(--custom)/0.08),transparent_50%)]"
            aria-hidden
          />
          <div className="relative z-10 bg-[hsl(var(--custom))] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/95 sm:text-xs sm:tracking-wide">
            {t("layout.banner")}
          </div>

          <div className="relative z-10 mx-auto max-w-2xl px-4 pt-10 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_60px_-12px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-none dark:ring-white/10">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[hsl(var(--custom)/0.14)] via-[hsl(var(--custom)/0.04)] to-transparent dark:from-[hsl(var(--custom)/0.12)] dark:via-[hsl(var(--custom)/0.04)]"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(var(--custom))] via-cyan-400 to-blue-600"
                aria-hidden
              />

              <div className="relative px-5 pb-7 pt-9 sm:px-8 sm:pb-8 sm:pt-10">
                <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-white to-slate-50 shadow-lg shadow-slate-900/10 ring-2 ring-[hsl(var(--custom)/0.25)] dark:from-slate-800 dark:to-slate-900 dark:shadow-slate-950/50 dark:ring-[hsl(var(--custom)/0.35)]">
                  <CheckCircle2
                    className="h-10 w-10 text-[hsl(var(--custom))]"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>

                <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[1.65rem] sm:leading-tight">
                  {t("result.title")}
                </h2>
                <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t("result.subtitle")}
                </p>

                {answers.stateName && answers.zip && (
                  <div className="mt-5 flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200">
                      <MapPin
                        className="h-4 w-4 shrink-0 text-[hsl(var(--custom))]"
                        aria-hidden
                      />
                      <span>
                        {t("steps.zip.resolved", {
                          place: answers.placeName?.trim() || answers.zip,
                          state: answers.stateName,
                          zip: answers.zip,
                        })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-center dark:border-slate-600/80 dark:bg-slate-800/50">
                  <p className="text-pretty text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {t(`result.rationale.${recommendation.rationaleId}`)}
                  </p>
                </div>

                <div className="mt-8">
                  <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--custom))]">
                    {t("result.acaNextStepLabel")}
                  </p>
                  <div className="rounded-2xl border-2 border-[hsl(var(--custom)/0.35)] bg-gradient-to-br from-[hsl(var(--custom)/0.07)] via-white to-blue-500/[0.06] p-[3px] shadow-inner dark:from-[hsl(var(--custom)/0.1)] dark:via-slate-900 dark:to-blue-950/30">
                    <div className="rounded-[13px] bg-white/95 px-4 pb-5 pt-4 dark:bg-slate-900/95">
                      {showPrimaryAcaHero ? (
                        <>
                          <Button
                            asChild
                            size="lg"
                            className="h-14 w-full gap-2 text-base font-semibold shadow-lg shadow-[hsl(var(--custom)/0.2)] transition hover:shadow-xl"
                          >
                            <a
                              href={HEALTH_SHERPA_AGENT_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 hover:from-[hsl(var(--custom)/0.92)] hover:to-blue-600/95"
                            >
                              {t("result.primaryCta")}
                              <ExternalLink className="h-5 w-5 opacity-90" aria-hidden />
                            </a>
                          </Button>
                          <p className="mt-3 text-center text-xs leading-snug text-slate-500 dark:text-slate-400">
                            {t("result.acaPrimaryHint")}
                          </p>
                        </>
                      ) : (
                        <>
                          <Button
                            asChild
                            size="lg"
                            className="h-14 w-full gap-2 text-base font-semibold shadow-lg shadow-[hsl(var(--custom)/0.2)] transition hover:shadow-xl"
                          >
                            <Link
                              href={primaryResultHref as never}
                              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 hover:from-[hsl(var(--custom)/0.92)] hover:to-blue-600/95"
                            >
                              {primaryCtaLabel}
                              <ChevronRight className="h-5 w-5 opacity-90" aria-hidden />
                            </Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {renderRichSecondaryBlock()}

                <div className="mt-6 rounded-xl bg-slate-100/80 px-4 py-3 dark:bg-slate-800/60">
                  <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {t("result.disclaimer")}
                  </p>
                </div>

                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={restart}
                    className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-[hsl(var(--custom))] hover:underline dark:text-slate-400"
                  >
                    {t("result.restart")}
                  </button>
                </div>
              </div>
            </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-lg ring-1 ring-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-900/70 dark:ring-white/10">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50/95 to-slate-50 px-6 py-5 dark:border-slate-700 dark:from-slate-800/80 dark:to-slate-800/50">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {leadFormPath === "aca"
                  ? t("result.acaContactTitle")
                  : t(`result.leadFormIntro.${recommendation.primaryPath}.title`)}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {leadFormPath === "aca"
                  ? t("result.acaContactSubtitle")
                  : t(`result.leadFormIntro.${recommendation.primaryPath}.subtitle`)}
              </p>
            </div>
            <div className="p-3 sm:p-6 sm:pt-5">
              {renderResultLeadForm(leadFormPath)}
            </div>
          </div>
        </div>
      </div>
        <HospitalIndemnityQuoteModal
          open={contactModalOpen && helpModalHospitalIndemnity}
          setOpen={setContactModalOpen}
          source={GCF_LEAD_SOURCE}
        />
        <DentalQuoteModal
          open={contactModalOpen && helpModalDental}
          setOpen={setContactModalOpen}
          source={GCF_LEAD_SOURCE}
        />
        <ShortTermMedicalQuoteModal
          open={contactModalOpen && helpModalTemporary}
          setOpen={setContactModalOpen}
          source={GCF_LEAD_SOURCE}
        />
        <QuoteModalGeneral
          open={contactModalOpen && !helpModalProduct}
          setOpen={setContactModalOpen}
          formVariant={helpModalAca ? "aca" : "contact"}
        />
      </>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      {/* Ambient wash */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,hsl(var(--custom)/0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_100%_60%_at_50%_0%,hsl(var(--custom)/0.08),transparent_50%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        aria-hidden
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 bg-[hsl(var(--custom))] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/95 sm:text-xs sm:tracking-wide">
        {t("layout.banner")}
      </div>

      {/* Carrier logos — infinite horizontal marquee */}
      <div className="relative z-10 border-b border-slate-200/80 bg-white/90 py-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/70 sm:py-4">
        <p className="mb-2 px-4 text-center text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:mb-3 sm:text-xs">
          {t("layout.logosCaption")}
        </p>
        <div
          className="relative overflow-hidden py-1"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        >
          <div className="flex w-max animate-gcf-logo-marquee items-center gap-10 py-0.5 opacity-[0.88] grayscale transition-[filter] duration-300 hover:grayscale-0 sm:gap-14">
            {[...GCF_CARRIER_LOGOS, ...GCF_CARRIER_LOGOS].map((logo, i) => (
              <Image
                key={`${logo.id}-${i}`}
                src={logo.src}
                alt=""
                width={logo.width}
                height={logo.height}
                className="h-7 w-auto max-w-[108px] shrink-0 object-contain sm:h-9 sm:max-w-[120px]"
                unoptimized
                aria-hidden
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-0 max-w-6xl flex-col lg:min-h-[min(100vh,920px)] lg:flex-row lg:items-stretch">
        {/* Hero column: desktop only — image + overlay copy */}
        <div className="relative hidden overflow-hidden bg-slate-900 lg:sticky lg:block lg:top-0 lg:min-h-[min(100vh,920px)] lg:w-[46%] lg:shrink-0">
          <Image
            src={GET_COVERED_FAST_HERO_IMAGE}
            alt=""
            fill
            priority
            sizes="(max-width: 1023px) 0px, 46vw"
            className="object-cover object-center"
          />
          {/* Dark layers so headline stays readable on bright areas of the photo */}
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-slate-950/25"
            aria-hidden
          />
          <div className="absolute inset-0 flex flex-col justify-center p-10 pb-10 xl:p-12">
            <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-black/35 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white backdrop-blur-md sm:text-xs [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden />
              {t("layout.heroBadge")}
            </p>
            <h1 className="text-[1.65rem] font-bold leading-[1.2] tracking-tight text-white xl:text-4xl [text-shadow:0_2px_28px_rgba(0,0,0,0.9),0_1px_3px_rgba(0,0,0,0.95)]">
              {tHero("title")}
            </h1>
            <p
              className={cn(
                "mt-4 max-w-xl text-base leading-snug text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.88)]",
                step > 0 && "line-clamp-5"
              )}
            >
              {tHero("subtitle")}
            </p>
          </div>
        </div>

        {/* Quiz column */}
        <div className="flex min-w-0 flex-1 flex-col px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8 lg:justify-center lg:px-10 lg:py-12 xl:px-14">
          <div className="mx-auto w-full max-w-lg">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 sm:text-xs">
                {t("intro.progress", { current: step + 1, total: TOTAL_STEPS })}
              </p>
              <p className="hidden items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:flex sm:text-xs">
                <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {t("layout.secureNote")}
              </p>
            </div>

            <div className="mb-4 flex justify-center gap-1.5 sm:gap-2" aria-hidden>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 sm:h-2",
                    i <= step
                      ? "w-6 bg-[hsl(var(--custom))] sm:w-8"
                      : "w-1.5 bg-slate-200 dark:bg-slate-700 sm:w-2"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-700 shadow-sm transition hover:border-[hsl(var(--custom))] hover:text-[hsl(var(--custom))] disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900",
                  step === 0 && "pointer-events-none"
                )}
                aria-label={t("nav.back")}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 shadow-sm transition-[width] duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:hidden">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              {t("layout.secureNote")}
            </p>

            <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-[0_4px_40px_-12px_rgba(15,23,42,0.12),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/85 dark:shadow-[0_4px_40px_-12px_rgba(0,0,0,0.35)] sm:p-7 sm:px-8">
              {step === 0 && !zipLoading && (
                <p className="mb-5 text-center text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 sm:text-xs">
                  {t("trust.licensed", { states: licensedStateCount })} · {t("trust.bilingual")} ·{" "}
                  {t("trust.selfEnroll")}
                </p>
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  role="group"
                  aria-busy={isAdvancingStep}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className={cn(step === 0 ? "min-h-0" : "min-h-[min(220px,42vh)]")}
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>

              {step === 0 && (
                <div className="mt-6">
                  <Button
                    type="button"
                    disabled={!canNext() || zipLoading}
                    onClick={() => void goNext()}
                    size="lg"
                    className="h-14 w-full rounded-xl bg-gradient-to-r from-[hsl(var(--custom))] to-blue-600 text-base font-semibold text-white shadow-lg shadow-[hsl(var(--custom)/0.22)] transition hover:from-[hsl(var(--custom)/0.92)] hover:to-blue-600/95 disabled:opacity-50"
                  >
                    {zipLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 shrink-0 animate-spin" aria-hidden />
                        {t("steps.zip.searchingButton")}
                      </>
                    ) : (
                      t("nav.continue")
                    )}
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile / tablet: marketing after the form (desktop uses left hero column) */}
            <div className="mt-10 border-t border-slate-200/90 pt-8 lg:hidden dark:border-slate-700/80">
              <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200/90 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300 sm:text-xs">
                <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {t("layout.heroBadge")}
              </p>
              <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                {tHero("title")}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[15px]">
                {tHero("subtitle")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
