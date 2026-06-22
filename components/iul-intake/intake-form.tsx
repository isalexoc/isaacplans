"use client";

import { useEffect, useMemo, useState } from "react";
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
  Upload,
  FileText,
  X,
} from "lucide-react";
import {
  fetchIntake,
  completeIntake,
  uploadIntakeFile,
  removeIntakeFile,
} from "@/lib/iul-intake-api";
import { useIulIntakeAutosave } from "@/hooks/use-iul-intake-autosave";
import IntakeBreadcrumb from "@/components/iul-intake/intake-breadcrumb";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/iul-intake/intake-address-input";
import {
  visibleSections,
  MAX_BENEFICIARIES,
  BENEFICIARY_RELATIONSHIPS,
  emptyBeneficiary,
  isFieldVisible,
  fieldByKey,
  type IntakeField,
  type Beneficiary,
  type FileRef,
} from "@/lib/iul-intake/fields";
import {
  fieldFormatError,
  beneficiaryPercentTotal,
  type FieldErrorKey,
} from "@/lib/iul-intake/validation";
import {
  parseWholeDollarInput,
  formatWholeDollarDisplay,
  sanitizePremiumInput,
  formatPremiumDisplay,
  normalizePremiumOnBlur,
} from "@/lib/leave-behind-money-input";
import type { IntakeData } from "@/lib/iul-intake/schema";
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
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchIntake(token);
        if (!active) return;
        setSession(s);
        setData(s.data ?? {});
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

  // Clients pay by bank draft only — lock the value so it always syncs.
  useEffect(() => {
    if (loadState !== "ready" || isOwner) return;
    const current = typeof data.paymentMethod === "string" ? data.paymentMethod : "";
    if (current !== "Electronic (bank draft)") {
      setData((prev) => ({ ...prev, paymentMethod: "Electronic (bank draft)" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, isOwner]);

  // Keep step in range when the section list changes (role resolves after load).
  useEffect(() => {
    setStep((s) => Math.min(s, sections.length - 1));
  }, [sections.length]);

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

  function goNext() {
    // Surface format errors on the current step before advancing (empties stay allowed).
    const stepErrors: Record<string, FieldErrorKey> = {};
    for (const field of current.fields) {
      if (!isFieldVisible(field, data)) continue;
      const v = typeof data[field.key] === "string" ? (data[field.key] as string) : "";
      const err = fieldFormatError(field, v);
      if (err) stepErrors[field.key] = err;
    }
    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      setCompleteError(tr(UI.fixErrors, locale));
      return;
    }
    setCompleteError(null);
    setStep((s) => Math.min(sections.length - 1, s + 1));
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
        // Friendly, label-based summary instead of raw field keys.
        const labels = (result.missing ?? [])
          .map((k) => (k === "beneficiaries" ? tr(UI.beneficiary, locale) : fieldByKey(k) ? fieldLabel(fieldByKey(k)!, locale) : k))
          .filter(Boolean);
        const summary = labels.length
          ? `${tr(UI.pleaseComplete, locale)} ${labels.join(", ")}`
          : result.message || tr(UI.missingFields, locale);
        setCompleteError(summary);
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {isOwner && <IntakeBreadcrumb current={tr(UI.navForm, locale)} />}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl">{tr(UI.intakeTitle, locale)}</h1>
        <SaveIndicator status={saveStatus} locale={locale} />
      </div>
      <p className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-green-600" /> {tr(UI.secureNote, locale)}
      </p>

      {/* Step progress */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{sectionTitle(current, locale)}</span>
          <span>
            {tr(UI.step, locale)} {step + 1} {tr(UI.of, locale)} {sections.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / sections.length) * 100}%` }}
          />
        </div>
      </div>

      {completed && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          <PartyPopper className="h-4 w-4" /> {tr(UI.completed, locale)}
        </div>
      )}

      <div className="rounded-lg border bg-white p-5 shadow-sm dark:bg-gray-950">
        <h2 className="text-lg font-semibold">{sectionTitle(current, locale)}</h2>
        {sectionDescription(current, locale) && (
          <p className="mb-3 text-sm text-muted-foreground">{sectionDescription(current, locale)}</p>
        )}

        <div className="mt-3 space-y-4">
          {current.fields.map((field) => {
            if (!isFieldVisible(field, data)) return null;
            if (field.ownerOnly && !isOwner) return null;

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
              />
            );
          })}
        </div>
      </div>

      {completeError && (
        <p className="mt-3 flex items-start gap-1.5 text-sm text-red-600">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {completeError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          {tr(UI.back, locale)}
        </Button>
        {step < sections.length - 1 ? (
          <Button onClick={goNext}>{tr(UI.next, locale)}</Button>
        ) : (
          <Button onClick={handleFinish} disabled={completing}>
            {completing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr(UI.finishing, locale)}
              </>
            ) : (
              tr(UI.finish, locale)
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ status, locale }: { status: string; locale: IntakeLocale }) {
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CloudUpload className="h-4 w-4 animate-pulse" /> {tr(UI.saving, locale)}
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Check className="h-4 w-4" /> {tr(UI.saved, locale)}
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-xs text-red-600">
        <AlertCircle className="h-4 w-4" /> {tr(UI.saveError, locale)}
      </span>
    );
  }
  return null;
}

/* Shared select styling (native selects are best on mobile). */
const selectCls =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm";
const inputBase = "text-base sm:text-sm";

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
}) {
  const id = `f-${field.key}`;
  const label = fieldLabel(field, locale);
  const help = fieldHelp(field, locale);
  const placeholder = fieldPlaceholder(field, locale);
  const showInvalid = invalid || !!errorKey;
  const invalidCls = showInvalid ? "border-red-500 focus-visible:ring-red-500" : "";

  function handleDigits(raw: string) {
    let v = raw.replace(/\D/g, "");
    if (field.maxLength) v = v.slice(0, field.maxLength);
    onChange(v);
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label htmlFor={id} className={showInvalid ? "text-red-600" : ""}>
          {label}
          {field.required && <span className="ml-0.5 text-red-500">*</span>}
        </Label>
        {field.sensitive && isOwner && (
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
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${selectCls} ${invalidCls}`}
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
      ) : field.type === "dob" ? (
        <DobParts value={value} onChange={onChange} invalid={showInvalid} locale={locale} />
      ) : field.type === "height" ? (
        <HeightSelect id={id} value={value} onChange={onChange} invalid={showInvalid} locale={locale} />
      ) : field.type === "address" ? (
        <IntakeAddressInput
          id={id}
          value={value}
          onChange={onChange}
          onResolve={onResolveAddress}
          placeholder={placeholder}
          invalid={showInvalid}
          locale={locale}
        />
      ) : field.type === "money" ? (
        <MoneyInput
          id={id}
          display={formatWholeDollarDisplay(value)}
          onChange={(raw) => onChange(parseWholeDollarInput(raw))}
          inputMode="numeric"
          invalid={showInvalid}
        />
      ) : field.type === "premium" ? (
        <MoneyInput
          id={id}
          display={formatPremiumDisplay(value)}
          onChange={(raw) => onChange(sanitizePremiumInput(raw))}
          onBlur={() => onChange(normalizePremiumOnBlur(value))}
          inputMode="decimal"
          invalid={showInvalid}
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} ${invalidCls}`}
        />
      ) : field.type === "tel" ? (
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          value={formatUsPhone(value)}
          placeholder={placeholder}
          onChange={(e) => onChange(formatUsPhone(e.target.value))}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls}`}
        />
      ) : field.type === "ssn" || field.type === "number" || field.digitsOnly ? (
        <Input
          id={id}
          type={field.sensitive && !reveal ? "password" : "text"}
          inputMode="numeric"
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          maxLength={field.type === "ssn" ? 9 : field.maxLength}
          onChange={(e) => handleDigits(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls}`}
        />
      ) : (
        <Input
          id={id}
          type={field.sensitive && !reveal ? "password" : field.type === "email" ? "email" : "text"}
          inputMode={field.type === "email" ? "email" : undefined}
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onBlur(e.target.value)}
          className={`${inputBase} ${invalidCls}`}
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

/* Dollar input with a leading $ adornment. */
function MoneyInput({
  id,
  display,
  onChange,
  onBlur,
  inputMode,
  invalid,
}: {
  id: string;
  display: string;
  onChange: (raw: string) => void;
  onBlur?: () => void;
  inputMode: "numeric" | "decimal";
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
        inputMode={inputMode}
        value={display}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-full w-full border-0 bg-transparent text-base outline-none sm:text-sm"
      />
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
  const cls = `${selectCls} ${invalid ? "border-red-500" : ""}`;

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
  const cls = `${selectCls} ${invalid ? "border-red-500" : ""}`;
  return (
    <div className="grid grid-cols-2 gap-2" id={id}>
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
  const list = useMemo(() => (value.length ? value : [emptyBeneficiary()]), [value]);
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
          <div key={idx} className="rounded-md border p-3">
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
                  className={selectCls}
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
                onChange={(v) => update(idx, { ssn: v.replace(/\D/g, "").slice(0, 9) })}
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
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} className={inputBase} />
    </div>
  );
}

function FileUploader({
  token,
  fieldKey,
  label,
  locale,
  files,
  onChange,
}: {
  token: string;
  fieldKey: string;
  label: string;
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
      <Label className="mb-1 block">{label}</Label>
      {files.length > 0 && (
        <ul className="mb-2 space-y-1">
          {files.map((f) => (
            <li key={f.url} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-2 text-blue-600 hover:underline">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{f.name}</span>
              </a>
              <button type="button" onClick={() => handleRemove(f.url)} className="text-muted-foreground hover:text-red-600">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
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
