"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Contact,
  Download,
  FileSignature,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  UserRound,
} from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ChoiceCard } from "@/components/intake-ui/choice-card";
import TimeOfDayPicker from "@/components/iul/time-of-day-picker";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { capitalizeName, shortTermMedicalFormSchema } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import { appendAgentCrmBookingPrefill } from "@/lib/agent-crm-booking-url";
import { US_STATE_OPTIONS } from "@/lib/get-covered-fast/us-states";
import {
  FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT,
  IUL_GET_COVERED_VCARD_URL,
} from "@/lib/get-covered-fast/constants";
import {
  trackIulGuiaAbandon,
  trackIulGuiaFieldCompleted,
  trackIulGuiaFieldStarted,
  trackIulGuiaGuideDownload,
  trackIulGuiaPhase,
  trackIulGuiaQuizStep,
  trackIulGuiaSubmitAttempt,
  trackIulGuiaSubmitSuccess,
  type IulGuiaFieldId,
  type IulGuiaPhase,
} from "@/lib/analytics/iul-guia-ga";
import {
  CALL_TIME_CRM_LABELS,
  CALL_TIME_LABELS_ES,
  CALL_TIME_SLUGS,
  IUL_GUIA_AGENT_NAME,
  IUL_GUIA_AGENT_SPECIALTY,
  IUL_GUIA_CAMPAIGN,
  IUL_GUIA_LEAD_SOURCE,
  IUL_GUIA_PDF_URL,
  IUL_GUIA_PHONE_DISPLAY,
  IUL_GUIA_PHONE_TEL,
  IUL_GUIA_VERSION,
  IUL_GUIA_WHATSAPP_HREF,
  RETIREMENT_CRM_LABELS,
  RETIREMENT_LABELS_ES,
  RETIREMENT_SLUGS,
  SAVINGS_CRM_LABELS,
  SAVINGS_LABELS_ES,
  SAVINGS_SLUGS,
  type CallTimeSlug,
  type RetirementSlug,
  type SavingsSlug,
} from "@/lib/iul-guia/constants";

/** Matches the other get-covered funnels so Meta optimises against a comparable number. */
const LEAD_VALUE = 100;

/** Anything faster than this was not typed by a person. */
const MIN_DWELL_MS = 2000;

/**
 * The five qualification questions, asked AFTER the contact is banked.
 *
 * Same set as `/iul/get-covered` minus `email`, which moved into step 1 — this page's entire
 * reason for existing is that the guide has to be emailed, which makes the email field congruent
 * at the point it is asked. `/iul/get-covered` keeps asking it last, so the two pages are a live
 * comparison rather than a replacement.
 */
const QUIZ_STEPS = ["age", "state", "savings", "retirement", "callTime"] as const;
type QuizStep = (typeof QUIZ_STEPS)[number];

/** Spanish for the shared schema's error keys — this funnel has no next-intl namespace. */
const ERROR_ES: Record<string, string> = {
  required: "Este campo es obligatorio",
  firstNameMinLength: "Escribe tu nombre completo",
  lastNameMinLength: "Escribe tu apellido",
  firstNameMaxLength: "Demasiado largo",
  lastNameMaxLength: "Demasiado largo",
  invalidEmail: "Escribe un correo válido",
  invalidPhone: "Escribe un teléfono válido de 10 dígitos",
};

function toE164OrUndefined(phone: string | undefined): string | undefined {
  if (!phone?.trim()) return undefined;
  return parsePhoneNumber(phone, "US")?.number;
}

/** "14:30" → "2:30 PM", so the CRM note reads the way Isaac reads it. */
function formatTimeForCrm(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const hours = Number(match[1]);
  if (!Number.isFinite(hours) || hours > 23) return trimmed;
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${match[2]} ${period}`;
}

export default function IulGuiaFunnel({
  hero,
  children,
}: {
  /**
   * Headline, promise and cover art — rendered ABOVE the form. A visitor arriving cold from an ad
   * needs to know what the guide is before being asked for an email.
   */
  hero?: ReactNode;
  /**
   * The rest of the persuasion sections, passed in from the page as server components so their
   * Spanish copy never ships as client JS. Both slots render only during the `contact` phase —
   * once someone has opted in, the sales argument has done its job.
   */
  children?: ReactNode;
}) {
  const [phase, setPhase] = useState<IulGuiaPhase>("contact");
  const [stepIndex, setStepIndex] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [age, setAge] = useState("");
  const [state, setState] = useState("");
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [savings, setSavings] = useState<SavingsSlug | null>(null);
  const [retirement, setRetirement] = useState<RetirementSlug | null>(null);
  const [callTime, setCallTime] = useState<CallTimeSlug | null>(null);
  /** 24-hour "HH:MM" from the picker, or "" while the selection is incomplete. */
  const [callTimeSpecific, setCallTimeSpecific] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contactIdRef = useRef<string | null>(null);
  const phonePayloadRef = useRef<string>("");
  const emailRef = useRef<string>("");
  const submitInFlightRef = useRef(false);
  const renderedAtRef = useRef<number>(Date.now());
  const cardRef = useRef<HTMLDivElement | null>(null);

  const locale = "es";
  const currentStep: QuizStep = QUIZ_STEPS[stepIndex];

  useEffect(() => {
    trackIulGuiaPhase({ phase, locale });
  }, [phase]);

  useEffect(() => {
    if (phase !== "quiz") return;
    trackIulGuiaQuizStep({ step: currentStep, locale });
  }, [phase, currentStep]);

  // Abandon tracking. `pagehide` rather than `beforeunload` because iOS Safari never fires the
  // latter, and mobile is where this traffic lives.
  useEffect(() => {
    const onLeave = () => {
      if (phase === "done") return;
      trackIulGuiaAbandon({
        locale,
        phase,
        time_on_page_seconds: Math.round((Date.now() - renderedAtRef.current) / 1000),
      });
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [phase]);

  // Bring the card into view when the phase changes, so a short quiz screen does not open
  // scrolled past on a phone.
  useEffect(() => {
    if (phase === "contact") return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [phase]);

  const calendarBookingHref = useMemo(
    () =>
      appendAgentCrmBookingPrefill("/iul/calendar", {
        first_name: firstName.trim() ? capitalizeName(firstName.trim()) : undefined,
        last_name: lastName.trim() ? capitalizeName(lastName.trim()) : undefined,
        email: emailRef.current || undefined,
        phone: phonePayloadRef.current || undefined,
      }),
    [firstName, lastName, phase]
  );

  const inputBase =
    "min-h-[56px] w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-[17px] leading-6 text-gray-900 placeholder:text-[15px] placeholder:text-gray-400 transition-all duration-200 focus:border-[#0077B6] focus:outline-none focus:ring-2 focus:ring-[#0077B6]/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500";

  /**
   * react-phone-number-input ships its own stylesheet, and its inner input keeps a white
   * background of its own — which shows as a pale box sitting inside the field in dark mode.
   * Same override block the other funnels carry; kept identical so the fields look like one control.
   */
  const phoneInputBase = cn(
    inputBase,
    "flex items-center gap-2",
    "[&_.PhoneInputCountry]:m-0 [&_.PhoneInputCountry]:self-stretch [&_.PhoneInputCountry]:rounded-md [&_.PhoneInputCountry]:bg-transparent",
    "[&_.PhoneInputCountrySelect]:h-full [&_.PhoneInputCountrySelect]:rounded-md [&_.PhoneInputCountrySelect]:bg-transparent",
    "[&_.PhoneInputCountrySelectArrow]:text-gray-500 dark:[&_.PhoneInputCountrySelectArrow]:text-gray-300",
    "[&_.PhoneInputCountryIcon]:shadow-none",
    "[&_.PhoneInputInput]:h-full [&_.PhoneInputInput]:min-h-[48px] [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:border-0 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:p-0 [&_.PhoneInputInput]:text-[17px] [&_.PhoneInputInput]:leading-6 [&_.PhoneInputInput]:text-gray-900 [&_.PhoneInputInput]:outline-none dark:[&_.PhoneInputInput]:text-white"
  );

  const primaryBtn =
    "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0077B6] to-[#00B4D8] px-6 text-[17px] font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60";
  const secondaryBtn =
    "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-6 text-base font-semibold text-gray-800 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";
  /** Outlined but brand-coloured — the booking CTA, so it reads as a real offer without competing
   *  with the download for "the one button on this screen". */
  const brandOutlineBtn =
    "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg border-2 border-[#0077B6] bg-white px-6 text-[17px] font-bold text-[#0077B6] shadow-sm transition hover:bg-[#0077B6]/5 dark:border-[#4CC9F0] dark:bg-slate-900/40 dark:text-[#4CC9F0]";

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="mt-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
        {fieldErrors[name]}
      </p>
    ) : null;

  const trackField = (field: IulGuiaFieldId, kind: "start" | "done") => {
    if (kind === "start") trackIulGuiaFieldStarted({ field_id: field, locale });
    else trackIulGuiaFieldCompleted({ field_id: field, locale });
  };

  /**
   * Partial questionnaire save. Fire-and-forget with `keepalive` so it survives the tab closing —
   * that is the whole point: someone who answers two questions and leaves is still a lead with an
   * opening line. The contact already exists (created in step 1), so this only enriches it.
   */
  const saveAnswers = (payload: {
    age?: string;
    state?: string;
    savings?: SavingsSlug | null;
    retirement?: RetirementSlug | null;
    callTime?: CallTimeSlug | null;
    callTimeSpecific?: string;
    final?: boolean;
  }) => {
    const contactId = contactIdRef.current;
    if (!contactId || !phonePayloadRef.current) return;

    const savingsKey = payload.savings ?? savings;
    const retirementKey = payload.retirement ?? retirement;
    const callTimeKey = payload.callTime ?? callTime;
    /** "A specific time" sends the picked time itself; the windows send their English label. */
    const callTimeValue = !callTimeKey
      ? ""
      : callTimeKey === "specific"
        ? formatTimeForCrm(payload.callTimeSpecific ?? callTimeSpecific)
        : CALL_TIME_CRM_LABELS[callTimeKey];

    void fetch("/api/contact-append-iul", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        contactId,
        phone: phonePayloadRef.current,
        email: emailRef.current,
        age: payload.age ?? age,
        state: payload.state ?? state,
        monthlySavings: savingsKey ? SAVINGS_CRM_LABELS[savingsKey] : "",
        retirementTimeline: retirementKey ? RETIREMENT_CRM_LABELS[retirementKey] : "",
        callTime: callTimeValue,
        final: payload.final === true,
      }),
    }).catch(() => {
      // Swallowed on purpose — a failed partial save must never interrupt the funnel. The server
      // logs loudly, which is where a systematic loss would show up.
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Bot guards. Both fail silently rather than explaining themselves.
    if (honeypot.trim()) return;
    if (Date.now() - renderedAtRef.current < MIN_DWELL_MS) return;

    const phoneE164 = toE164OrUndefined(phone) ?? phone;
    const parsed = shortTermMedicalFormSchema.safeParse({
      firstName,
      lastName,
      email,
      phone: phoneE164,
    });

    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = ERROR_ES[issue.message] ?? "Revisa este campo";
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setLoading(true);
    trackIulGuiaSubmitAttempt({ locale });

    try {
      // ONE event id, shared by the browser Pixel and the server CAPI call, or Meta counts the
      // same lead twice.
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
            language: "es",
            source: IUL_GUIA_LEAD_SOURCE,
            campaign: IUL_GUIA_CAMPAIGN,
            guideVersion: IUL_GUIA_VERSION,
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

      const data = (await res.json().catch(() => ({}))) as {
        contactId?: string;
        capiDispatched?: boolean;
        error?: string;
      };

      // Deliberately NOT branching on res.ok alone. When a lead already exists and every merge PUT
      // fails, this route answers 502 with `success:false` AND a usable contactId — the contact is
      // real, so showing an error and dropping the questionnaire would throw away a lead we already
      // paid Meta for. A contactId is the only thing that decides success here.
      const id = data.contactId;
      if (!id) {
        throw new Error(
          typeof data.error === "string" && data.error
            ? data.error
            : "No pudimos procesar tus datos. Intenta de nuevo."
        );
      }

      contactIdRef.current = id;
      phonePayloadRef.current = phonePayload;
      emailRef.current = emailNorm;
      trackIulGuiaSubmitSuccess({ locale });

      if (process.env.NODE_ENV === "development" && data.capiDispatched !== true) {
        console.warn(
          `[iul/guia] Meta CAPI Lead was not dispatched. Check META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID, and that ${IUL_GUIA_LEAD_SOURCE} is in allowDuplicateMergeCapi.`
        );
      }

      // `em` is present here, unlike `/iul/get-covered` — which is the one measurable upside of
      // moving the email into step 1, since email is the strongest advanced-matching parameter
      // and that funnel's late email cannot retroactively improve the Lead it already fired.
      void updateAdvancedMatching({
        em: emailNorm,
        fn: capFirst.toLowerCase(),
        ln: capLast.toLowerCase(),
        ph: phoneDigits.replace(/^1/, ""),
      });

      trackLead(
        {
          contentName: "IUL — reporte gratuito",
          value: LEAD_VALUE,
          currency: "USD",
          source: IUL_GUIA_LEAD_SOURCE,
        },
        eventId
      );

      // Off the submit path on purpose: an SMTP handshake inside a 10s serverless budget is how
      // a working form starts timing out.
      void fetch("/api/iul/guia-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          contactId: id,
          email: emailNorm,
          phone: phonePayload,
          firstName: capFirst,
        }),
      }).catch(() => {});

      setStepIndex(0);
      setPhase("quiz");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo."
      );
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const ageNum = Number(age);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 85;

  const advance = (extra?: Parameters<typeof saveAnswers>[0]) => {
    setSubmitError(null);
    const isLast = stepIndex === QUIZ_STEPS.length - 1;
    saveAnswers({ ...extra, final: isLast });
    if (isLast) setPhase("done");
    else setStepIndex((i) => i + 1);
  };

  const handleNext = () => {
    if (currentStep === "age") {
      if (!ageValid) {
        setSubmitError("Ingresa una edad válida (18–85).");
        return;
      }
      advance({ age });
      return;
    }
    if (currentStep === "state") {
      if (!state) {
        setSubmitError("Selecciona tu estado.");
        return;
      }
      advance({ state });
      return;
    }
    if (currentStep === "callTime" && callTime === "specific") {
      if (!callTimeSpecific) {
        setSubmitError("Elige una hora para continuar.");
        return;
      }
      advance({ callTime: "specific", callTimeSpecific });
      return;
    }
    setSubmitError("Selecciona una opción para continuar.");
  };

  const quizTitle: Record<QuizStep, string> = {
    age: "¿Qué edad tienes?",
    state: "¿En qué estado vives?",
    savings: "¿Cuánto podrías ahorrar cada mes?",
    retirement: "¿En cuántos años te gustaría poder dejar de trabajar?",
    callTime: "Y por último: ¿a qué hora te queda mejor que te llame?",
  };

  /**
   * No subtitle on `age` on purpose. It used to explain that age moves the price of a policy,
   * which told a visitor three screens before the end that they were being qualified for a
   * product — the quiz is meant to read as the last step to the report, not as an application.
   */
  const quizSubtitle: Partial<Record<QuizStep, string>> = {
    savings: "No hay respuesta correcta. Es para saber qué opciones tienen sentido para ti.",
    callTime: `${IUL_GUIA_AGENT_NAME} hará lo posible por llamarte en el horario que elijas.`,
  };

  const progress =
    phase === "contact" ? 15 : phase === "done" ? 100 : 15 + ((stepIndex + 1) / QUIZ_STEPS.length) * 85;

  const stateLabel = US_STATE_OPTIONS.find((s) => s.code === state)?.name ?? "";

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,119,182,0.12),transparent_55%)]"
        aria-hidden
      />

      {/* The model page's attention headline, verbatim. It is a headline rather than a thin strip,
          so it gets room to wrap on a phone instead of being squeezed onto one line. */}
      <div className="relative z-10 bg-[#0077B6] px-4 py-3 text-center sm:py-4">
        <p className="mx-auto max-w-3xl text-[13px] font-bold uppercase leading-snug tracking-[0.06em] text-white sm:text-[15px]">
          Atención latinos de 20-50 años que quieran crecer sus ahorros libres de impuestos
        </p>
      </div>

      {phase === "contact" && hero ? <div className="relative z-10">{hero}</div> : null}

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div
          ref={cardRef}
          id="formulario"
          className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl sm:p-8 dark:border-gray-800 dark:bg-gray-900"
        >
          {phase !== "done" && (
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>
                  {phase === "contact"
                    ? "Paso 1 de 6"
                    : `Paso ${stepIndex + 2} de 6`}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0077B6] to-[#00B4D8] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {phase === "contact" && (
            <>
              <h2 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl dark:text-white">
                ¡Accede inmediatamente a este reporte GRATIS ahora!
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                Simplemente deja tus datos abajo y el reporte llegará directo a tu bandeja de
                entrada.
              </p>

              <form onSubmit={handleContactSubmit} className="mt-6 space-y-4" noValidate>
                {/* Honeypot — visually and programmatically hidden, only bots fill it. */}
                <div className="absolute left-[-9999px]" aria-hidden>
                  <label htmlFor="ig-website">No llenar</label>
                  <input
                    id="ig-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="ig-first"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Nombre
                    </label>
                    <input
                      id="ig-first"
                      type="text"
                      autoComplete="given-name"
                      className={inputBase}
                      placeholder="Tu nombre"
                      value={firstName}
                      onFocus={() => trackField("first_name", "start")}
                      onBlur={() => firstName && trackField("first_name", "done")}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    {fieldError("firstName")}
                  </div>
                  <div>
                    <label
                      htmlFor="ig-last"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Apellido
                    </label>
                    <input
                      id="ig-last"
                      type="text"
                      autoComplete="family-name"
                      className={inputBase}
                      placeholder="Tu apellido"
                      value={lastName}
                      onFocus={() => trackField("last_name", "start")}
                      onBlur={() => lastName && trackField("last_name", "done")}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    {fieldError("lastName")}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="ig-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="ig-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputBase}
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onFocus={() => trackField("email", "start")}
                    onBlur={() => email && trackField("email", "done")}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Aquí te enviamos el reporte. Nunca enviamos spam.
                  </p>
                  {fieldError("email")}
                </div>

                <div>
                  <label
                    htmlFor="ig-phone"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Teléfono
                  </label>
                  <PhoneInput
                    id="ig-phone"
                    international={false}
                    defaultCountry="US"
                    countries={["US"]}
                    addInternationalOption={false}
                    limitMaxLength
                    value={phone}
                    onChange={(v) => setPhone(v ?? "")}
                    onFocus={() => trackField("phone", "start")}
                    onBlur={() => phone && trackField("phone", "done")}
                    className={phoneInputBase}
                    placeholder="(540) 555-0123"
                  />
                  {fieldError("phone")}
                </div>

                {submitError && (
                  <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {submitError}
                  </p>
                )}

                <button type="submit" disabled={loading} className={primaryBtn}>
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      DESCARGA TU COPIA AHORA
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  100% gratis · Sin compromiso · Tus datos son privados
                </p>

                {/*
                  TCPA consent, carried over from /iul/get-covered rather than dropped. This funnel
                  texts and calls, and a Spanish page with English consent copy is a consent worth
                  arguing about — so both boxes are here, in Spanish.

                  BELOW the button at Isaac's request, so the last thing above the CTA is the phone
                  field rather than two paragraphs of legal text. The trade is real and was flagged:
                  most visitors submit without scrolling this far, so SMS consent rates fall. Both
                  boxes are optional (nothing validates them), so this only changes how many leads
                  arrive text-able — it does not block anyone.
                */}
                <div className="space-y-2.5 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={smsConsent}
                      onChange={(e) => setSmsConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]"
                    />
                    <span className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                      Consiento recibir notificaciones SMS de Isaac Plans Insurance. La frecuencia
                      de mensajes varía. Pueden aplicar cargos por mensajes y datos. Envía HELP al
                      (540) 426-1804 para asistencia. Responde STOP para cancelar en cualquier
                      momento.
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-[#0077B6] focus:ring-[#0077B6]"
                    />
                    <span className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                      Al marcar esta casilla acepto recibir mensajes de marketing ocasionales de
                      Isaac Plans Insurance.
                    </span>
                  </label>
                </div>
              </form>
            </>
          )}

          {phase === "quiz" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                {quizTitle[currentStep]}
              </h2>
              {quizSubtitle[currentStep] && (
                <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {quizSubtitle[currentStep]}
                </p>
              )}

              <div className="mt-6">
                {currentStep === "age" && (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={18}
                    max={85}
                    autoFocus
                    className={inputBase}
                    placeholder="Tu edad"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                  />
                )}

                {currentStep === "state" && (
                  <Popover open={statePickerOpen} onOpenChange={setStatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={statePickerOpen}
                        className="h-[56px] w-full justify-between rounded-lg border-2 border-gray-200 px-4 text-[17px] font-normal dark:border-gray-700"
                      >
                        {stateLabel || (
                          <span className="text-gray-400">Selecciona tu estado</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0"
                      align="start"
                    >
                      <Command>
                        <CommandInput placeholder="Buscar estado..." />
                        <CommandList>
                          <CommandEmpty>No se encontró ningún estado.</CommandEmpty>
                          <CommandGroup>
                            {US_STATE_OPTIONS.map((option) => (
                              <CommandItem
                                key={option.code}
                                value={option.name}
                                onSelect={() => {
                                  setState(option.code);
                                  setStatePickerOpen(false);
                                  setSubmitError(null);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    state === option.code ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {option.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}

                {currentStep === "savings" && (
                  <div className="space-y-3" role="radiogroup" aria-label="Capacidad mensual">
                    {SAVINGS_SLUGS.map((slug) => (
                      <ChoiceCard
                        key={slug}
                        selected={savings === slug}
                        label={SAVINGS_LABELS_ES[slug]}
                        onClick={() => {
                          setSavings(slug);
                          advance({ savings: slug });
                        }}
                      />
                    ))}
                  </div>
                )}

                {currentStep === "retirement" && (
                  <div className="space-y-3" role="radiogroup" aria-label="Horizonte">
                    {RETIREMENT_SLUGS.map((slug) => (
                      <ChoiceCard
                        key={slug}
                        selected={retirement === slug}
                        label={RETIREMENT_LABELS_ES[slug]}
                        onClick={() => {
                          setRetirement(slug);
                          advance({ retirement: slug });
                        }}
                      />
                    ))}
                  </div>
                )}

                {currentStep === "callTime" && (
                  <>
                    <div className="space-y-3" role="radiogroup" aria-label="Horario preferido">
                      {CALL_TIME_SLUGS.map((slug) => (
                        <ChoiceCard
                          key={slug}
                          selected={callTime === slug}
                          label={CALL_TIME_LABELS_ES[slug]}
                          onClick={() => {
                            setCallTime(slug);
                            setSubmitError(null);
                            // "Una hora específica" opens the picker instead of finishing — the
                            // other three are a complete answer the moment they are tapped.
                            if (slug !== "specific") advance({ callTime: slug });
                          }}
                        />
                      ))}
                    </div>

                    {callTime === "specific" && (
                      <div className="mt-5">
                        <TimeOfDayPicker
                          value={callTimeSpecific}
                          onChange={setCallTimeSpecific}
                          labels={{ hour: "Hora", minutes: "Minutos", period: "AM / PM" }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {submitError && (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {submitError}
                </p>
              )}

              {/* The typed steps need an explicit Next; so does "a specific time", which is only a
                  complete answer once the picker has an hour AND an AM/PM. The other tappable
                  options advance on tap. */}
              {(currentStep === "age" ||
                currentStep === "state" ||
                (currentStep === "callTime" && callTime === "specific")) && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentStep === "callTime" && !callTimeSpecific}
                  className={cn(primaryBtn, "mt-6")}
                >
                  {currentStep === "callTime" ? "Listo" : "Siguiente"}
                </button>
              )}

              <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                Responde estas preguntas rápidas para recibir tu reporte.
              </p>
            </>
          )}

          {phase === "done" && (
            <SuccessScreen
              firstName={firstName}
              calendarHref={calendarBookingHref}
              onDownload={() => trackIulGuiaGuideDownload({ locale })}
              primaryBtn={primaryBtn}
              secondaryBtn={secondaryBtn}
              brandOutlineBtn={brandOutlineBtn}
            />
          )}
        </div>
      </div>

      {phase === "contact" && children ? (
        <div className="relative z-10">{children}</div>
      ) : null}
    </div>
  );
}

function SuccessScreen({
  firstName,
  calendarHref,
  onDownload,
  primaryBtn,
  secondaryBtn,
  brandOutlineBtn,
}: {
  firstName: string;
  calendarHref: string;
  onDownload: () => void;
  primaryBtn: string;
  secondaryBtn: string;
  brandOutlineBtn: string;
}) {
  const downloadButton = IUL_GUIA_PDF_URL ? (
    // An explicit anchor, not window.open(): the guide opens from a Facebook or Instagram in-app
    // browser more often than not, and those block a programmatic popup that follows an await.
    // This is a real user gesture on a real link.
    <a
      href={IUL_GUIA_PDF_URL}
      download
      target="_blank"
      rel="noopener noreferrer"
      onClick={onDownload}
      className={primaryBtn}
    >
      <FileText className="h-5 w-5" />
      Descargar mi reporte ahora
    </a>
  ) : null;

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#0077B6]/10 dark:bg-[#0077B6]/25">
        <CheckCircle2 className="h-9 w-9 text-[#0077B6] dark:text-[#4CC9F0]" />
      </div>

      <h2 className="mt-5 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
        ¡Listo{firstName ? `, ${capitalizeName(firstName.trim())}` : ""}!
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
        {IUL_GUIA_PDF_URL
          ? "Tu reporte está listo. Descárgalo aquí — también te lo acabamos de enviar a tu correo."
          : "Te enviamos tu reporte a tu correo. Revisa tu bandeja de entrada."}
      </p>

      <div className="mt-6 space-y-3 text-left">
        {downloadButton}

        {/* One primary per screen. The guide is what they came for, so it keeps the filled
            button; the booking CTA is outlined in the same brand colour so it still reads as an
            offer. With no PDF URL set there is no download, and booking becomes the primary. */}
        <Link
          href={calendarHref as "/iul/calendar"}
          className={IUL_GUIA_PDF_URL ? brandOutlineBtn : primaryBtn}
        >
          Agendar mi asesoría gratuita
        </Link>

        <a href={IUL_GUIA_PHONE_TEL} className={secondaryBtn}>
          <Phone className="h-5 w-5" />
          Llamar ahora · {IUL_GUIA_PHONE_DISPLAY}
        </a>

        <a
          href={IUL_GUIA_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(secondaryBtn, "border-[#25D366]/40 text-[#128C4A] dark:text-[#25D366]")}
        >
          <MessageCircle className="h-5 w-5" />
          Escríbeme por WhatsApp
        </a>

        {/* For the lead who is already decided and does not want to wait for a call. An internal
            Link, not the absolute URL, so next-intl resolves it to /es/iul/aplicar. */}
        <Link href="/iul/apply" className={secondaryBtn}>
          <FileSignature className="h-5 w-5" />
          Aplicar ahora para mi IUL
        </Link>
      </div>

      {/* The agent card. Showing the face and the number here means the callback is from a name
          the lead has already seen, which is most of why it gets answered. */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5 text-left dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex items-center gap-4">
          {FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT ? (
            <Image
              src={FINAL_EXPENSE_GET_COVERED_AGENT_HEADSHOT}
              alt={IUL_GUIA_AGENT_NAME}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover object-[center_20%]"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#0077B6]/10 text-[#0077B6] dark:bg-[#0077B6]/25 dark:text-[#4CC9F0]">
              <UserRound className="h-8 w-8" />
            </span>
          )}
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{IUL_GUIA_AGENT_NAME}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{IUL_GUIA_AGENT_SPECIALTY}</p>
            <p className="mt-1 text-sm font-semibold text-[#0077B6] dark:text-[#4CC9F0]">
              {IUL_GUIA_PHONE_DISPLAY}
            </p>
          </div>
        </div>

        {IUL_GET_COVERED_VCARD_URL ? (
          <a
            href={IUL_GET_COVERED_VCARD_URL}
            download="Isaac-Orraiz-Isaac-Plans.vcf"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0077B6] hover:underline dark:text-[#4CC9F0]"
          >
            <Contact className="h-4 w-4" />
            Guardar contacto en mi teléfono
          </a>
        ) : null}
      </div>
    </div>
  );
}
