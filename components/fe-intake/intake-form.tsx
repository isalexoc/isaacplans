"use client";

/**
 * Final Expense client intake wizard — one question per screen (Typeform/Ethos-style), not the
 * dense multi-field-per-section stepper IUL/ACA use. Thin animated progress bar, icon-illustrated
 * single-select cards, sticky disabled→active Next button. Schema-driven off the same
 * lib/fe-intake/fields.ts catalog the agent dashboard and CRM sync use — only the rendering
 * layer differs from the IUL/ACA pattern.
 *
 * Screens are derived from `data` on every render (not a fixed list): a repeater like
 * `medications` expands into one screen per sub-field per existing row, plus an "add another?"
 * control screen after each row. Answering a field writes straight into `data` (autosaved by
 * useFeIntakeAutosave); Next re-derives the screen list from the just-updated data so a newly
 * revealed conditional field (e.g. `ssn` after `hasSsn = yes`) appears immediately after it.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Check,
  User,
  UserRound,
  HeartHandshake,
  Baby,
  Users,
  Sprout,
  HelpCircle,
  Droplet,
  Syringe,
  HeartPulse,
  Activity,
  Brain,
  CircleDot,
  Bone,
  Phone,
  type LucideIcon,
} from "lucide-react";
import IntakeAddressInput, { type ResolvedAddress } from "@/components/shared/intake-address-input";
import { fetchFeIntake, completeFeIntake, searchMedications } from "@/lib/fe-intake-api";
import { useFeIntakeAutosave } from "@/hooks/use-fe-intake-autosave";
import {
  FE_SECTIONS,
  isFieldVisible,
  emptyRow,
  fieldByKey,
  type FeField,
  type RepeaterRow,
} from "@/lib/fe-intake/fields";
import { fieldFormatError } from "@/lib/fe-intake/validation";
import {
  UI,
  pickLocale,
  tr,
  fieldLabel,
  fieldHelp,
  fieldNote,
  fieldPlaceholder,
  optionLabel,
  type FeLocale,
} from "@/lib/fe-intake/ui-strings";
import type { FeIntakeData } from "@/lib/fe-intake/schema";
import type { FeIntakeSession } from "@/lib/fe-intake/types";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// ─── Screen model — derived from data, not a fixed list ──────────────────────

type Screen =
  | { screenKey: string; kind: "field"; field: FeField }
  | { screenKey: string; kind: "repeaterRow"; field: FeField; repeaterKey: string; rowIndex: number }
  | { screenKey: string; kind: "addAnother"; repeaterKey: string; rowIndex: number }
  | { screenKey: string; kind: "finish" };

function buildScreens(data: FeIntakeData): Screen[] {
  const screens: Screen[] = [];
  for (const section of FE_SECTIONS) {
    for (const field of section.fields) {
      if (!isFieldVisible(field, data)) continue;
      if (field.type !== "repeater") {
        screens.push({ screenKey: `field:${field.key}`, kind: "field", field });
        continue;
      }
      const rows: RepeaterRow[] = Array.isArray(data[field.key]) ? (data[field.key] as RepeaterRow[]) : [];
      const rowCount = Math.max(1, rows.length);
      const maxRows = field.maxRows ?? 15;
      for (let i = 0; i < rowCount; i++) {
        const row = rows[i] ?? {};
        for (const sub of field.rowFields ?? []) {
          if (!isFieldVisible(sub, row as Record<string, unknown>)) continue;
          screens.push({
            screenKey: `repeater:${field.key}:${i}:${sub.key}`,
            kind: "repeaterRow",
            field: sub,
            repeaterKey: field.key,
            rowIndex: i,
          });
        }
        if (i < maxRows - 1) {
          screens.push({ screenKey: `addAnother:${field.key}:${i}`, kind: "addAnother", repeaterKey: field.key, rowIndex: i });
        }
      }
    }
  }
  screens.push({ screenKey: "finish", kind: "finish" });
  return screens;
}

function rowOf(data: FeIntakeData, repeaterKey: string, rowIndex: number): Record<string, unknown> {
  const rows = Array.isArray(data[repeaterKey]) ? (data[repeaterKey] as RepeaterRow[]) : [];
  return (rows[rowIndex] ?? {}) as Record<string, unknown>;
}

function isScreenValid(screen: Screen, data: FeIntakeData): boolean {
  if (screen.kind === "finish" || screen.kind === "addAnother") return true;
  const container = screen.kind === "repeaterRow" ? rowOf(data, screen.repeaterKey, screen.rowIndex) : data;
  const value = str(container[screen.field.key]).trim();
  if (screen.field.required && !value) return false;
  if (value && fieldFormatError(screen.field, value)) return false;
  return true;
}

/** Resume at the first unanswered/invalid screen instead of always restarting at question 1. */
function firstIncompleteScreenKey(screens: Screen[], data: FeIntakeData): string {
  for (const s of screens) {
    if (s.kind === "finish" || s.kind === "addAnother") continue;
    if (!isScreenValid(s, data)) return s.screenKey;
  }
  return screens[screens.length - 1].screenKey;
}

// ─── Icon choices for single-select "card" questions ──────────────────────────

const YES_NO_ICON: Record<string, LucideIcon> = { yes: CheckCircle2, no: XCircle };
const RELATIONSHIP_ICON: Record<string, LucideIcon> = {
  Self: User,
  Spouse: HeartHandshake,
  Son: Baby,
  Daughter: Baby,
  Parent: Users,
  Grandchild: Sprout,
  Other: HelpCircle,
};
const GENDER_ICON: Record<string, LucideIcon> = { Male: User, Female: UserRound };
const USAGE_ICON: Record<string, LucideIcon> = {
  Cholesterol: Droplet,
  Diabetes: Syringe,
  "Blood Pressure": HeartPulse,
  "Heart Disease": Activity,
  "Depression/Anxiety": Brain,
  Thyroid: CircleDot,
  "Pain/Arthritis": Bone,
  Other: HelpCircle,
};

function iconForOption(fieldKey: string, value: string): LucideIcon {
  if (fieldKey === "hasSsn" || fieldKey === "takesMedications") return YES_NO_ICON[value] ?? HelpCircle;
  if (fieldKey === "relationship") return RELATIONSHIP_ICON[value] ?? HelpCircle;
  if (fieldKey === "gender") return GENDER_ICON[value] ?? User;
  if (fieldKey === "usage") return USAGE_ICON[value] ?? HelpCircle;
  return HelpCircle;
}

// ─── Shared styling ────────────────────────────────────────────────────────────

const BIG_INPUT =
  "w-full rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-lg text-gray-900 placeholder:text-gray-400 focus:border-brand focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100";

function ChoiceCard({
  selected,
  icon: Icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition ${
        selected
          ? "border-brand bg-brand/5"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          selected ? "bg-brand text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{label}</span>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          selected ? "border-brand bg-brand" : "border-gray-300 dark:border-gray-700"
        }`}
      >
        {selected && <Check className="h-4 w-4 text-white" />}
      </span>
    </button>
  );
}

function DrugSearchInput({
  value,
  onChange,
  placeholder,
  locale,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  locale: FeLocale;
}) {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [notListed, setNotListed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (notListed || value.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const handle = setTimeout(() => {
      searchMedications(value)
        .then((r) => {
          if (active) setResults(r);
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [value, notListed]);

  return (
    <div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder={notListed ? undefined : placeholder}
        className={BIG_INPUT}
      />
      {!notListed && open && value.trim().length >= 2 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {loading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {tr(UI.searching, locale)}
            </div>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{tr(UI.noMatches, locale)}</p>
          ) : (
            results.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {name}
              </button>
            ))
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          setNotListed((n) => !n);
          setOpen(false);
        }}
        className="mt-2 text-sm font-medium text-brand underline"
      >
        {tr(UI.notListed, locale)}
      </button>
    </div>
  );
}

export default function FeIntakeForm({ token }: { token: string }) {
  const locale = pickLocale(useLocale());
  const [session, setSession] = useState<FeIntakeSession | null>(null);
  const [data, setData] = useState<FeIntakeData>({});
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [currentKey, setCurrentKey] = useState<string>("finish");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await fetchFeIntake(token);
        if (!active) return;
        setSession(s);
        setData(s.data ?? {});
        const screens = buildScreens(s.data ?? {});
        setCurrentKey(firstIncompleteScreenKey(screens, s.data ?? {}));
        setLoadState("ready");
      } catch {
        if (active) setLoadState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const autosave = useFeIntakeAutosave({
    token,
    data,
    onSaved: () =>
      setSession((prev) => (prev && prev.status === "draft" ? { ...prev, status: "in_progress" } : prev)),
  });

  const screens = useMemo(() => buildScreens(data), [data]);
  const idx = Math.max(0, screens.findIndex((s) => s.screenKey === currentKey));
  const screen = screens[idx] ?? screens[screens.length - 1];
  const progressPct = Math.round((idx / Math.max(1, screens.length - 1)) * 100);

  const isOwner = session?.role === "owner";
  const locked = Boolean(session && !isOwner && session.status === "completed" && !session.reopenedForClient);

  function setFieldValue(key: string, value: string) {
    setData({ ...data, [key]: value });
  }

  function setRowValue(repeaterKey: string, rowIndex: number, subKey: string, value: string) {
    const fieldDef = fieldByKey(repeaterKey);
    if (!fieldDef) return;
    const rows: RepeaterRow[] = Array.isArray(data[repeaterKey]) ? [...(data[repeaterKey] as RepeaterRow[])] : [];
    while (rows.length <= rowIndex) rows.push(emptyRow(fieldDef));
    rows[rowIndex] = { ...rows[rowIndex], [subKey]: value };
    setData({ ...data, [repeaterKey]: rows });
  }

  function handleAddressResolve(field: FeField, resolved: ResolvedAddress) {
    const next: FeIntakeData = { ...data, [field.key]: field.addressTargets ? resolved.line1 : resolved.formatted };
    if (field.addressTargets?.city) next[field.addressTargets.city] = resolved.city;
    if (field.addressTargets?.state) next[field.addressTargets.state] = resolved.state;
    if (field.addressTargets?.zip) next[field.addressTargets.zip] = resolved.zip;
    setData(next);
  }

  function goNext() {
    const next = screens[idx + 1] ?? screens[screens.length - 1];
    setCurrentKey(next.screenKey);
  }

  function goBack() {
    if (idx > 0) setCurrentKey(screens[idx - 1].screenKey);
  }

  function handleAddAnother(repeaterKey: string, rowIndex: number, wantsMore: boolean) {
    const fieldDef = fieldByKey(repeaterKey);
    if (!fieldDef) return;
    const rows: RepeaterRow[] = Array.isArray(data[repeaterKey]) ? [...(data[repeaterKey] as RepeaterRow[])] : [];
    if (wantsMore) {
      while (rows.length <= rowIndex + 1) rows.push(emptyRow(fieldDef));
    }
    const nextData: FeIntakeData = {
      ...data,
      [repeaterKey]: wantsMore ? rows : rows.slice(0, rowIndex + 1),
    };

    const newScreens = buildScreens(nextData);
    const targetKey = wantsMore
      ? `repeater:${repeaterKey}:${rowIndex + 1}:drugName`
      : `addAnother:${repeaterKey}:${rowIndex}`;
    const targetIdx = newScreens.findIndex((s) => s.screenKey === targetKey);
    const target = wantsMore ? newScreens[targetIdx] : newScreens[targetIdx + 1];

    setData(nextData);
    setCurrentKey((target ?? newScreens[newScreens.length - 1]).screenKey);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await autosave.saveNow();
      const result = await completeFeIntake(token);
      if (!result.success) {
        setSubmitError(result.message ?? tr(UI.errRequired, locale));
        setSubmitting(false);
        return;
      }
      setJustSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  if (loadState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {tr(UI.loading, locale)}
      </div>
    );
  }
  if (loadState === "error" || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-red-600">
        <AlertCircle className="mr-2 h-5 w-5" /> {tr(UI.loadError, locale)}
      </div>
    );
  }
  if (locked || justSubmitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <CheckCircle2 className="h-12 w-12 text-brand" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{tr(UI.thankYouTitle, locale)}</h1>
        <p className="max-w-sm text-muted-foreground">{tr(UI.thankYouBody, locale)}</p>
      </div>
    );
  }

  const valid = isScreenValid(screen, data);
  const phoneNumber = process.env.NEXT_PUBLIC_PHONE_NUMBER;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Progress bar */}
      <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800">
        <motion.div
          className="h-full bg-gradient-to-r from-brand to-accent"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Chrome */}
      <header className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={goBack}
          disabled={idx === 0}
          aria-label={tr(UI.back, locale)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold text-brand">Isaac Plans</span>
        {phoneNumber ? (
          <a
            href={`tel:${phoneNumber}`}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3.5 w-3.5" /> {tr(UI.needHelp, locale)}
          </a>
        ) : (
          <span />
        )}
      </header>

      {/* Question */}
      <main className="flex flex-1 flex-col px-5 pb-8 pt-2">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen.screenKey}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              {screen.kind === "finish" ? (
                <FinishScreen
                  locale={locale}
                  submitting={submitting}
                  submitError={submitError}
                  onSubmit={handleSubmit}
                />
              ) : screen.kind === "addAnother" ? (
                <AddAnotherScreen locale={locale} onAnswer={(more) => handleAddAnother(screen.repeaterKey, screen.rowIndex, more)} />
              ) : (
                <FieldScreen
                  field={screen.field}
                  value={str(
                    screen.kind === "repeaterRow" ? rowOf(data, screen.repeaterKey, screen.rowIndex)[screen.field.key] : data[screen.field.key]
                  )}
                  locale={locale}
                  onChange={(v) =>
                    screen.kind === "repeaterRow"
                      ? setRowValue(screen.repeaterKey, screen.rowIndex, screen.field.key, v)
                      : setFieldValue(screen.field.key, v)
                  }
                  onAddressResolve={(resolved) => handleAddressResolve(screen.field, resolved)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {screen.kind !== "addAnother" && screen.kind !== "finish" && (
            <button
              type="button"
              disabled={!valid}
              onClick={goNext}
              className={`mt-8 w-full rounded-2xl px-6 py-4 text-center text-base font-semibold transition ${
                valid
                  ? "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                  : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600"
              }`}
            >
              {tr(UI.next, locale)}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function FieldScreen({
  field,
  value,
  locale,
  onChange,
  onAddressResolve,
}: {
  field: FeField;
  value: string;
  locale: FeLocale;
  onChange: (v: string) => void;
  onAddressResolve: (resolved: ResolvedAddress) => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{fieldLabel(field, locale)}</h1>
      {fieldHelp(field, locale) && <p className="mt-2 text-sm text-muted-foreground">{fieldHelp(field, locale)}</p>}

      <div className="mt-6">
        {field.type === "select" && field.options ? (
          <div className="space-y-2.5" role="radiogroup">
            {field.options.map((opt) => (
              <ChoiceCard
                key={opt.value}
                selected={value === opt.value}
                icon={iconForOption(field.key, opt.value)}
                label={optionLabel(opt, locale)}
                onClick={() => onChange(opt.value)}
              />
            ))}
          </div>
        ) : field.type === "address" ? (
          <IntakeAddressInput
            id={field.key}
            value={value}
            onChange={onChange}
            onResolve={onAddressResolve}
            placeholder={fieldPlaceholder(field, locale)}
            locale={locale}
          />
        ) : field.type === "drug" ? (
          <DrugSearchInput value={value} onChange={onChange} placeholder={fieldPlaceholder(field, locale)} locale={locale} />
        ) : field.type === "dob" ? (
          <input
            autoFocus
            type="date"
            value={value}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onChange(e.target.value)}
            className={BIG_INPUT}
          />
        ) : field.type === "zip" ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, field.maxLength ?? 5))}
            placeholder={fieldPlaceholder(field, locale)}
            className={BIG_INPUT}
          />
        ) : field.type === "ssn" ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, field.maxLength ?? 9))}
            placeholder="123456789"
            className={BIG_INPUT}
          />
        ) : (
          <input
            autoFocus
            type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
            inputMode={field.type === "tel" ? "tel" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={fieldPlaceholder(field, locale)}
            className={BIG_INPUT}
          />
        )}
      </div>

      {field.key === "hasSsn" && value === "no" && fieldNote(field, locale) && (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 text-sm text-gray-700 dark:text-gray-300">
          {fieldNote(field, locale)}
        </div>
      )}
    </div>
  );
}

function AddAnotherScreen({ locale, onAnswer }: { locale: FeLocale; onAnswer: (wantsMore: boolean) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{tr(UI.addAnother, locale)}</h1>
      <div className="mt-6 space-y-2.5">
        <ChoiceCard selected={false} icon={CheckCircle2} label={locale === "es" ? "Sí" : "Yes"} onClick={() => onAnswer(true)} />
        <ChoiceCard selected={false} icon={XCircle} label="No" onClick={() => onAnswer(false)} />
      </div>
    </div>
  );
}

function FinishScreen({
  locale,
  submitting,
  submitError,
  onSubmit,
}: {
  locale: FeLocale;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold leading-snug text-gray-900 dark:text-gray-100">{tr(UI.thankYouTitle, locale)}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{tr(UI.submitApplication, locale)}</p>
      {submitError && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" /> {submitError}
        </p>
      )}
      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-accent px-6 py-4 text-base font-semibold text-white shadow-md shadow-brand/30 transition hover:opacity-95 disabled:opacity-60"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? tr(UI.submitting, locale) : tr(UI.submitApplication, locale)}
      </button>
    </div>
  );
}
