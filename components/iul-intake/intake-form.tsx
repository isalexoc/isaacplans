"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Check,
  CloudUpload,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  PartyPopper,
  Upload,
  FileText,
  X,
  ArrowRight,
  Send,
  User,
  MapPin,
  Briefcase,
  DollarSign,
  Users,
  Users2,
  CreditCard,
  HeartPulse,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  fetchIntake,
  completeIntake,
  uploadIntakeFile,
  removeIntakeFile,
} from "@/lib/iul-intake-api";
import { isMaskedValue } from "@/lib/intake-shared/masking";
import { useIulIntakeAutosave } from "@/hooks/use-iul-intake-autosave";
import IntakeBreadcrumb from "@/components/iul-intake/intake-breadcrumb";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import {
  FIELD_INPUT,
  FIELD_SELECT,
  FIELD_TEXTAREA,
  FIELD_LABEL,
  INVALID_INPUT,
  SMALL_INPUT,
  SMALL_LABEL,
  SELECT_INPUT,
  OUTLINE_BTN,
  GRADIENT_BTN,
  CARD,
  ChoiceCard,
  CountedDigitsField,
  type CountedDigitsLabels,
} from "@/components/intake-ui";
import { formatSsn } from "@/lib/intake-shared/format";
import SecureCapturePanel from "@/components/iul-intake/secure-capture-panel";
import DocumentCapturePanel from "@/components/iul-intake/document-capture-panel";
import MeetingPanel from "@/components/crankwheel/meeting-panel";
import RoutingLookupPanel from "@/components/iul-intake/routing-lookup-panel";
import BankNameHint from "@/components/iul-intake/bank-name-hint";
import { useIulSecureCapture } from "@/hooks/use-iul-secure-capture";
import { useIulDocumentCapture } from "@/hooks/use-iul-document-capture";
import { useCrankwheelMeeting } from "@/hooks/use-crankwheel-meeting";
import { canPreview } from "@/lib/iul-intake/document-preview";
import {
  visibleSections,
  allFileFields,
  SECURE_CAPTURE_FIELD_KEYS,
  MAX_BENEFICIARIES,
  BENEFICIARY_RELATIONSHIPS,
  emptyBeneficiary,
  isFieldVisible,
  fieldByKey,
  type IntakeField,
  type IntakeOption,
  type Beneficiary,
  type FileRef,
} from "@/lib/iul-intake/fields";
import {
  fieldFormatError,
  beneficiaryPercentTotal,
  type FieldErrorKey,
} from "@/lib/iul-intake/validation";
import { digitsToStored, formatMoneyDisplay } from "@/lib/iul-intake/money";
import { countriesFor } from "@/lib/iul-intake/countries";
import { sectionMissingFields, type IntakeData } from "@/lib/iul-intake/schema";
import type { IntakeSession } from "@/lib/iul-intake/types";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  fieldPlaceholder,
  fieldHelp,
  optionLabel,
  sectionTitle,
  sectionDescription,
  type IntakeLocale,
} from "@/lib/iul-intake/ui-strings";

/* ------------------------------- helpers ------------------------------- */

const MONTHS: Record<IntakeLocale, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
};

function buildDobIso(month: string, day: string, year: string): string {
  if (!month || !day || !year) return "";
  const m = month.padStart(2, "0");
  const d = day.padStart(2, "0");
  const yNum = Number(year);
  const mNum = Number(month);
  const dNum = Number(day);
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

function splitDobIso(value: string): { month: string; day: string; year: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!m) return { month: "", day: "", year: "" };
  return { year: m[1], month: String(Number(m[2])), day: String(Number(m[3])) };
}

function parseHeight(value: string): { feet: string; inches: string } {
  const m = /(\d+)\s*'\s*(\d+)/.exec(value ?? "");
  if (!m) return { feet: "", inches: "" };
  return { feet: m[1], inches: m[2] };
}

function buildHeight(feet: string, inches: string): string {
  if (!feet) return "";
  return `${feet}'${inches || "0"}"`;
}

/** Centimeters → imperial height string (e.g. 180 → 5'11"). */
function cmToHeight(cm: string): string {
  const n = Number((cm ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  const totalInches = Math.round(n / 2.54);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  if (feet < 1) return "";
  return `${feet}'${inches}"`;
}

/** Kilograms → pounds (rounded). */
function kgToLbs(kg: string): string {
  const n = Number((kg ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.round(n * 2.2046226218));
}

/** Progressive US phone format: digits → (305) 555-1234. */
function formatUsPhone(value: string): string {
  let d = (value ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function errorMessageFor(key: FieldErrorKey, locale: IntakeLocale): string {
  switch (key) {
    case "email":
      return tr(UI.errEmail, locale);
    case "phone":
      return tr(UI.errPhone, locale);
    case "zip":
      return tr(UI.errZip, locale);
    case "ssn":
      return tr(UI.errSsn, locale);
    case "routing":
      return tr(UI.errRouting, locale);
    case "age":
      return tr(UI.errAge, locale);
    case "dob":
      return tr(UI.errDob, locale);
    default:
      return tr(UI.fixErrors, locale);
  }
}

/** Icon per section, shown in a colored chip next to the step title. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  personal: User,
  residence: MapPin,
  employment: Briefcase,
  financial: DollarSign,
  beneficiaries: Users,
  payment: CreditCard,
  health: HeartPulse,
  family: Users2,
  attachments: FileText,
  agent: StickyNote,
};

/* ------------------------------- component ------------------------------- */

export default function IntakeForm({ token }: { token: string }) {
  const locale = pickLocale(useLocale());

  const [session, setSession] = useState<IntakeSession | null>(null);
  const [data, setData] = useState<IntakeData>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, FieldErrorKey>>({});
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Sensitive fields (SSN/ITIN, driver's license #, routing/account #, beneficiary SSN) start
  // OBSCURED. The agent usually fills this form with the client watching a screen share, so a
  // readable SSN sitting on screen is the default that had to change; Reveal is one click, and
  // the digit counter still reports progress while the value is hidden. Matches client-view.tsx,
  // which already defaulted to hidden.
  const [reveal, setReveal] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  /**
   * Which field the agent is typing in right now.
   *
   * A captured value must never replace text under a live cursor — that is the one thing that
   * would make this feature feel haunted rather than helpful. Whatever is focused is skipped and
   * picked up on blur.
   */
  const focusedKeyRef = useRef<string | null>(null);
  /** True once a client submission overwrote something the agent had already typed. */
  const [captureReplaced, setCaptureReplaced] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchIntake(token);
        if (!active) return;
        setSession(s);
        const initial = { ...(s.data ?? {}) };
        // Default the premium payment mode to Monthly when not yet chosen.
        if (!initial.premiumPaymentMode) initial.premiumPaymentMode = "Monthly";
        setData(initial);
        setCompleted(s.status === "completed");
        setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const { status: saveStatus } = useIulIntakeAutosave({ token, data });

  const isOwner = session?.role === "owner";
  const sections = useMemo(() => visibleSections(!!isOwner), [isOwner]);
  // A client who has submitted can't edit until an admin re-opens the form.
  const lockedForClient = !isOwner && completed && !session?.reopenedForClient;

  /**
   * Secure capture: the agent's live view of what the client is typing on their own phone.
   *
   * The values arriving here are MASKED (`•••••6789`), and that is the mechanism, not a display
   * choice. Once these sit in `data`, every subsequent autosave sends a mask, and the server's
   * `mergePreservedIulSensitive` turns that into a no-op — so the agent's form structurally
   * cannot overwrite what the client just sent. See the API route for the rest of the story.
   */
  const secureCapture = useIulSecureCapture({
    token,
    enabled: Boolean(isOwner) && !completed,
    onValues: (values) => {
      setData((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const key of SECURE_CAPTURE_FIELD_KEYS) {
          const incoming = values[key];
          if (typeof incoming !== "string" || !incoming) continue;
          // Never yank a value out from under a live cursor; blur re-runs this.
          if (focusedKeyRef.current === key) continue;
          const current = typeof prev[key] === "string" ? (prev[key] as string) : "";
          if (current === incoming) continue;
          // A real value being displaced means the agent had typed something. Say so, rather than
          // letting an SSN quietly change while they look at another field.
          if (current && !isMaskedValue(current)) setCaptureReplaced(true);
          next[key] = incoming;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
  });

  /**
   * Pull in documents the client just sent from their phone.
   *
   * Only the FILE fields are copied across. Re-applying the whole session would overwrite whatever
   * the agent is typing at that moment — the same hazard the secure-capture masks are designed
   * around — and a document arriving is never a reason to touch a text field.
   */
  const refreshUploadedFiles = useCallback(async () => {
    try {
      const s = await fetchIntake(token);
      const incoming = (s.data ?? {}) as Record<string, unknown>;
      setData((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const field of allFileFields()) {
          const value = incoming[field.key];
          if (!Array.isArray(value)) continue;
          if (JSON.stringify(value) === JSON.stringify(prev[field.key])) continue;
          next[field.key] = value;
          changed = true;
        }
        return changed ? next : prev;
      });
    } catch {
      /* the next poll tries again; a missed refresh is cosmetic, the files are already stored */
    }
  }, [token]);

  const documentCapture = useIulDocumentCapture({
    token,
    enabled: Boolean(isOwner) && !completed,
    onArrival: refreshUploadedFiles,
  });

  /**
   * The meeting link, for putting the client in front of the agent's screen mid-conversation.
   *
   * Not tied to a step, unlike the capture panels below it: a screen share can start at any point,
   * and most often does before the form is opened at all.
   */
  const meeting = useCrankwheelMeeting({
    target: { intakeToken: token },
  });

  // Clients pay by bank draft only — lock the value so it always syncs.
  useEffect(() => {
    if (loadState !== "ready" || isOwner) return;
    const current = typeof data.paymentMethod === "string" ? data.paymentMethod : "";
    if (current !== "Electronic (bank draft)") {
      setData((prev) => ({ ...prev, paymentMethod: "Electronic (bank draft)" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, isOwner]);

  // US citizens always have an SSN and US citizenship — auto-fill both (the redundant
  // SSN/ITIN and country-of-citizenship questions are hidden for them).
  useEffect(() => {
    if (loadState !== "ready" || data.usCitizen !== "yes") return;
    const patch: Record<string, unknown> = {};
    if (data.idType !== "SSN") patch.idType = "SSN";
    if (data.countryOfCitizenship !== "United States") patch.countryOfCitizenship = "United States";
    if (Object.keys(patch).length) setData((prev) => ({ ...prev, ...patch }));
  }, [loadState, data.usCitizen, data.idType, data.countryOfCitizenship]);

  // Keep step in range when the section list changes (role resolves after load).
  useEffect(() => {
    setStep((s) => Math.min(s, sections.length - 1));
  }, [sections.length]);

  // On step change, bring the step's content (title + first field) into view.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function setField(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
    if (missing.size) {
      setMissing((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function validateOnBlur(field: IntakeField, value: string) {
    const err = fieldFormatError(field, value);
    setErrors((prev) => {
      if (err) return { ...prev, [field.key]: err };
      if (!prev[field.key]) return prev;
      const next = { ...prev };
      delete next[field.key];
      return next;
    });
  }

  const current = sections[step];

  // Section indices that still contain an unresolved missing field (ordered).
  const sectionsWithMissing = useMemo(() => {
    if (!missing.size) return [];
    return sections.reduce<number[]>((acc, section, idx) => {
      const hit = section.fields.some(
        (f) => (f.type === "beneficiaries" ? missing.has("beneficiaries") : missing.has(f.key))
      );
      if (hit) acc.push(idx);
      return acc;
    }, []);
  }, [sections, missing]);

  /** Next section (after `from`) that still has a missing field, wrapping to the first. */
  function nextIssueIndex(from: number): number {
    if (!sectionsWithMissing.length) return from;
    const after = sectionsWithMissing.find((i) => i > from);
    return after ?? sectionsWithMissing[0];
  }

  // A section is "complete" when it has no missing/invalid fields AND has actually been filled
  // in (so untouched, all-optional sections don't show as done from the start).
  const sectionComplete = useMemo(
    () =>
      sections.map((section) => {
        if (sectionMissingFields(section, data).length) return false;
        return section.fields.some((f) => {
          if (!isFieldVisible(f, data)) return false;
          if (f.type === "beneficiaries") {
            const list = Array.isArray(data.beneficiaries) ? data.beneficiaries : [];
            return list.some((b) => Object.values(b).some((v) => String(v ?? "").trim()));
          }
          const v = data[f.key];
          return Array.isArray(v) ? v.length > 0 : String(v ?? "").trim() !== "";
        });
      }),
    [sections, data]
  );

  // Clear the error banner once every flagged field has been fixed.
  useEffect(() => {
    if (completeError && missing.size === 0) setCompleteError(null);
  }, [missing, completeError]);

  function goNext() {
    setCompleteError(null);
    setStep((s) => Math.min(sections.length - 1, s + 1));
  }

  // Clients must complete the current step before advancing; admins move freely.
  function handleNext() {
    if (!isOwner) {
      const miss = sectionMissingFields(current, data);
      if (miss.length) {
        setMissing((prev) => {
          const next = new Set(prev);
          miss.forEach((k) => next.add(k));
          return next;
        });
        // Surface inline format errors for malformed (non-empty) fields too.
        const fmt: Record<string, FieldErrorKey> = {};
        for (const field of current.fields) {
          if (!isFieldVisible(field, data)) continue;
          const v = typeof data[field.key] === "string" ? (data[field.key] as string) : "";
          const err = fieldFormatError(field, v);
          if (err) fmt[field.key] = err;
        }
        if (Object.keys(fmt).length) setErrors((prev) => ({ ...prev, ...fmt }));
        setCompleteError(summarizeMissing(miss));
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    goNext();
  }

  // Friendly, label-based summary instead of raw field keys (beneficiaries gets its own copy).
  function summarizeMissing(keys: string[]): string {
    const labels = keys
      .map((k) =>
        k === "beneficiaries"
          ? tr(UI.benNeedTwo, locale)
          : fieldByKey(k)
            ? fieldLabel(fieldByKey(k)!, locale)
            : k
      )
      .filter(Boolean);
    return labels.length ? `${tr(UI.pleaseComplete, locale)} ${labels.join(", ")}` : tr(UI.missingFields, locale);
  }

  async function handleFinish() {
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await completeIntake(token);
      if (result.success) {
        setCompleted(true);
        setMissing(new Set());
      } else {
        const miss = new Set(result.missing ?? []);
        setMissing(miss);
        setCompleteError(summarizeMissing(result.missing ?? []));
        if (miss.size) {
          const idx = sections.findIndex((s) => s.fields.some((f) => miss.has(f.key)));
          if (idx >= 0) setStep(idx);
        }
      }
    } catch {
      setCompleteError(tr(UI.missingFields, locale));
    } finally {
      setCompleting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }
  if (loadState === "error") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" /> {tr(UI.loadError, locale)}
      </div>
    );
  }
  if (lockedForClient) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-5 text-center">
        <motion.div
          initial={reduceMotion ? false : { scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-brand to-accent text-white shadow-lg shadow-brand/30"
        >
          <PartyPopper className="h-10 w-10" />
        </motion.div>
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-extrabold tracking-tight"
        >
          {tr(UI.thankYouTitle, locale)}
        </motion.h1>
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mt-3 text-base text-muted-foreground"
        >
          {tr(UI.thankYouBody, locale)}
        </motion.p>
        <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-green-600" /> {tr(UI.secureNote, locale)}
        </p>
      </div>
    );
  }

  const pct = Math.round(((step + 1) / sections.length) * 100);
  const StepIcon = SECTION_ICONS[current.key] ?? FileText;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {isOwner && <IntakeBreadcrumb current={tr(UI.navForm, locale)} />}
      {/* Out-of-flow save status — fixed so it never shifts the page layout. */}
      <SaveIndicator status={saveStatus} locale={locale} />
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{tr(UI.intakeTitle, locale)}</h1>
      <p className="mb-1 text-sm text-muted-foreground">{tr(UI.formSubtitle, locale)}</p>
      <p className="mb-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-green-600" /> {tr(UI.secureNote, locale)}
      </p>

      {/* Step progress */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span className="text-foreground">{sectionTitle(current, locale)}</span>
          <span>
            {tr(UI.step, locale)} {step + 1} {tr(UI.of, locale)} {sections.length} · {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-brand to-accent"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      </div>

      {isOwner && !completed && (
        <MeetingPanel
          locale={locale}
          compact
          meeting={meeting.meeting}
          busy={meeting.busy}
          error={meeting.error}
          canSend={Boolean(session?.crmContactId)}
          onCreate={meeting.create}
          onRevoke={meeting.revoke}
          onSend={meeting.send}
          onReset={meeting.reset}
        />
      )}

      {completed && isOwner && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          <PartyPopper className="h-4 w-4" /> {tr(UI.completed, locale)}
        </div>
      )}

      <div
        ref={cardRef}
        className={`scroll-mt-4 overflow-hidden shadow-md shadow-black/5 ${CARD}`}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-brand to-accent" />
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <StepIcon className="h-5 w-5" />
            </span>
            <h2 className="text-xl font-bold">{sectionTitle(current, locale)}</h2>
          </div>
          {sectionDescription(current, locale) && (
            <p className="mt-2 text-sm text-muted-foreground">{sectionDescription(current, locale)}</p>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="mt-4 space-y-5"
            >
          {/* Same offer for documents, at the top of the step where they belong. Unlike the
              secure-capture link this one stays open, so it keeps rendering while files arrive. */}
          {isOwner && !completed && current.key === "attachments" && (
            <DocumentCapturePanel
              locale={locale}
              capture={documentCapture.capture}
              url={documentCapture.url}
              busy={documentCapture.busy}
              error={documentCapture.error}
              onCreate={documentCapture.create}
              onCancel={documentCapture.cancel}
              onSend={documentCapture.send}
            />
          )}

          {/* Offered, never imposed: most calls never touch this. It sits at the top of the
              payment step because that is where the four fields it covers now live. */}
          {isOwner && !completed && current.key === "payment" && (
            <SecureCapturePanel
              locale={locale}
              capture={secureCapture.capture}
              url={secureCapture.url}
              busy={secureCapture.busy}
              error={secureCapture.error}
              replacedExisting={captureReplaced}
              onCreate={secureCapture.create}
              onCancel={secureCapture.cancel}
              onSend={secureCapture.send}
            />
          )}
          {current.fields.map((field) => {
            if (!isFieldVisible(field, data)) return null;
            if (field.ownerOnly && !isOwner) return null;
            // US citizens: hide the redundant SSN/ITIN choice and country-of-citizenship
            // questions (both auto-filled to SSN / United States above).
            if (data.usCitizen === "yes" && (field.key === "idType" || field.key === "countryOfCitizenship"))
              return null;

            if (field.type === "beneficiaries") {
              return (
                <BeneficiariesEditor
                  key={field.key}
                  locale={locale}
                  value={Array.isArray(data.beneficiaries) ? data.beneficiaries : []}
                  reveal={reveal || !isOwner}
                  onChange={(list) => setField("beneficiaries", list)}
                  invalid={missing.has("beneficiaries")}
                />
              );
            }
            if (field.type === "file") {
              return (
                <FileUploader
                  key={field.key}
                  token={token}
                  fieldKey={field.key}
                  label={fieldLabel(field, locale)}
                  help={fieldHelp(field, locale)}
                  locale={locale}
                  files={Array.isArray(data[field.key]) ? (data[field.key] as FileRef[]) : []}
                  onChange={(files) => setField(field.key, files)}
                />
              );
            }
            return (
              <FieldInput
                key={field.key}
                field={field}
                locale={locale}
                value={typeof data[field.key] === "string" ? (data[field.key] as string) : ""}
                onChange={(v) => setField(field.key, v)}
                onBlur={(v) => validateOnBlur(field, v)}
                onResolveAddress={(addr) => {
                  if (field.fullAddress) {
                    setField(field.key, addr.formatted || addr.line1);
                    return;
                  }
                  setField(field.key, addr.line1);
                  const t = field.addressTargets;
                  if (t?.city && addr.city) setField(t.city, addr.city);
                  if (t?.state && addr.state) setField(t.state, addr.state);
                  if (t?.zip && addr.zip) setField(t.zip, addr.zip);
                }}
                invalid={missing.has(field.key)}
                errorKey={errors[field.key]}
                reveal={reveal}
                isOwner={!!isOwner}
                onToggleReveal={() => setReveal((r) => !r)}
                onFocusChange={(focused) => {
                  focusedKeyRef.current = focused ? field.key : null;
                }}
                belowField={
                  isOwner && field.key === "routingNumber" ? (
                    <>
                      <BankNameHint
                        routingNumber={
                          typeof data.routingNumber === "string" ? data.routingNumber : ""
                        }
                        endpoint="/api/iul-intake/routing-lookup"
                        label={tr(UI.bankNameHint, locale)}
                      />
                      <RoutingLookupPanel
                        locale={locale}
                        bankName={typeof data.bankName === "string" ? data.bankName : ""}
                        onPick={(m) => {
                          setField("routingNumber", m.routingNumber);
                          // Fill the bank name only when it is still blank — never overwrite what
                          // the agent already heard from the client.
                          if (!data.bankName) setField("bankName", m.bankName);
                        }}
                      />
                    </>
                  ) : null
                }
                waitingForClient={
                  secureCapture.capture?.status === "pending" &&
                  (SECURE_CAPTURE_FIELD_KEYS as readonly string[]).includes(field.key)
                }
              />
            );
          })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {completeError && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
          <p className="flex items-start gap-1.5 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {completeError}
          </p>
          {isOwner && sectionsWithMissing.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-red-600">
                {sectionsWithMissing.length} {tr(UI.stepsNeedAttention, locale)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStep(nextIssueIndex(step))}
                className="gap-1 border-red-300 text-red-700 hover:bg-red-100 dark:hover:bg-red-900"
              >
                {tr(UI.nextIssue, locale)} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className={`${OUTLINE_BTN} w-auto px-6 disabled:opacity-40`}
        >
          {tr(UI.back, locale)}
        </button>
        {step < sections.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className={`${GRADIENT_BTN} flex-1 active:scale-[0.98] sm:flex-none sm:min-w-44`}
          >
            {tr(UI.next, locale)} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            disabled={completing}
            className={`${GRADIENT_BTN} flex-1 active:scale-[0.98] sm:flex-none`}
          >
            {completing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {tr(isOwner ? UI.finishing : UI.submitting, locale)}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> {tr(isOwner ? UI.finish : UI.submitApplication, locale)}
              </>
            )}
          </button>
        )}
      </div>

      {/* Bottom step navigation — admins jump to any step; clients move linearly (Back/Next). */}
      {isOwner && (
        <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label={tr(UI.step, locale)}>
          {sections.map((s, i) => {
            const Icon = SECTION_ICONS[s.key] ?? FileText;
            const isCurrent = i === step;
            const hasIssue = sectionsWithMissing.includes(i);
            const done = sectionComplete[i] && !hasIssue;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(i)}
                title={sectionTitle(s, locale)}
                aria-current={isCurrent ? "step" : undefined}
                className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm transition ${
                  isCurrent
                    ? "border-brand bg-brand text-white shadow-sm"
                    : done
                      ? "border-green-500 bg-green-50 text-green-600 dark:bg-green-950"
                      : "border-gray-200 bg-background text-muted-foreground hover:border-brand hover:text-brand dark:border-gray-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {hasIssue && !isCurrent && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-950" />
                )}
                {done && !isCurrent && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-500 text-white ring-2 ring-white dark:ring-gray-950">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/**
 * Save status as a fixed-position pill (bottom-right). Out of the normal document flow and
 * always mounted (fades via opacity), so appearing/disappearing never shifts the page layout.
 */
function SaveIndicator({ status, locale }: { status: string; locale: IntakeLocale }) {
  const visible = status === "pending" || status === "saved" || status === "error";
  const tone =
    status === "error" ? "text-red-600" : status === "saved" ? "text-green-700" : "text-muted-foreground";
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-1.5 text-xs shadow-md backdrop-blur transition-opacity duration-300 dark:bg-gray-900/95 ${tone} ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {status === "pending" && (
        <>
          <CloudUpload className="h-4 w-4 animate-pulse" /> {tr(UI.saving, locale)}
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-4 w-4" /> {tr(UI.saved, locale)}
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-4 w-4" /> {tr(UI.saveError, locale)}
        </>
      )}
    </div>
  );
}

/** Options long enough that two of them side by side would wrap mid-word. */
const STACK_OPTION_CHARS = 14;

/**
 * Multiple-choice questions as tappable cards.
 *
 * Was a native `<input type="radio">` inside a bordered label; now the shared `ChoiceCard`, so the
 * agent's screen matches the Final Expense wizard. No icons: IUL's options come from a field
 * config ("Single / Married / Divorced / Widowed", "Living / Deceased") and picking a glyph for
 * each would be decoration standing in for meaning.
 */
function RadioOptions({
  options,
  value,
  locale,
  onChange,
}: {
  options: IntakeOption[];
  value: string;
  locale: IntakeLocale;
  onChange: (v: string) => void;
}) {
  const labels = options.map((opt) => optionLabel(opt, locale));
  const stacked = labels.some((l) => l.length > STACK_OPTION_CHARS);

  return (
    <div role="radiogroup" className={`grid gap-2.5 ${stacked ? "grid-cols-1" : "sm:grid-cols-2"}`}>
      {options.map((opt, i) => (
        <ChoiceCard
          key={opt.value}
          selected={value === opt.value}
          label={labels[i]}
          onClick={() => onChange(opt.value)}
        />
      ))}
    </div>
  );
}

function FieldInput({
  field,
  locale,
  value,
  onChange,
  onBlur,
  onResolveAddress,
  invalid,
  errorKey,
  reveal,
  isOwner,
  onToggleReveal,
  onFocusChange,
  waitingForClient = false,
  belowField,
}: {
  field: IntakeField;
  locale: IntakeLocale;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  onResolveAddress: (addr: ResolvedAddress) => void;
  invalid?: boolean;
  errorKey?: FieldErrorKey;
  reveal: boolean;
  isOwner: boolean;
  onToggleReveal: () => void;
  /** Reported up so a live capture never overwrites the field under the agent's cursor. */
  onFocusChange?: (focused: boolean) => void;
  /** A secure capture link is out and this is one of the fields it will fill. */
  waitingForClient?: boolean;
  /** Extra controls rendered under the field — today, the routing-number lookup. */
  belowField?: React.ReactNode;
}) {
  const id = `f-${field.key}`;
  const label = fieldLabel(field, locale);
  const help = fieldHelp(field, locale);
  const placeholder = fieldPlaceholder(field, locale);
  const showInvalid = invalid || !!errorKey;
  const invalidCls = showInvalid ? INVALID_INPUT : "";
  const inputCls = `${FIELD_INPUT} ${invalidCls}`;

  /** Sensitive digits stay obscured unless the agent asks — a client is often watching this screen. */
  const secret = Boolean(field.sensitive) && !reveal;

  /** The counter copy for any fixed-length digit field. */
  const digitLabels: CountedDigitsLabels = {
    looksGood: tr(UI.looksGood, locale),
    remaining: tr(UI.digitsRemaining, locale),
    masked: tr(UI.valueOnFile, locale),
  };

  function handleDigits(raw: string) {
    let v = raw.replace(/\D/g, "");
    if (field.maxLength) v = v.slice(0, field.maxLength);
    onChange(v);
  }

  return (
    <div
      onFocusCapture={() => onFocusChange?.(true)}
      onBlurCapture={() => onFocusChange?.(false)}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className={`${FIELD_LABEL} mb-0`}>
          {label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        {field.sensitive && isOwner && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {reveal ? tr(UI.hide, locale) : tr(UI.reveal, locale)}
          </button>
        )}
      </div>

      {field.type === "select" ? (
        field.options && field.options.length === 2 ? (
          // Two-option questions (Yes/No, Sex, etc.) render as tappable cards.
          <RadioOptions
            options={field.options.filter((opt) => isOwner || !opt.ownerOnly)}
            value={value}
            locale={locale}
            onChange={onChange}
          />
        ) : (
          <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${FIELD_SELECT} ${invalidCls}`}
          >
            <option value="">{tr(UI.choose, locale)}</option>
            {field.options
              ?.filter((opt) => isOwner || !opt.ownerOnly)
              .map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {optionLabel(opt, locale)}
                </option>
              ))}
          </select>
        )
      ) : field.type === "country" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_SELECT} ${invalidCls}`}
        >
          <option value="">{tr(UI.choose, locale)}</option>
          {countriesFor(locale).map((c) => (
            <option key={c.value} value={c.value}>
              {locale === "es" ? c.labelEs : c.labelEn}
            </option>
          ))}
        </select>
      ) : field.type === "dob" ? (
        <DobParts value={value} onChange={onChange} invalid={showInvalid} locale={locale} />
      ) : field.type === "height" ? (
        <HeightSelect id={id} value={value} onChange={onChange} invalid={showInvalid} locale={locale} />
      ) : field.metric === "kg" ? (
        <WeightInput id={id} value={value} onChange={onChange} onBlur={onBlur} invalid={showInvalid} maxLength={field.maxLength} locale={locale} />
      ) : field.type === "address" ? (
        <IntakeAddressInput
          id={id}
          value={value}
          onChange={onChange}
          onResolve={onResolveAddress}
          placeholder={placeholder}
          invalid={showInvalid}
          locale={locale}
          fullAddress={field.fullAddress}
          className={inputCls}
          fontSize="1.125rem"
        />
      ) : field.type === "money" ? (
        <CurrencyInput id={id} value={value} onChange={onChange} invalid={showInvalid} />
      ) : field.type === "textarea" ? (
        <textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${FIELD_TEXTAREA} ${invalidCls}`}
        />
      ) : field.type === "tel" ? (
        <CountedDigitsField
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          format={formatUsPhone}
          digitsNeeded={10}
          labels={digitLabels}
          placeholder={placeholder}
          inputMode="tel"
          autoComplete="tel"
          invalid={showInvalid}
          className={inputCls}
        />
      ) : /* Fixed-length digit fields get the live counter: it says how many digits are left
            instead of silently refusing to validate. This is also what finally gives IUL the
            123-45-6789 grouping every other line of business already had. */
      field.type === "ssn" ? (
        <CountedDigitsField
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          format={formatSsn}
          digitsNeeded={9}
          labels={digitLabels}
          placeholder="123-45-6789"
          autoComplete="off"
          secret={secret}
          invalid={showInvalid}
          className={inputCls}
        />
      ) : field.digitsOnly && field.maxLength === 9 ? (
        <CountedDigitsField
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          format={(raw) => raw.replace(/\D/g, "").slice(0, 9)}
          digitsNeeded={9}
          labels={digitLabels}
          placeholder={placeholder}
          autoComplete="off"
          secret={secret}
          invalid={showInvalid}
          className={inputCls}
        />
      ) : field.digitsOnly && field.maxLength === 5 ? (
        <CountedDigitsField
          id={id}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          format={(raw) => raw.replace(/\D/g, "").slice(0, 5)}
          digitsNeeded={5}
          labels={digitLabels}
          placeholder={placeholder}
          autoComplete="postal-code"
          invalid={showInvalid}
          className={inputCls}
        />
      ) : field.type === "number" || field.digitsOnly ? (
        <input
          id={id}
          type={secret ? "password" : "text"}
          onFocus={() => {
            // The server sends a mask for stored sensitive values; clear it before the
            // digits-only handler strips the bullets and leaves a stub behind.
            if (field.sensitive && isMaskedValue(value)) onChange("");
          }}
          inputMode="numeric"
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          maxLength={field.maxLength}
          onChange={(e) => handleDigits(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={inputCls}
        />
      ) : (
        <input
          id={id}
          type={secret ? "password" : field.type === "email" ? "email" : "text"}
          onFocus={() => {
            if (field.sensitive && isMaskedValue(value)) onChange("");
          }}
          inputMode={field.type === "email" ? "email" : undefined}
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={inputCls}
        />
      )}

      {errorKey ? (
        // Amber, not red: a half-typed phone number is an unfinished thought, not a breakage.
        <p className="mt-2 flex items-start gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-500">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessageFor(errorKey, locale)}
        </p>
      ) : waitingForClient ? (
        // The field stays editable on purpose — if the client goes quiet mid-call, the agent
        // takes over by typing, without having to cancel anything first.
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-brand">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          {tr(UI.captureFieldWaiting, locale)}
        </p>
      ) : (
        help && <p className="mt-1.5 text-sm text-muted-foreground">{help}</p>
      )}

      {belowField}
    </div>
  );
}

/**
 * Calculator-style dollar input: digits fill from the right (1 → $0.01, 10 → $0.10,
 * 100 → $1.00…). Stores canonical "dollars.cents"; older whole-dollar values still display.
 */
function CurrencyInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (stored: string) => void;
  invalid?: boolean;
}) {
  return (
    <div
      className={`flex h-11 w-full items-center rounded-md border bg-background px-3 sm:h-10 ${
        invalid ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500" : "border-input focus-within:ring-2 focus-within:ring-ring"
      } focus-within:ring-offset-2`}
    >
      <span className="mr-1 text-muted-foreground">$</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatMoneyDisplay(value)}
        onChange={(e) => onChange(digitsToStored(e.target.value))}
        placeholder="0.00"
        className="h-full w-full border-0 bg-transparent text-base outline-none sm:text-sm"
      />
    </div>
  );
}

/**
 * Weight in lbs with an optional "Prefer kilograms?" helper that converts to lbs.
 */
function WeightInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  maxLength,
  locale,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  invalid?: boolean;
  maxLength?: number;
  locale: IntakeLocale;
}) {
  const [metric, setMetric] = useState(false);
  const [kg, setKg] = useState("");
  const invalidCls = invalid ? INVALID_INPUT : "";
  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, maxLength))}
        onBlur={(e) => onBlur(e.target.value)}
        className={`${FIELD_INPUT} ${invalidCls}`}
      />
      <button
        type="button"
        onClick={() => setMetric((m) => !m)}
        className="mt-1.5 text-sm font-medium text-brand underline"
      >
        {tr(UI.preferKg, locale)}
      </button>
      {metric && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-10 w-32 items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <input
              type="text"
              inputMode="decimal"
              value={kg}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setKg(v);
                onChange(kgToLbs(v));
              }}
              className="h-full w-full border-0 bg-transparent text-base outline-none sm:text-sm"
            />
            <span className="ml-1 text-muted-foreground">{tr(UI.kgUnit, locale)}</span>
          </div>
          {value && (
            <span className="text-xs text-muted-foreground">
              = {value} {tr(UI.lbsUnit, locale)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Month / Day / Year selects → ISO YYYY-MM-DD. Holds local part state so a partial
 * selection (e.g. month chosen, year not yet) doesn't wipe the other dropdowns; emits the
 * ISO string to the parent when complete & valid, or "" while incomplete.
 */
function DobParts({
  value,
  onChange,
  invalid,
  locale,
}: {
  value: string;
  onChange: (iso: string) => void;
  invalid?: boolean;
  locale: IntakeLocale;
}) {
  const [parts, setParts] = useState(() => splitDobIso(value));

  // Re-sync when the parent value changes to a different complete date (e.g. loaded data).
  useEffect(() => {
    setParts((prev) => {
      const prevIso = buildDobIso(prev.month, prev.day, prev.year);
      if (value && value !== prevIso) return splitDobIso(value);
      return prev;
    });
  }, [value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear - i));
  const cls = `${SELECT_INPUT} ${invalid ? INVALID_INPUT : ""}`;

  function set(next: { month?: string; day?: string; year?: string }) {
    const merged = { ...parts, ...next };
    setParts(merged);
    onChange(buildDobIso(merged.month, merged.day, merged.year));
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select aria-label={tr(UI.dobMonth, locale)} value={parts.month} onChange={(e) => set({ month: e.target.value })} className={cls}>
        <option value="">{tr(UI.dobMonth, locale)}</option>
        {MONTHS[locale].map((name, i) => (
          <option key={i} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={tr(UI.dobDay, locale)} value={parts.day} onChange={(e) => set({ day: e.target.value })} className={cls}>
        <option value="">{tr(UI.dobDay, locale)}</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>
            {d}
          </option>
        ))}
      </select>
      <select aria-label={tr(UI.dobYear, locale)} value={parts.year} onChange={(e) => set({ year: e.target.value })} className={cls}>
        <option value="">{tr(UI.dobYear, locale)}</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

/* Feet + inches selects → e.g. 5'9". */
function HeightSelect({
  id,
  value,
  onChange,
  invalid,
  locale,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  locale: IntakeLocale;
}) {
  const { feet, inches } = parseHeight(value);
  const cls = `${SELECT_INPUT} ${invalid ? INVALID_INPUT : ""}`;
  const [metric, setMetric] = useState(false);
  const [cm, setCm] = useState("");
  return (
    <div id={id}>
      <div className="grid grid-cols-2 gap-2">
        <select value={feet} onChange={(e) => onChange(buildHeight(e.target.value, inches))} className={cls}>
          <option value="">{tr(UI.heightFeet, locale)}</option>
          {[4, 5, 6, 7].map((f) => (
            <option key={f} value={String(f)}>
              {f} {tr(UI.heightFeet, locale)}
            </option>
          ))}
        </select>
        <select value={inches} onChange={(e) => onChange(buildHeight(feet, e.target.value))} className={cls} disabled={!feet}>
          <option value="">{tr(UI.heightInches, locale)}</option>
          {Array.from({ length: 12 }, (_, i) => i).map((inch) => (
            <option key={inch} value={String(inch)}>
              {inch} {tr(UI.heightInches, locale)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => setMetric((m) => !m)}
        className="mt-1.5 text-sm font-medium text-brand underline"
      >
        {tr(UI.preferCm, locale)}
      </button>
      {metric && (
        <div className="mt-1 flex items-center gap-2">
          <div className="flex h-10 w-32 items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <input
              type="text"
              inputMode="decimal"
              value={cm}
              placeholder="0"
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "");
                setCm(v);
                onChange(cmToHeight(v));
              }}
              className="h-full w-full border-0 bg-transparent text-base outline-none sm:text-sm"
            />
            <span className="ml-1 text-muted-foreground">{tr(UI.cmUnit, locale)}</span>
          </div>
          {value && <span className="text-xs text-muted-foreground">= {value}</span>}
        </div>
      )}
    </div>
  );
}

function BeneficiariesEditor({
  locale,
  value,
  onChange,
  reveal,
  invalid,
}: {
  locale: IntakeLocale;
  value: Beneficiary[];
  onChange: (list: Beneficiary[]) => void;
  reveal: boolean;
  invalid?: boolean;
}) {
  // At least two beneficiaries are required — start with two empty rows.
  const list = useMemo(
    () => (value.length ? value : [emptyBeneficiary(), emptyBeneficiary()]),
    [value]
  );
  const total = beneficiaryPercentTotal(list);
  const showTotalWarning = list.some((b) => b.percent.trim()) && total !== 100;

  function update(idx: number, patch: Partial<Beneficiary>) {
    const next = list.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange(next);
  }
  function add() {
    if (list.length >= MAX_BENEFICIARIES) return;
    onChange([...list, emptyBeneficiary()]);
  }
  function remove(idx: number) {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.length ? next : [emptyBeneficiary()]);
  }

  return (
    <div className={`space-y-4 ${invalid ? "rounded-md border border-red-500 p-3" : ""}`}>
      {list.map((b, idx) => {
        return (
          <div key={idx} className="rounded-2xl border-2 border-gray-200 p-4 dark:border-gray-800">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">
                {tr(UI.beneficiary, locale)} {idx + 1}
              </span>
              {list.length > 1 && (
                <button type="button" onClick={() => remove(idx)} className="text-xs text-red-600 hover:underline">
                  {tr(UI.remove, locale)}
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label={tr(UI.benFirstName, locale)} value={b.firstName} onChange={(v) => update(idx, { firstName: v })} />
              <LabeledInput label={tr(UI.benLastName, locale)} value={b.lastName} onChange={(v) => update(idx, { lastName: v })} />
              <div>
                <Label className="text-xs">{tr(UI.benRelationship, locale)}</Label>
                <select
                  value={b.relationship}
                  onChange={(e) => update(idx, { relationship: e.target.value })}
                  className={SMALL_INPUT}
                >
                  <option value="">{tr(UI.choose, locale)}</option>
                  {BENEFICIARY_RELATIONSHIPS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {optionLabel(opt, locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">{tr(UI.benPercent, locale)}</Label>
                <div className="flex h-11 items-center rounded-md border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:h-10">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={b.percent}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "").slice(0, 3);
                      if (v && Number(v) > 100) v = "100";
                      update(idx, { percent: v });
                    }}
                    className="h-full w-full border-0 bg-transparent text-base outline-none sm:text-sm"
                  />
                  <span className="ml-1 text-muted-foreground">%</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">{tr(UI.benDob, locale)}</Label>
                <DobParts value={b.dateOfBirth} onChange={(iso) => update(idx, { dateOfBirth: iso })} locale={locale} />
              </div>
              <LabeledInput
                label={tr(UI.benSsn, locale)}
                value={b.ssn}
                onChange={(v) =>
                  update(idx, {
                    // A masked beneficiary SSN must not be digit-stripped into a stub.
                    ssn: isMaskedValue(v) ? v : v.replace(/\D/g, "").slice(0, 9),
                  })
                }
                onFocus={() => {
                  if (isMaskedValue(b.ssn)) update(idx, { ssn: "" });
                }}
                type={reveal ? "text" : "password"}
                inputMode="numeric"
              />
            </div>
          </div>
        );
      })}
      {showTotalWarning && (
        <p className="flex items-center gap-1 text-xs text-amber-600">
          <AlertCircle className="h-3.5 w-3.5" /> {tr(UI.benTotalWarning, locale)} ({total}%)
        </p>
      )}
      {list.length < MAX_BENEFICIARIES && (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          {tr(UI.addBeneficiary, locale)}
        </Button>
      )}
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  onFocus,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  type?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div>
      <label className={SMALL_LABEL}>{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className={SMALL_INPUT}
      />
    </div>
  );
}

function FileUploader({
  token,
  fieldKey,
  label,
  help,
  locale,
  files,
  onChange,
}: {
  token: string;
  fieldKey: string;
  label: string;
  help?: string;
  locale: IntakeLocale;
  files: FileRef[];
  onChange: (files: FileRef[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = `file-${fieldKey}`;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      let latest = files;
      for (const file of Array.from(fileList)) {
        const res = await uploadIntakeFile(token, fieldKey, file);
        latest = res.files;
      }
      onChange(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(UI.uploadError, locale));
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(url: string) {
    try {
      const res = await removeIntakeFile(token, fieldKey, url);
      onChange(res.files);
    } catch {
      setError(tr(UI.uploadError, locale));
    }
  }

  return (
    <div>
      <Label className="mb-0.5 block">{label}</Label>
      {help && <p className="mb-1 text-xs font-medium text-blue-600">{help}</p>}
      {files.length > 0 && (
        <ul className="mb-2 space-y-2">
          {files.map((f) => {
            /**
             * A thumbnail when Cloudinary can render one, an icon otherwise.
             *
             * `canPreview` is false for anything attached before previews existed, and for formats
             * with no still image to show (a .docx, a .zip). Those are not failures — the file is
             * there and the link opens it — so they get an icon rather than a broken frame.
             */
            const preview = canPreview(f)
              ? `/api/iul-intake/${token}/files/preview?id=${encodeURIComponent(f.cloudinaryId!)}`
              : null;
            return (
              <li
                key={f.url || f.name}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-gray-200 p-2 text-sm dark:border-gray-800"
              >
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-center gap-3 text-blue-600 hover:underline"
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived
                    // Cloudinary URL behind a redirect; next/image would need a loader and would
                    // cache a client's identity document on our own CDN.
                    <img
                      src={preview}
                      alt={f.name}
                      loading="lazy"
                      className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </span>
                  )}
                  <span className="truncate">{f.name}</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleRemove(f.url)}
                  className="shrink-0 text-muted-foreground hover:text-red-600"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input
        id={inputId}
        type="file"
        /* No `accept`: the agent may need a Word file, a scan or something none of us predicted,
           and any allow-list here shows a file the picker will not let them select. */
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => document.getElementById(inputId)?.click()}>
        {uploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr(UI.uploading, locale)}
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" /> {tr(UI.uploadFile, locale)}
          </>
        )}
      </Button>
      <p className="mt-1 text-xs text-muted-foreground">{tr(UI.fileHint, locale)}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
