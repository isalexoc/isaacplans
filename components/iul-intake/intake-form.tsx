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
import {
  INTAKE_SECTIONS,
  MAX_BENEFICIARIES,
  emptyBeneficiary,
  isFieldVisible,
  type IntakeField,
  type Beneficiary,
  type FileRef,
} from "@/lib/iul-intake/fields";
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

export default function IntakeForm({ token }: { token: string }) {
  const locale = pickLocale(useLocale());

  const [session, setSession] = useState<IntakeSession | null>(null);
  const [data, setData] = useState<IntakeData>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
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
  }

  const sections = INTAKE_SECTIONS;
  const current = sections[step];

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
        setCompleteError(result.message || tr(UI.missingFields, locale));
        // Jump to the first section containing a missing field.
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
                invalid={missing.has(field.key)}
                reveal={reveal}
                isOwner={isOwner}
                onToggleReveal={() => setReveal((r) => !r)}
              />
            );
          })}
        </div>
      </div>

      {completeError && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" /> {completeError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          {tr(UI.back, locale)}
        </Button>
        {step < sections.length - 1 ? (
          <Button onClick={() => setStep((s) => Math.min(sections.length - 1, s + 1))}>
            {tr(UI.next, locale)}
          </Button>
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

function FieldInput({
  field,
  locale,
  value,
  onChange,
  invalid,
  reveal,
  isOwner,
  onToggleReveal,
}: {
  field: IntakeField;
  locale: IntakeLocale;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  reveal: boolean;
  isOwner: boolean;
  onToggleReveal: () => void;
}) {
  const id = `f-${field.key}`;
  const label = fieldLabel(field, locale);
  const help = fieldHelp(field, locale);
  const placeholder = fieldPlaceholder(field, locale);
  const invalidCls = invalid ? "border-red-500 focus-visible:ring-red-500" : "";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label htmlFor={id} className={invalid ? "text-red-600" : ""}>
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
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${invalidCls}`}
        >
          <option value="">{tr(UI.choose, locale)}</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {optionLabel(opt, locale)}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <Textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={invalidCls} />
      ) : (
        <Input
          id={id}
          type={field.sensitive && !reveal ? "password" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
          inputMode={field.type === "number" || field.type === "money" ? "decimal" : undefined}
          autoComplete={field.sensitive ? "off" : undefined}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={invalidCls}
        />
      )}
      {help && <p className="mt-1 text-xs text-muted-foreground">{help}</p>}
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
      {list.map((b, idx) => (
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
            <LabeledInput label={tr(UI.benRelationship, locale)} value={b.relationship} onChange={(v) => update(idx, { relationship: v })} />
            <LabeledInput label={tr(UI.benPercent, locale)} value={b.percent} onChange={(v) => update(idx, { percent: v })} inputMode="decimal" />
            <LabeledInput label={tr(UI.benDob, locale)} value={b.dateOfBirth} onChange={(v) => update(idx, { dateOfBirth: v })} type="date" />
            <LabeledInput label={tr(UI.benSsn, locale)} value={b.ssn} onChange={(v) => update(idx, { ssn: v })} type={reveal ? "text" : "password"} />
          </div>
        </div>
      ))}
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
  inputMode?: "decimal";
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type={type} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} />
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
