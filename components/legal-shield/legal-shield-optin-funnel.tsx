"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import PhoneInput, { parsePhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { cn } from "@/lib/utils";
import { ChoiceCard } from "@/components/intake-ui/choice-card";
import { capitalizeName, shortTermMedicalFormSchema } from "@/lib/validation/shortTermMedicalSchema";
import { trackLead, updateAdvancedMatching } from "@/lib/facebook-pixel";
import { generateEventId, getFacebookCookies } from "@/lib/meta-capi";
import {
  trackLegalShieldAbandon,
  trackLegalShieldFieldCompleted,
  trackLegalShieldFieldStarted,
  trackLegalShieldGuideDownload,
  trackLegalShieldPhase,
  trackLegalShieldSubmitAttempt,
  trackLegalShieldSubmitSuccess,
  type LegalShieldFieldId,
  type LegalShieldPhase,
} from "@/lib/analytics/legal-shield-optin-ga";
import {
  AREA_LABELS_ES,
  AREA_SLUGS,
  CONSENT_DISCLOSURE_ES,
  LEGAL_SHIELD_GUIDE_PDF_URL,
  LS_APPLY_PATH,
  LS_ADVISOR_NAME,
  LS_LEAD_SOURCE,
  LS_PHONE_DISPLAY,
  LS_PHONE_TEL,
  LS_WHATSAPP_HREF,
  NOT_INSURANCE_LINE_ES,
  URGENCY_LABELS_ES,
  URGENCY_SLUGS,
  YSMAEL_HEADSHOT_URL,
  YSMAEL_VCARD_URL,
  type AreaSlug,
  type UrgencySlug,
} from "@/lib/legal-shield/constants";

/** Matches the other get-covered funnels so Meta optimises against a comparable number. */
const LEAD_VALUE = 100;

/** Anything faster than this was not typed by a person. */
const MIN_DWELL_MS = 2000;

const GUIDE_VERSION = "guia_legal_shield_gt48jt";

/** Spanish for the shared schema's error keys — the funnel has no next-intl namespace. */
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

type Phase = LegalShieldPhase;

export default function LegalShieldOptinFunnel({
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
   * ~400 lines of Spanish copy never ship as client JS. Both slots render only during the
   * `contact` phase — once someone has opted in, the sales argument has done its job.
   */
  children?: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("contact");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");

  const [areas, setAreas] = useState<AreaSlug[]>([]);
  const [urgency, setUrgency] = useState<UrgencySlug | null>(null);

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

  useEffect(() => {
    trackLegalShieldPhase({ phase, locale });
  }, [phase]);

  // Abandon tracking. `pagehide` rather than `beforeunload` because iOS Safari never fires the
  // latter, and mobile is where this traffic lives.
  useEffect(() => {
    const onLeave = () => {
      if (phase === "done") return;
      trackLegalShieldAbandon({
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

  const inputBase =
    "min-h-[56px] w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-[17px] leading-6 text-gray-900 placeholder:text-[15px] placeholder:text-gray-400 transition-all duration-200 focus:border-[#8124BC] focus:outline-none focus:ring-2 focus:ring-[#8124BC]/20 dark:border-gray-700 dark:bg-gray-800/50 dark:text-white dark:placeholder:text-gray-500";

  /**
   * react-phone-number-input ships its own stylesheet, and its inner input keeps a white
   * background of its own — which shows as a pale box sitting inside the field in dark mode.
   * Same override block the ACA and FE funnels carry; kept identical so the four fields look
   * like one control.
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

  const fieldError = (name: string) =>
    fieldErrors[name] ? (
      <p className="mt-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
        {fieldErrors[name]}
      </p>
    ) : null;

  /**
   * Partial questionnaire save. Fire-and-forget with `keepalive` so it survives the tab closing —
   * that is the whole point: someone who answers screen 2 and leaves is still a lead the advisor
   * can open a call with.
   */
  const saveAnswers = (payload: {
    areas?: AreaSlug[];
    urgency?: UrgencySlug | null;
    final?: boolean;
  }) => {
    const contactId = contactIdRef.current;
    if (!contactId) return;
    void fetch("/api/legal-shield/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        contactId,
        phone: phonePayloadRef.current,
        email: emailRef.current,
        areas: payload.areas ?? areas,
        urgency: payload.urgency ?? urgency,
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
    trackLegalShieldSubmitAttempt({ locale });

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
          legalShieldData: {
            language: "es",
            source: LS_LEAD_SOURCE,
            campaign: "legal_shield_proteccion_legal",
            guideVersion: GUIDE_VERSION,
            consentDisclosure: CONSENT_DISCLOSURE_ES,
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
      trackLegalShieldSubmitSuccess({ locale });

      if (process.env.NODE_ENV === "development" && data.capiDispatched !== true) {
        console.warn(
          "[legal-shield] Meta CAPI Lead was not dispatched. Check META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_FACEBOOK_PIXEL_ID, and that legal_shield_optin_ads is in allowDuplicateMergeCapi."
        );
      }

      void updateAdvancedMatching({
        em: emailNorm,
        fn: capFirst.toLowerCase(),
        ln: capLast.toLowerCase(),
        ph: phoneDigits.replace(/^1/, ""),
      });

      trackLead(
        {
          contentName: "LegalShield — guía preventiva",
          value: LEAD_VALUE,
          currency: "USD",
          source: LS_LEAD_SOURCE,
        },
        eventId
      );

      // Off the submit path on purpose: an SMTP handshake inside a 10s serverless budget is how
      // a working form starts timing out.
      void fetch("/api/legal-shield/guide-email", {
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

      setPhase("areas");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado. Intenta de nuevo."
      );
    } finally {
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const toggleArea = (slug: AreaSlug) => {
    setAreas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleAreasNext = () => {
    if (areas.length === 0) {
      setSubmitError("Elige al menos una opción.");
      return;
    }
    setSubmitError(null);
    saveAnswers({ areas });
    setPhase("urgencia");
  };

  const handleUrgencySubmit = (slug: UrgencySlug) => {
    setUrgency(slug);
    setSubmitError(null);
    // `final` re-sends the areas too. The GET/PUT pair on the server has no concurrency control
    // and a GHL PUT replaces the whole customFields array, so a screen-2 save still in flight
    // would otherwise be erased by this one.
    saveAnswers({ areas, urgency: slug, final: true });
    setPhase("done");
  };

  const progress = phase === "contact" ? 33 : phase === "areas" ? 66 : 100;

  const trackField = (field: LegalShieldFieldId, kind: "start" | "done") => {
    if (kind === "start") trackLegalShieldFieldStarted({ field_id: field, locale });
    else trackLegalShieldFieldCompleted({ field_id: field, locale });
  };

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(129,36,188,0.10),transparent_55%)]"
        aria-hidden
      />

      <div className="relative z-10 bg-[#8124BC] py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/95 sm:text-xs">
        Atención: familias latinas en Estados Unidos
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
                    ? "Paso 1 de 3"
                    : phase === "areas"
                      ? "Paso 2 de 3"
                      : "Paso 3 de 3"}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/90">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] transition-[width] duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {phase === "contact" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                ¿A dónde te enviamos tu guía gratis?
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                Llena tus datos y te lo mandamos ahora mismo. Es gratis y no te compromete a nada.
              </p>

              <form onSubmit={handleContactSubmit} className="mt-6 space-y-4" noValidate>
                {/* Honeypot — visually and programmatically hidden, only bots fill it. */}
                <div className="absolute left-[-9999px]" aria-hidden>
                  <label htmlFor="ls-website">No llenar</label>
                  <input
                    id="ls-website"
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
                      htmlFor="ls-first"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Nombre
                    </label>
                    <input
                      id="ls-first"
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
                      htmlFor="ls-last"
                      className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Apellido
                    </label>
                    <input
                      id="ls-last"
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
                    htmlFor="ls-phone"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Teléfono
                  </label>
                  <PhoneInput
                    id="ls-phone"
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

                <div>
                  <label
                    htmlFor="ls-email"
                    className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Correo electrónico
                  </label>
                  <input
                    id="ls-email"
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
                    Aquí te enviamos la guía.
                  </p>
                  {fieldError("email")}
                </div>

                {submitError && (
                  <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    {submitError}
                  </p>
                )}

                {/*
                  Consent by submission. Isaac asked for the checkboxes to go; this line is what
                  replaces them, and the exact wording is stored on the CRM record with a timestamp
                  and IP so there is still evidence of what the visitor agreed to.
                */}
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  {CONSENT_DISCLOSURE_ES}
                </p>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] px-6 text-[17px] font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      ENVIARME LA GUÍA GRATIS
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  100% gratis · Sin tarjeta de crédito · {NOT_INSURANCE_LINE_ES}
                </p>
              </form>
            </>
          )}

          {phase === "areas" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                ¿En cuál de estas áreas te gustaría tener respaldo legal en español?
              </h2>
              <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-400">
                Puedes elegir todas las que apliquen. Así tu asesor sabe por dónde empezar.
              </p>

              <div className="mt-6 space-y-3" role="group" aria-label="Áreas de respaldo legal">
                {AREA_SLUGS.map((slug) => (
                  <ChoiceCard
                    key={slug}
                    role="checkbox"
                    selected={areas.includes(slug)}
                    label={AREA_LABELS_ES[slug]}
                    onClick={() => toggleArea(slug)}
                  />
                ))}
              </div>

              {submitError && (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  {submitError}
                </p>
              )}

              <button
                type="button"
                onClick={handleAreasNext}
                className="mt-6 flex min-h-[56px] w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] px-6 text-[17px] font-bold text-white shadow-lg transition hover:brightness-110"
              >
                Continuar
              </button>
            </>
          )}

          {phase === "urgencia" && (
            <>
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
                ¿Cómo describirías tu situación actual?
              </h2>
              <p className="mt-2 text-[15px] text-gray-600 dark:text-gray-400">
                Elige una. Es la última pregunta.
              </p>

              <div className="mt-6 space-y-3" role="radiogroup" aria-label="Situación actual">
                {URGENCY_SLUGS.map((slug) => (
                  <ChoiceCard
                    key={slug}
                    selected={urgency === slug}
                    label={URGENCY_LABELS_ES[slug]}
                    onClick={() => handleUrgencySubmit(slug)}
                  />
                ))}
              </div>
            </>
          )}

          {phase === "done" && (
            <SuccessScreen
              firstName={firstName}
              urgency={urgency}
              onDownload={() => trackLegalShieldGuideDownload({ locale })}
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
  urgency,
  onDownload,
}: {
  firstName: string;
  urgency: UrgencySlug | null;
  onDownload: () => void;
}) {
  // Someone who said they have a problem right now should be calling, not reading. Everyone else
  // gets the report as the primary action.
  const callIsPrimary = urgency === "ahora_mismo";
  const primaryBtn =
    "flex min-h-[56px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#8124BC] to-[#9D4EDD] px-6 text-[17px] font-bold text-white shadow-lg transition hover:brightness-110";
  const secondaryBtn =
    "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-200 bg-white px-6 text-base font-semibold text-gray-800 transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100";

  const downloadButton = LEGAL_SHIELD_GUIDE_PDF_URL ? (
    // An explicit anchor, not window.open(): the report opens from a Facebook or Instagram
    // in-app browser more often than not, and those block a programmatic popup that follows an
    // await. This is a real user gesture on a real link.
    <a
      href={LEGAL_SHIELD_GUIDE_PDF_URL}
      download
      target="_blank"
      rel="noopener noreferrer"
      onClick={onDownload}
      className={callIsPrimary ? secondaryBtn : primaryBtn}
    >
      <FileText className="h-5 w-5" />
      Descargar mi guía
    </a>
  ) : null;

  const callButton = (
    <a href={LS_PHONE_TEL} className={callIsPrimary ? primaryBtn : secondaryBtn}>
      <Phone className="h-5 w-5" />
      Llámame ahora · {LS_PHONE_DISPLAY}
    </a>
  );

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/40">
        <CheckCircle2 className="h-9 w-9 text-[#8124BC] dark:text-purple-300" />
      </div>

      <h2 className="mt-5 text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
        ¡Listo{firstName ? `, ${capitalizeName(firstName)}` : ""}!
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
        {LEGAL_SHIELD_GUIDE_PDF_URL
          ? "Tu guía está lista. Descárgala aquí — también te la enviamos a tu correo."
          : "Te enviamos tu guía a tu correo. Revisa tu bandeja de entrada en los próximos minutos."}
      </p>

      <div className="mt-6 space-y-3 text-left">
        {callIsPrimary ? (
          <>
            {callButton}
            {downloadButton}
          </>
        ) : (
          <>
            {downloadButton}
            {callButton}
          </>
        )}

        <a
          href={LS_WHATSAPP_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(secondaryBtn, "border-[#25D366]/40 text-[#128C4A] dark:text-[#25D366]")}
        >
          <MessageCircle className="h-5 w-5" />
          Escríbeme por WhatsApp
        </a>

        <Link href={LS_APPLY_PATH} className={secondaryBtn}>
          <ShieldCheck className="h-5 w-5" />
          Aplica tú mismo ahora
        </Link>
      </div>

      {/* The advisor card. The script has Ysmael sending his credential the moment the call
          starts; showing his face and number here means the callback is from a name the lead
          has already seen, which is most of why it gets answered. */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5 text-left dark:border-gray-800 dark:bg-gray-800/50">
        <div className="flex items-center gap-4">
          {YSMAEL_HEADSHOT_URL ? (
            <Image
              src={YSMAEL_HEADSHOT_URL}
              alt={LS_ADVISOR_NAME}
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#8124BC]/10 text-[#8124BC] dark:bg-purple-900/40 dark:text-purple-300">
              <UserRound className="h-8 w-8" />
            </span>
          )}
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{LS_ADVISOR_NAME}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Tu asesor asignado · Asociado Independiente de LegalShield
            </p>
            <p className="mt-1 text-sm font-semibold text-[#8124BC] dark:text-purple-300">
              {LS_PHONE_DISPLAY}
            </p>
          </div>
        </div>

        {YSMAEL_VCARD_URL ? (
          <a
            href={YSMAEL_VCARD_URL}
            download
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#8124BC] hover:underline dark:text-purple-300"
          >
            <Download className="h-4 w-4" />
            Guardar contacto en mi teléfono
          </a>
        ) : null}
      </div>
    </div>
  );
}
