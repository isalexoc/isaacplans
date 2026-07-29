"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Check,
  CloudUpload,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  PartyPopper,
  Camera,
  Upload,
  FileText,
  X,
  Plus,
  ArrowRight,
  Send,
  User,
  MapPin,
  DollarSign,
  Users,
  CreditCard,
  Stethoscope,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  fetchAcaIntake,
  completeAcaIntake,
  uploadAcaIntakeFile,
  removeAcaIntakeFile,
  type FileTargetRef,
} from "@/lib/aca-intake-api";
import { useAcaIntakeAutosave } from "@/hooks/use-aca-intake-autosave";
import AcaIntakeBreadcrumb from "@/components/aca-intake/intake-breadcrumb";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import {
  visibleSections,
  isFieldVisible,
  fieldByKey,
  emptyRow,
  type AcaField,
  type AcaOption,
  type FileRef,
  type RepeaterRow,
} from "@/lib/aca-intake/fields";
import { fieldFormatError, type FieldErrorKey } from "@/lib/aca-intake/validation";
import { digitsToStored, formatMoneyDisplay } from "@/lib/iul-intake/money";
import { sectionMissingFields, type AcaIntakeData } from "@/lib/aca-intake/schema";
import type { AcaIntakeSession } from "@/lib/aca-intake/types";
import {
  MONTHS,
  buildDobIso,
  splitDobIso,
  formatUsPhone,
  formatCardExpiration,
} from "@/lib/intake-shared/format";
import { compressImageFile, MAX_UPLOAD_BYTES, formatBytes } from "@/lib/image-compress";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  fieldPlaceholder,
  fieldHelp,
  optionLabel,
  rowLabel,
  sectionTitle,
  sectionDescription,
  type AcaLocale,
} from "@/lib/aca-intake/ui-strings";

/* ------------------------------- helpers ------------------------------- */

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Path used for per-row validation keys: `householdMembers[2].ssn`. */
function rowPath(repeaterKey: string, index: number, subKey: string): string {
  return `${repeaterKey}[${index}].${subKey}`;
}

function errorMessageFor(key: FieldErrorKey, locale: AcaLocale): string {
  switch (key) {
    case "email":
      return tr(UI.errEmail, locale);
    case "phone":
      return tr(UI.errPhone, locale);
    case "zip":
      return tr(UI.errZip, locale);
    case "ssn":
      return tr(UI.errSsn, locale);
    case "dob":
      return tr(UI.errDob, locale);
    case "routing":
      return tr(UI.errRouting, locale);
    case "card":
      return tr(UI.errCard, locale);
    case "cardExpiration":
      return tr(UI.errCardExpiration, locale);
    case "cvv":
      return tr(UI.errCvv, locale);
    default:
      return tr(UI.fixErrors, locale);
  }
}

/** Icon per section, shown in a colored chip next to the step title. */
const SECTION_ICONS: Record<string, LucideIcon> = {
  personal: User,
  residence: MapPin,
  household: Users,
  income: DollarSign,
  medical: Stethoscope,
  documents: FileText,
  payment: CreditCard,
  agent: StickyNote,
};

/** Identity sub-fields on household member row 0, mirrored from step 1 and shown read-only. */
const PRIMARY_MIRROR_KEYS = ["firstName", "lastName", "dateOfBirth", "sex", "ssn"] as const;

/** Add-button copy per repeater. */
function addLabelFor(fieldKey: string, locale: AcaLocale): string {
  if (fieldKey === "householdMembers") return tr(UI.addMember, locale);
  if (fieldKey === "doctorsToKeep") return tr(UI.addDoctor, locale);
  if (fieldKey === "prescriptions") return tr(UI.addPrescription, locale);
  return tr(UI.addRow, locale);
}

/* ------------------------------- component ------------------------------- */

export default function AcaIntakeForm({ token }: { token: string }) {
  const locale = pickLocale(useLocale());

  const [session, setSession] = useState<AcaIntakeSession | null>(null);
  const [data, setData] = useState<AcaIntakeData>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, FieldErrorKey>>({});
  const [completeError, setCompleteError] = useState<string | null>(null);
  // Sensitive fields (SSN, routing/account, card) show their value by default so users can
  // see what they type; owners can still toggle Hide.
  const [reveal, setReveal] = useState(true);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchAcaIntake(token);
        if (!active) return;
        setSession(s);
        setData({ ...(s.data ?? {}) });
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

  const { status: saveStatus } = useAcaIntakeAutosave({ token, data });

  const isOwner = session?.role === "owner";
  const sections = useMemo(() => visibleSections(!!isOwner), [isOwner]);
  // A client who has submitted can't edit until an admin re-opens the form.
  const lockedForClient = !isOwner && completed && !session?.reopenedForClient;

  /**
   * Household member row 0 IS the primary applicant, so mirror their step-1 identity into it.
   * Only writes when something actually differs, otherwise this effect would loop on itself.
   */
  useEffect(() => {
    if (loadState !== "ready") return;
    const memberField = fieldByKey("householdMembers");
    if (!memberField) return;

    setData((prev) => {
      const rows: RepeaterRow[] = Array.isArray(prev.householdMembers)
        ? [...(prev.householdMembers as RepeaterRow[])]
        : [];
      const row0: RepeaterRow = { ...(rows[0] ?? emptyRow(memberField)) };

      const patch: RepeaterRow = { relationship: "Self" };
      for (const key of PRIMARY_MIRROR_KEYS) patch[key] = str(prev[key]);
      // The primary answered the SSN question in step 1, so don't ask again here.
      patch.hasSsn = str(prev.ssn) ? "yes" : str(row0.hasSsn);

      const changed = Object.entries(patch).some(([k, v]) => str(row0[k]) !== str(v));
      if (!changed) return prev;

      rows[0] = { ...row0, ...patch };
      return { ...prev, householdMembers: rows };
    });
  }, [loadState, data.firstName, data.lastName, data.dateOfBirth, data.sex, data.ssn]);

  // Keep step in range when the section list changes (role resolves after load).
  useEffect(() => {
    setStep((s) => Math.min(s, sections.length - 1));
  }, [sections.length]);

  // On step change, bring the step's content (title + first field) into view.
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  function clearFlags(key: string) {
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

  function setField(key: string, value: unknown) {
    setData((prev) => ({ ...prev, [key]: value }));
    clearFlags(key);
  }

  /** Update one sub-field of one repeater row, keyed by path for validation flags. */
  function setRowField(repeaterKey: string, index: number, subKey: string, value: unknown) {
    setData((prev) => {
      const field = fieldByKey(repeaterKey);
      const rows: RepeaterRow[] = Array.isArray(prev[repeaterKey])
        ? [...(prev[repeaterKey] as RepeaterRow[])]
        : [];
      while (rows.length <= index) rows.push(field ? emptyRow(field) : {});
      rows[index] = { ...rows[index], [subKey]: value as string | FileRef[] };
      return { ...prev, [repeaterKey]: rows };
    });
    clearFlags(rowPath(repeaterKey, index, subKey));
    clearFlags(repeaterKey);
  }

  function validateOnBlur(field: AcaField, value: string, key: string) {
    const err = fieldFormatError(field, value);
    setErrors((prev) => {
      if (err) return { ...prev, [key]: err };
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const current = sections[step];

  // Section indices that still contain an unresolved missing field (ordered).
  const sectionsWithMissing = useMemo(() => {
    if (!missing.size) return [];
    const keys = Array.from(missing);
    return sections.reduce<number[]>((acc, section, idx) => {
      const hit = section.fields.some(
        (f) => missing.has(f.key) || keys.some((k) => k.startsWith(`${f.key}[`))
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
          const v = data[f.key];
          if (f.type === "repeater") {
            const rows = Array.isArray(v) ? (v as RepeaterRow[]) : [];
            return rows.some((r) => Object.values(r ?? {}).some((x) => String(x ?? "").trim()));
          }
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
        setCompleteError(summarizeMissing(miss));
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    goNext();
  }

  /** Friendly, label-based summary instead of raw field keys / row paths. */
  function summarizeMissing(keys: string[]): string {
    const labels = keys
      .map((k) => {
        const rowMatch = /^([^[]+)\[(\d+)\]\.(.+)$/.exec(k);
        if (rowMatch) {
          const [, repeaterKey, indexRaw, subKey] = rowMatch;
          const repeater = fieldByKey(repeaterKey);
          const sub = repeater?.rowFields?.find((f) => f.key === subKey);
          const who = `${rowLabel(repeater ?? ({} as AcaField), locale)} ${Number(indexRaw) + 1}`.trim();
          return sub ? `${who}: ${fieldLabel(sub, locale)}` : who;
        }
        if (k === "householdMembers") return tr(UI.needOneMember, locale);
        const f = fieldByKey(k);
        return f ? fieldLabel(f, locale) : k;
      })
      .filter(Boolean);
    // De-duplicate — one missing member can produce several sub-field paths.
    const unique = Array.from(new Set(labels));
    return unique.length
      ? `${tr(UI.pleaseComplete, locale)} ${unique.join(", ")}`
      : tr(UI.missingFields, locale);
  }

  async function handleFinish() {
    setCompleting(true);
    setCompleteError(null);
    try {
      const result = await completeAcaIntake(token);
      if (result.success) {
        setCompleted(true);
        setMissing(new Set());
      } else {
        const miss = new Set(result.missing ?? []);
        setMissing(miss);
        setCompleteError(summarizeMissing(result.missing ?? []));
        if (miss.size) {
          const keys = Array.from(miss);
          const idx = sections.findIndex((s) =>
            s.fields.some((f) => miss.has(f.key) || keys.some((k) => k.startsWith(`${f.key}[`)))
          );
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
      {isOwner && <AcaIntakeBreadcrumb current={tr(UI.navForm, locale)} />}
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

      {completed && isOwner && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          <PartyPopper className="h-4 w-4" /> {tr(UI.completed, locale)}
        </div>
      )}

      <div
        ref={cardRef}
        className="scroll-mt-4 overflow-hidden rounded-2xl border bg-white shadow-md shadow-black/5 dark:bg-gray-950"
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
              {current.fields.map((field) => {
                if (!isFieldVisible(field, data)) return null;
                if (field.ownerOnly && !isOwner) return null;

                if (field.type === "repeater") {
                  return (
                    <RepeaterEditor
                      key={field.key}
                      field={field}
                      token={token}
                      locale={locale}
                      rows={Array.isArray(data[field.key]) ? (data[field.key] as RepeaterRow[]) : []}
                      onSetRowField={(i, subKey, value) => setRowField(field.key, i, subKey, value)}
                      onReplaceRows={(rows) => setField(field.key, rows)}
                      missing={missing}
                      errors={errors}
                      onBlurSub={validateOnBlur}
                      isOwner={!!isOwner}
                      reveal={reveal || !isOwner}
                      lockedFirstRow={field.key === "householdMembers"}
                      addLabel={addLabelFor(field.key, locale)}
                    />
                  );
                }

                if (field.type === "file") {
                  return (
                    <FileUploader
                      key={field.key}
                      token={token}
                      target={{ fieldKey: field.key }}
                      label={fieldLabel(field, locale)}
                      help={fieldHelp(field, locale)}
                      required={field.required}
                      locale={locale}
                      invalid={missing.has(field.key)}
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
                    value={str(data[field.key])}
                    onChange={(v) => setField(field.key, v)}
                    onBlur={(v) => validateOnBlur(field, v, field.key)}
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
                      if (t?.county && addr.county) setField(t.county, addr.county);
                    }}
                    invalid={missing.has(field.key)}
                    errorKey={errors[field.key]}
                    reveal={reveal}
                    isOwner={!!isOwner}
                    onToggleReveal={() => setReveal((r) => !r)}
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
        <Button
          variant="ghost"
          size="lg"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="text-muted-foreground"
        >
          {tr(UI.back, locale)}
        </Button>
        {step < sections.length - 1 ? (
          <Button
            size="lg"
            onClick={handleNext}
            className="flex-1 gap-2 bg-gradient-to-r from-brand to-accent text-white shadow-md shadow-brand/30 transition active:scale-[0.98] hover:opacity-95 sm:flex-none sm:min-w-44"
          >
            {tr(UI.next, locale)} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleFinish}
            disabled={completing}
            className="flex-1 gap-2 bg-gradient-to-r from-brand to-accent text-white shadow-md shadow-brand/30 transition active:scale-[0.98] hover:opacity-95 sm:flex-none"
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
          </Button>
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
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-xs transition ${
                  isCurrent
                    ? "border-brand bg-brand text-white shadow-sm"
                    : done
                      ? "border-green-500 bg-green-50 text-green-600 dark:bg-green-950"
                      : "border-input bg-background text-muted-foreground hover:border-brand hover:text-brand"
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
function SaveIndicator({ status, locale }: { status: string; locale: AcaLocale }) {
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

/* Shared select styling (native selects are best on mobile). */
const selectCls =
  "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:h-11 sm:text-sm";
const inputBase = "h-12 text-base focus-visible:ring-brand sm:h-11 sm:text-sm";

/** Two-option questions (Yes/No, Sex, etc.) as tappable radio cards — left unselected by default. */
function RadioOptions({
  id,
  options,
  value,
  locale,
  invalid,
  disabled,
  onChange,
}: {
  id: string;
  options: AcaOption[];
  value: string;
  locale: AcaLocale;
  invalid?: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`flex min-h-[3rem] items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-center text-base leading-tight transition sm:min-h-[2.75rem] sm:text-sm ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${
              selected
                ? "border-brand bg-brand/5 font-medium text-brand ring-1 ring-brand"
                : `${invalid ? "border-red-500" : "border-input"} text-foreground hover:border-brand`
            }`}
          >
            <input
              type="radio"
              name={id}
              value={opt.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 shrink-0 accent-brand"
            />
            {optionLabel(opt, locale)}
          </label>
        );
      })}
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
  idPrefix = "f",
  disabled,
  compact,
}: {
  field: AcaField;
  locale: AcaLocale;
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  onResolveAddress?: (addr: ResolvedAddress) => void;
  invalid?: boolean;
  errorKey?: FieldErrorKey;
  reveal: boolean;
  isOwner: boolean;
  onToggleReveal?: () => void;
  /** Keeps DOM ids unique when the same field renders inside several repeater rows. */
  idPrefix?: string;
  disabled?: boolean;
  /** Smaller label styling for use inside repeater rows. */
  compact?: boolean;
}) {
  const id = `${idPrefix}-${field.key}`;
  const label = fieldLabel(field, locale);
  const help = fieldHelp(field, locale);
  const placeholder = fieldPlaceholder(field, locale);
  const showInvalid = invalid || !!errorKey;
  const invalidCls = showInvalid ? "border-red-500 focus-visible:ring-red-500" : "";
  const disabledCls = disabled ? "opacity-60" : "";

  function handleDigits(raw: string) {
    let v = raw.replace(/\D/g, "");
    if (field.maxLength) v = v.slice(0, field.maxLength);
    onChange(v);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label htmlFor={id} className={`${showInvalid ? "text-red-600" : ""} ${compact ? "text-xs" : ""}`}>
          {label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
        {field.sensitive && isOwner && onToggleReveal && (
          <button
            type="button"
            onClick={onToggleReveal}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {reveal ? tr(UI.hide, locale) : tr(UI.reveal, locale)}
          </button>
        )}
      </div>

      {field.type === "select" ? (
        field.options && field.options.length === 2 ? (
          // Two-option questions (Yes/No, Sex, etc.) render as tappable radio buttons.
          <RadioOptions
            id={id}
            options={field.options.filter((opt) => isOwner || !opt.ownerOnly)}
            value={value}
            locale={locale}
            invalid={showInvalid}
            disabled={disabled}
            onChange={onChange}
          />
        ) : (
          <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className={`${selectCls} ${invalidCls} ${disabledCls}`}
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
      ) : field.type === "dob" ? (
        <DobParts value={value} onChange={onChange} invalid={showInvalid} locale={locale} disabled={disabled} />
      ) : field.type === "address" && onResolveAddress ? (
        <IntakeAddressInput
          id={id}
          value={value}
          onChange={onChange}
          onResolve={onResolveAddress}
          placeholder={placeholder}
          invalid={showInvalid}
          locale={locale}
          fullAddress={field.fullAddress}
        />
      ) : field.type === "money" ? (
        <CurrencyInput id={id} value={value} onChange={onChange} invalid={showInvalid} />
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} ${invalidCls} ${disabledCls}`}
        />
      ) : field.type === "tel" ? (
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          value={formatUsPhone(value)}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(formatUsPhone(e.target.value))}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls} ${disabledCls}`}
        />
      ) : field.key === "cardExpiration" ? (
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={formatCardExpiration(value)}
          placeholder="MM/YY"
          disabled={disabled}
          onChange={(e) => onChange(formatCardExpiration(e.target.value))}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls} ${disabledCls}`}
        />
      ) : field.type === "ssn" || field.type === "zip" || field.type === "number" || field.digitsOnly ? (
        <Input
          id={id}
          type={field.sensitive && !reveal ? "password" : "text"}
          inputMode="numeric"
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={field.type === "ssn" ? 9 : field.maxLength}
          onChange={(e) => handleDigits(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls} ${disabledCls}`}
        />
      ) : (
        <Input
          id={id}
          type={field.sensitive && !reveal ? "password" : field.type === "email" ? "email" : "text"}
          inputMode={field.type === "email" ? "email" : undefined}
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls} ${disabledCls}`}
        />
      )}

      {errorKey ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" /> {errorMessageFor(errorKey, locale)}
        </p>
      ) : (
        help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      )}
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
        invalid
          ? "border-red-500 focus-within:ring-2 focus-within:ring-red-500"
          : "border-input focus-within:ring-2 focus-within:ring-ring"
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

/** Month / day / year selects → ISO date. Avoids the native date picker on mobile. */
function DobParts({
  value,
  onChange,
  invalid,
  locale,
  disabled,
}: {
  value: string;
  onChange: (iso: string) => void;
  invalid?: boolean;
  locale: AcaLocale;
  disabled?: boolean;
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
  const cls = `${selectCls} ${invalid ? "border-red-500" : ""} ${disabled ? "opacity-60" : ""}`;

  function set(next: { month?: string; day?: string; year?: string }) {
    const merged = { ...parts, ...next };
    setParts(merged);
    onChange(buildDobIso(merged.month, merged.day, merged.year));
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <select aria-label={tr(UI.dobMonth, locale)} value={parts.month} disabled={disabled} onChange={(e) => set({ month: e.target.value })} className={cls}>
        <option value="">{tr(UI.dobMonth, locale)}</option>
        {MONTHS[locale].map((name, i) => (
          <option key={i} value={String(i + 1)}>
            {name}
          </option>
        ))}
      </select>
      <select aria-label={tr(UI.dobDay, locale)} value={parts.day} disabled={disabled} onChange={(e) => set({ day: e.target.value })} className={cls}>
        <option value="">{tr(UI.dobDay, locale)}</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={String(d)}>
            {d}
          </option>
        ))}
      </select>
      <select aria-label={tr(UI.dobYear, locale)} value={parts.year} disabled={disabled} onChange={(e) => set({ year: e.target.value })} className={cls}>
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

/**
 * Config-driven repeater. Renders each row's `rowFields` through the same `FieldInput`
 * dispatch as top-level fields, with two things the IUL beneficiaries editor could not do:
 *
 *  1. `showIf` resolves against the ROW, so a member's citizenship branch (citizen →
 *     naturalized → which document) works inside the row.
 *  2. `file` sub-fields upload against `repeaterKey` + `rowIndex`, so each member carries
 *     their own documents.
 */
function RepeaterEditor({
  field,
  token,
  locale,
  rows,
  onSetRowField,
  onReplaceRows,
  missing,
  errors,
  onBlurSub,
  isOwner,
  reveal,
  lockedFirstRow,
  addLabel,
}: {
  field: AcaField;
  token: string;
  locale: AcaLocale;
  rows: RepeaterRow[];
  onSetRowField: (index: number, subKey: string, value: unknown) => void;
  onReplaceRows: (rows: RepeaterRow[]) => void;
  missing: Set<string>;
  errors: Record<string, FieldErrorKey>;
  onBlurSub: (field: AcaField, value: string, key: string) => void;
  isOwner: boolean;
  reveal: boolean;
  /** Row 0 is the primary applicant: identity is mirrored from step 1 and not editable here. */
  lockedFirstRow?: boolean;
  addLabel: string;
}) {
  const minRows = field.minRows ?? 1;
  const maxRows = field.maxRows ?? 8;

  // Always show at least `minRows`, even before anything is typed.
  const list = useMemo(() => {
    if (rows.length >= minRows) return rows;
    const padded = [...rows];
    while (padded.length < minRows) padded.push(emptyRow(field));
    return padded;
  }, [rows, minRows, field]);

  function addRow() {
    if (list.length >= maxRows) return;
    onReplaceRows([...list, emptyRow(field)]);
  }

  function removeRow(index: number) {
    const next = list.filter((_, i) => i !== index);
    onReplaceRows(next.length ? next : [emptyRow(field)]);
  }

  const invalidBlock = missing.has(field.key);

  return (
    <div className={`space-y-4 ${invalidBlock ? "rounded-md border border-red-500 p-3" : ""}`}>
      {list.map((row, index) => {
        const rowData = (row ?? {}) as RepeaterRow;
        const isPrimary = !!lockedFirstRow && index === 0;
        const heading = isPrimary
          ? `${rowLabel(field, locale)} 1 · ${tr(UI.youLabel, locale)}`
          : `${rowLabel(field, locale)} ${index + 1}`;

        return (
          <div key={index} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{heading}</span>
              {list.length > minRows && !isPrimary && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-xs text-red-600 hover:underline"
                >
                  {tr(UI.remove, locale)}
                </button>
              )}
            </div>

            {isPrimary && (
              <p className="mb-3 text-xs text-muted-foreground">{tr(UI.primaryFromStepOne, locale)}</p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {(field.rowFields ?? []).map((sub) => {
                // Row-scoped conditional visibility — the citizenship branch lives here.
                if (!isFieldVisible(sub, rowData as Record<string, unknown>)) return null;

                const path = rowPath(field.key, index, sub.key);
                const locked =
                  isPrimary &&
                  (PRIMARY_MIRROR_KEYS as readonly string[]).concat("relationship", "hasSsn").includes(sub.key);

                if (sub.type === "file") {
                  return (
                    <div key={sub.key} className="sm:col-span-2">
                      <FileUploader
                        token={token}
                        target={{ fieldKey: sub.key, repeaterKey: field.key, rowIndex: index }}
                        label={fieldLabel(sub, locale)}
                        help={fieldHelp(sub, locale)}
                        required={sub.required}
                        locale={locale}
                        invalid={missing.has(path)}
                        files={Array.isArray(rowData[sub.key]) ? (rowData[sub.key] as FileRef[]) : []}
                        onChange={(files) => onSetRowField(index, sub.key, files)}
                      />
                    </div>
                  );
                }

                const wide = sub.type === "textarea" || sub.type === "select";
                return (
                  <div key={sub.key} className={wide ? "sm:col-span-2" : undefined}>
                    <FieldInput
                      field={sub}
                      locale={locale}
                      compact
                      idPrefix={`r-${field.key}-${index}`}
                      value={str(rowData[sub.key])}
                      onChange={(v) => onSetRowField(index, sub.key, v)}
                      onBlur={(v) => onBlurSub(sub, v, path)}
                      invalid={missing.has(path)}
                      errorKey={errors[path]}
                      reveal={reveal}
                      isOwner={isOwner}
                      disabled={locked}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {list.length < maxRows && (
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/**
 * File upload with mobile camera capture. Images are downscaled in the browser before the
 * request (see lib/image-compress.ts) because Vercel rejects request bodies over 4.5 MB and
 * an unedited phone photo of a green card is routinely larger than that.
 */
function FileUploader({
  token,
  target,
  label,
  help,
  required,
  locale,
  invalid,
  files,
  onChange,
}: {
  token: string;
  target: FileTargetRef;
  label: string;
  help?: string;
  required?: boolean;
  locale: AcaLocale;
  invalid?: boolean;
  files: FileRef[];
  onChange: (files: FileRef[]) => void;
}) {
  const [busy, setBusy] = useState<"idle" | "preparing" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const uid = `${target.repeaterKey ?? "top"}-${target.rowIndex ?? 0}-${target.fieldKey}`;
  const cameraId = `cam-${uid}`;
  const fileId = `file-${uid}`;

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    try {
      let latest = files;
      for (const original of Array.from(fileList)) {
        setBusy("preparing");
        const prepared = await compressImageFile(original);
        if (prepared.size > MAX_UPLOAD_BYTES) {
          setError(`${tr(UI.fileTooLarge, locale)} (${formatBytes(prepared.size)})`);
          continue;
        }
        setBusy("uploading");
        const res = await uploadAcaIntakeFile(token, target, prepared);
        latest = res.files;
      }
      onChange(latest);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr(UI.uploadError, locale));
    } finally {
      setBusy("idle");
    }
  }

  async function handleRemove(url: string) {
    try {
      const res = await removeAcaIntakeFile(token, target, url);
      onChange(res.files);
    } catch {
      setError(tr(UI.uploadError, locale));
    }
  }

  const working = busy !== "idle";

  return (
    <div className={invalid ? "rounded-md border border-red-500 p-2" : undefined}>
      <Label className={`mb-0.5 block ${invalid ? "text-red-600" : ""}`}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {help && <p className="mb-1 text-xs text-muted-foreground">{help}</p>}

      {files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={f.url || `${f.name}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
            >
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-center gap-2 text-blue-600 hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </a>
              ) : (
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(f.url)}
                className="text-muted-foreground hover:text-red-600"
                aria-label={tr(UI.remove, locale)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Camera-first on mobile; "choose a file" covers desktop and PDFs. */}
      <input
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        id={fileId}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={working}
          onClick={() => document.getElementById(cameraId)?.click()}
          className="gap-1.5"
        >
          {working ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {tr(busy === "preparing" ? UI.preparing : UI.uploading, locale)}
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" /> {tr(UI.takePhoto, locale)}
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={working}
          onClick={() => document.getElementById(fileId)?.click()}
          className="gap-1.5 text-muted-foreground"
        >
          <Upload className="h-4 w-4" /> {tr(UI.chooseFile, locale)}
        </Button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">{tr(UI.fileHint, locale)}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
